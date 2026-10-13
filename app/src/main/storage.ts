import { app } from 'electron'
import { join, resolve } from 'path'
import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
  mkdirSync,
  statSync
} from 'fs'
import { AppData, AppDataSchema, DEFAULT_SETTINGS, StorageInitialResult } from '../renderer/src/domain/types'
import { isSchemaV1, migrateV1ToV2 } from '../renderer/src/domain/migration'

const SCHEMA_VERSION = 2
const DATA_FILE_NAME = 'tasks_data.json'
const MAX_BACKUPS = 5
const BACKUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes rate-limit for automatic backups

export interface BackupFileInfo {
  name: string
  path: string
  time: string
  size: number
  mtimeMs: number
}

interface PendingBatch {
  data: AppData
  forceBackup: boolean
  resolves: Array<(val: boolean) => void>
  rejects: Array<(err: any) => void>
}

export class StorageService {
  private userDataPath: string
  private dataFilePath: string
  private isWriting = false
  private pendingBatch: PendingBatch | null = null
  private inFlightWritePromise: Promise<void> | null = null
  private lastBackupTime = 0
  private recoveryRequired = false

  constructor(customUserDataPath?: string) {
    if (customUserDataPath) {
      this.userDataPath = customUserDataPath
    } else {
      try {
        this.userDataPath = app.getPath('userData')
      } catch {
        this.userDataPath = process.cwd()
      }
    }

    this.dataFilePath = join(this.userDataPath, DATA_FILE_NAME)
    if (!existsSync(this.userDataPath)) {
      mkdirSync(this.userDataPath, { recursive: true })
    }
  }

  public getDataFilePath(): string {
    return this.dataFilePath
  }

  public getUserDataPath(): string {
    return this.userDataPath
  }

  public isRecoveryRequired(): boolean {
    return this.recoveryRequired
  }

  public getInitialData(): StorageInitialResult {
    if (!existsSync(this.dataFilePath)) {
      const initial: AppData = {
        schemaVersion: SCHEMA_VERSION,
        projects: [],
        cards: [],
        settings: { ...DEFAULT_SETTINGS },
        lastModified: new Date().toISOString()
      }
      this.saveDirect(initial)
      return { data: initial, recoveryRequired: false }
    }

    try {
      const content = readFileSync(this.dataFilePath, 'utf-8')
      const parsed = JSON.parse(content)

      // Auto-migrate if Schema V1
      if (isSchemaV1(parsed)) {
        console.warn('Detected Schema v1 data file. Performing pre-migration backup and upgrading to v2...')
        const v1BackupPath = join(
          this.userDataPath,
          `tasks_data_v1_backup_${Date.now()}.json`
        )
        try {
          copyFileSync(this.dataFilePath, v1BackupPath)
        } catch (bkErr) {
          console.warn('Failed to write explicit v1 backup snapshot:', bkErr)
        }

        const migrated = migrateV1ToV2(parsed)
        this.saveDirect(migrated)
        this.recoveryRequired = false
        return { data: migrated, recoveryRequired: false }
      }

      const validated = AppDataSchema.parse(parsed)
      if (!validated.cards) {
        validated.cards = validated.projects
      }
      this.recoveryRequired = false
      return { data: validated, recoveryRequired: false }
    } catch (err) {
      console.error('Data file corrupted or invalid schema:', err)
      // Preserve the corrupted file with timestamp
      const corruptedPath = join(
        this.userDataPath,
        `tasks_data.corrupted.${Date.now()}.json`
      )
      try {
        copyFileSync(this.dataFilePath, corruptedPath)
      } catch (backupErr) {
        console.error('Failed to preserve corrupted file:', backupErr)
      }

      // Try recovering from newest valid backup
      const backups = this.getBackupFiles()
      for (const backup of backups) {
        try {
          const backupContent = readFileSync(backup.path, 'utf-8')
          const backupParsed = JSON.parse(backupContent)
          let backupValidated: AppData
          if (isSchemaV1(backupParsed)) {
            backupValidated = migrateV1ToV2(backupParsed)
          } else {
            backupValidated = AppDataSchema.parse(backupParsed)
            if (!backupValidated.cards) {
              backupValidated.cards = backupValidated.projects
            }
          }
          console.warn(`Recovered data from valid backup: ${backup.name}`)
          this.saveDirect(backupValidated)
          this.recoveryRequired = false
          return {
            data: backupValidated,
            recoveredFromBackup: true,
            isCorrupted: true,
            recoveryRequired: false
          }
        } catch {
          // Backup is also invalid, try next older backup
        }
      }

      // If all backups fail, enter recovery mode!
      // Do NOT overwrite corrupted file with empty data!
      this.recoveryRequired = true
      const fallback: AppData = {
        schemaVersion: SCHEMA_VERSION,
        projects: [],
        cards: [],
        settings: { ...DEFAULT_SETTINGS },
        lastModified: new Date().toISOString()
      }
      return {
        data: fallback,
        isCorrupted: true,
        recoveryRequired: true
      }
    }
  }

