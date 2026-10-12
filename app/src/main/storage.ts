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

const SCHEMA_VERSION = 1
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

export class StorageService {
  private userDataPath: string
  private dataFilePath: string
  private isWriting = false
  private pendingData: AppData | null = null
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
      const validated = AppDataSchema.parse(parsed)
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
          const backupValidated = AppDataSchema.parse(backupParsed)
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

  public async saveData(data: AppData): Promise<boolean> {
    if (this.recoveryRequired) {
      console.warn('Save blocked: Storage is in recovery mode to prevent overwriting corrupted data.')
      return false
    }

    this.pendingData = data
    if (this.isWriting) {
      return true
    }

    this.isWriting = true
    try {
      while (this.pendingData) {
        const toSave = this.pendingData
        this.pendingData = null
        await this.writeAtomicWithBackup(toSave, false)
      }
      return true
    } catch (err) {
      console.error('Failed to save data:', err)
      return false
    } finally {
      this.isWriting = false
    }
  }

  public async flush(): Promise<boolean> {
    if (this.pendingData) {
      const toSave = this.pendingData
      this.pendingData = null
      try {
        await this.writeAtomicWithBackup(toSave, false)
        return true
      } catch (err) {
        console.error('Failed to flush storage:', err)
        return false
      }
    }
    return true
  }

  public async initializeCleanAfterCorruption(): Promise<AppData> {
    const cleanData: AppData = {
      schemaVersion: SCHEMA_VERSION,
      cards: [],
      settings: { ...DEFAULT_SETTINGS },
      lastModified: new Date().toISOString()
    }
    this.recoveryRequired = false
    await this.writeAtomicWithBackup(cleanData, true)
    return cleanData
  }

  private saveDirect(data: AppData): void {
    const json = JSON.stringify(data, null, 2)
    writeFileSync(this.dataFilePath, json, 'utf-8')
  }

  private async writeAtomicWithBackup(data: AppData, forceBackup: boolean = false): Promise<void> {
    // Validate schema before writing to disk
    AppDataSchema.parse(data)

    const json = JSON.stringify(data, null, 2)
    const tempFile = join(this.userDataPath, `${DATA_FILE_NAME}.tmp.${Date.now()}`)

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

    // Atomic rename
    renameSync(tempFile, this.dataFilePath)
  }

  private rotateBackups(): void {
    try {
      // Before creating backup.1, verify current tasks_data.json is valid JSON
      if (!existsSync(this.dataFilePath)) return
      const currentContent = readFileSync(this.dataFilePath, 'utf-8')
      try {
        const parsed = JSON.parse(currentContent)
        AppDataSchema.parse(parsed)
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
          renameSync(src, dst)
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
    const validated = AppDataSchema.parse(parsed)

    // Save as current data with forced backup
    this.recoveryRequired = false
    await this.writeAtomicWithBackup(validated, true)
    return validated
  }

  public async importData(jsonContent: string): Promise<AppData> {
    const parsed = JSON.parse(jsonContent)
    const validated = AppDataSchema.parse(parsed)

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
    await this.writeAtomicWithBackup(validated, true)
    return validated
  }

  public exportData(): string {
    if (!existsSync(this.dataFilePath)) {
      return JSON.stringify(
        {
          schemaVersion: 1,
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
}