  public async saveData(data: AppData, forceBackup: boolean = false): Promise<boolean> {
    if (this.recoveryRequired) {
      console.warn('Save blocked: Storage is in recovery mode to prevent overwriting corrupted data.')
      return false
    }

    return new Promise<boolean>((resolve, reject) => {
      if (this.pendingBatch) {
        this.pendingBatch.data = data
        this.pendingBatch.forceBackup = this.pendingBatch.forceBackup || forceBackup
        this.pendingBatch.resolves.push(resolve)
        this.pendingBatch.rejects.push(reject)
      } else {
        this.pendingBatch = {
          data,
          forceBackup,
          resolves: [resolve],
          rejects: [reject]
        }
      }
      this.triggerProcessing()
    })
  }

  private triggerProcessing(): void {
    if (this.isWriting) return
    this.isWriting = true

    this.inFlightWritePromise = (async () => {
      try {
        while (this.pendingBatch) {
          const current = this.pendingBatch
          this.pendingBatch = null

          try {
            await this.writeAtomicWithBackup(current.data, current.forceBackup)
            current.resolves.forEach((res) => res(true))
          } catch (err) {
            console.error('Failed to write storage to disk:', err)
            current.rejects.forEach((rej) => rej(err))
          }
        }
      } finally {
        this.isWriting = false
        this.inFlightWritePromise = null
      }
    })()
  }

  public async flush(): Promise<boolean> {
    while (this.pendingBatch || this.isWriting) {
      if (this.inFlightWritePromise) {
        try {
          await this.inFlightWritePromise
        } catch {
          // ignore error in flush
        }
      } else {
        this.triggerProcessing()
      }
    }
    return true
  }

  public async initializeCleanAfterCorruption(): Promise<AppData> {
    const cleanData: AppData = {
      schemaVersion: SCHEMA_VERSION,
      projects: [],
      cards: [],
      settings: { ...DEFAULT_SETTINGS },
      lastModified: new Date().toISOString()
    }
    await this.flush()
    this.recoveryRequired = false
    const success = await this.saveData(cleanData, true)
    if (!success) {
      throw new Error('Failed to persist clean data')
    }
    return cleanData
  }

  private saveDirect(data: AppData): void {
    const json = JSON.stringify(data, null, 2)
    writeFileSync(this.dataFilePath, json, 'utf-8')
  }

  private async replaceFileAtomically(tempFile: string, targetFile: string): Promise<void> {
    if (!existsSync(targetFile)) {
      renameSync(tempFile, targetFile)
      return
    }

    // Target file exists. Retry renameSync for Windows transient locks (Defender, indexing)
    const maxRetries = 5
    let lastErr: any = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        renameSync(tempFile, targetFile)
        return
      } catch (err: any) {
        lastErr = err
        if (err?.code === 'EPERM' || err?.code === 'EBUSY' || err?.code === 'EEXIST') {
          await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)))
        } else {
          break
        }
      }
    }

    // Rename failed after retries. Fall back to safe rollback copy.
    // NEVER overwrite targetFile directly without a verified rollback copy!
    const rollbackFile = `${targetFile}.rollback.${Date.now()}`
    try {
      copyFileSync(targetFile, rollbackFile)
    } catch (rbErr) {
      try {
        unlinkSync(tempFile)
      } catch {}
      throw new Error(`Failed to create rollback backup before replacing file: ${rbErr}`)
    }

    try {
      copyFileSync(tempFile, targetFile)
      // Succeeded! Clean up rollback and temp
      try {
        unlinkSync(rollbackFile)
      } catch {}
      try {
        unlinkSync(tempFile)
      } catch {}
    } catch (copyErr) {
      // Failed! Immediately restore targetFile from rollbackFile
      try {
        copyFileSync(rollbackFile, targetFile)
        unlinkSync(rollbackFile)
      } catch {}
      try {
        unlinkSync(tempFile)
      } catch {}
      throw new Error(`Atomic write failed; original file restored from rollback: ${copyErr}`)
    }
  }

  private async writeAtomicWithBackup(data: AppData, forceBackup: boolean = false): Promise<void> {
    if (!data.cards && data.projects) {
      data.cards = data.projects
    }
    if (!data.projects && data.cards) {
      data.projects = data.cards
    }
    // Validate schema before writing to disk
    AppDataSchema.parse(data)

    const json = JSON.stringify(data, null, 2)
    const tempFile = join(
      this.userDataPath,
      `${DATA_FILE_NAME}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    )

    // Write temp file
    writeFileSync(tempFile, json, 'utf-8')

    // If main data file exists, check whether to rotate backup
    if (existsSync(this.dataFilePath)) {
      const now = Date.now()
      if (forceBackup || now - this.lastBackupTime >= BACKUP_INTERVAL_MS) {
        this.rotateBackups()
        this.lastBackupTime = now
      }
    }

    // Atomic rename with Windows retry and rollback
    await this.replaceFileAtomically(tempFile, this.dataFilePath)
  }

  private rotateBackups(): void {
    try {
      // Before creating backup.1, verify current tasks_data.json is valid JSON
      if (!existsSync(this.dataFilePath)) return
      const currentContent = readFileSync(this.dataFilePath, 'utf-8')
      try {
        const parsed = JSON.parse(currentContent)
        if (!isSchemaV1(parsed)) {
          AppDataSchema.parse(parsed)
        }
      } catch {
        // If current file is somehow invalid, do NOT copy it over valid backups!
        console.warn('Skipping backup rotation: current file is invalid JSON')
        return
      }

      // Shift older backups
      for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
        const src = join(this.userDataPath, `tasks_data.backup.${i}.json`)
        const dst = join(this.userDataPath, `tasks_data.backup.${i + 1}.json`)
        if (existsSync(src)) {
          if (existsSync(dst)) {
            try {
              unlinkSync(dst)
            } catch {
              // ignore
            }
          }
          try {
            renameSync(src, dst)
          } catch {
            try {
              copyFileSync(src, dst)
              unlinkSync(src)
            } catch {}
          }
        }
      }

      // Backup current file to backup.1
      const backup1 = join(this.userDataPath, `tasks_data.backup.1.json`)
      copyFileSync(this.dataFilePath, backup1)

      // Prune excess backups
      const excess = join(this.userDataPath, `tasks_data.backup.${MAX_BACKUPS + 1}.json`)
      if (existsSync(excess)) {
        unlinkSync(excess)
      }
    } catch (err) {
      console.warn('Backup rotation warning:', err)
    }
  }

  public getBackupFiles(): BackupFileInfo[] {
    try {
      const files = readdirSync(this.userDataPath)
      const backups: BackupFileInfo[] = []

      for (const file of files) {
        const isBackup = /^tasks_data\.backup\.\d+\.json$/.test(file)
        const isPreImport = /^tasks_data\.pre_import\.\d+\.json$/.test(file)

        if (isBackup || isPreImport) {
          const filePath = join(this.userDataPath, file)
          try {
            const stat = statSync(filePath)
            backups.push({
              name: file,
              path: filePath,
              time: stat.mtime.toISOString(),
              size: stat.size,
              mtimeMs: stat.mtimeMs
            })
          } catch {
            // Ignore file read error
          }
        }
      }

      // Sort by actual file modification time descending (newest first)
      backups.sort((a, b) => b.mtimeMs - a.mtimeMs)
      return backups
    } catch {
      return []
    }
  }

  public async restoreFromBackup(backupName: string): Promise<AppData> {
    // P1-07: Strict validation of backupName to prevent path traversal
    const validPattern = /^tasks_data\.(backup\.\d+|pre_import\.\d+)\.json$/
    if (!validPattern.test(backupName)) {
      throw new Error(`Invalid backup filename format: ${backupName}`)
    }

    const resolvedPath = resolve(this.userDataPath, backupName)
    const expectedDir = resolve(this.userDataPath)
    if (!resolvedPath.startsWith(expectedDir)) {
      throw new Error(`Path traversal rejected: ${backupName}`)
    }

    if (!existsSync(resolvedPath)) {
      throw new Error(`Backup file does not exist: ${backupName}`)
    }

    const content = readFileSync(resolvedPath, 'utf-8')
    const parsed = JSON.parse(content)
    let validated: AppData
    if (isSchemaV1(parsed)) {
      validated = migrateV1ToV2(parsed)
    } else {
      validated = AppDataSchema.parse(parsed)
      if (!validated.cards) {
        validated.cards = validated.projects
      }
    }

    await this.flush()
    this.recoveryRequired = false
    const success = await this.saveData(validated, true)
    if (!success) {
      throw new Error('Failed to persist restored data')
    }
    return validated
  }

  public async importData(jsonContent: string): Promise<AppData> {
    const parsed = JSON.parse(jsonContent)
    let validated: AppData
    if (isSchemaV1(parsed)) {
      validated = migrateV1ToV2(parsed)
    } else {
      validated = AppDataSchema.parse(parsed)
      if (!validated.cards) {
        validated.cards = validated.projects
      }
    }

    await this.flush()

    // Create an explicit pre-import backup if data file exists
    if (existsSync(this.dataFilePath)) {
      const preImportBackup = join(
        this.userDataPath,
        `tasks_data.pre_import.${Date.now()}.json`
      )
      try {
        copyFileSync(this.dataFilePath, preImportBackup)
      } catch (err) {
        console.warn('Failed to create pre-import backup:', err)
      }
    }

    this.recoveryRequired = false
    const success = await this.saveData(validated, true)
    if (!success) {
      throw new Error('Failed to persist imported data')
    }
    return validated
  }

  public exportData(): string {
    if (!existsSync(this.dataFilePath)) {
      return JSON.stringify(
        {
          schemaVersion: 2,
          projects: [],
          cards: [],
          settings: DEFAULT_SETTINGS,
          lastModified: new Date().toISOString()
        },
        null,
        2
      )
    }
    return readFileSync(this.dataFilePath, 'utf-8')
  }

  public getNotifiedRounds(): Set<string> {
    const notifiedPath = join(this.userDataPath, 'notified_rounds.json')
    if (existsSync(notifiedPath)) {
      try {
        const content = readFileSync(notifiedPath, 'utf-8')
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          return new Set(parsed)
        }
      } catch {
        // ignore parse error
      }
    }
    return new Set<string>()
  }

  public markRoundNotified(roundKey: string): void {
    const rounds = this.getNotifiedRounds()
    rounds.add(roundKey)
    const notifiedPath = join(this.userDataPath, 'notified_rounds.json')
    try {
      writeFileSync(notifiedPath, JSON.stringify(Array.from(rounds)), 'utf-8')
    } catch (err) {
      console.warn('Failed to persist notified round:', err)
    }
  }
}
