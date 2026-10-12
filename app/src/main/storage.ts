import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, renameSync, copyFileSync, readdirSync, unlinkSync, mkdirSync } from 'fs'
import { AppData, AppDataSchema, DEFAULT_SETTINGS } from '../renderer/src/domain/types'

const SCHEMA_VERSION = 1
const DATA_FILE_NAME = 'tasks_data.json'
const MAX_BACKUPS = 5

export class StorageService {
  private userDataPath: string
  private dataFilePath: string
  private isWriting = false
  private pendingData: AppData | null = null

  constructor() {
    this.userDataPath = app.getPath('userData')
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

  public getInitialData(): { data: AppData; recoveredFromBackup?: boolean; isCorrupted?: boolean } {
    if (!existsSync(this.dataFilePath)) {
      const initial: AppData = {
        schemaVersion: SCHEMA_VERSION,
        cards: [],
        settings: { ...DEFAULT_SETTINGS },
        lastModified: new Date().toISOString()
      }
      this.saveDirect(initial)
      return { data: initial }
    }

    try {
      const content = readFileSync(this.dataFilePath, 'utf-8')
      const parsed = JSON.parse(content)
      const validated = AppDataSchema.parse(parsed)
      return { data: validated }
    } catch (err) {
      console.error('Data file corrupted or invalid schema:', err)
      // Backup the corrupted file
      const corruptedPath = join(
        this.userDataPath,
        `tasks_data.corrupted.${Date.now()}.json`
      )
      try {
        copyFileSync(this.dataFilePath, corruptedPath)
      } catch (backupErr) {
        console.error('Failed to preserve corrupted file:', backupErr)
      }

      // Try recovering from latest valid backup
      const backups = this.getBackupFiles()
      for (const backup of backups) {
        try {
          const backupContent = readFileSync(backup.path, 'utf-8')
          const backupParsed = JSON.parse(backupContent)
          const backupValidated = AppDataSchema.parse(backupParsed)
          console.warn(`Recovered data from backup: ${backup.name}`)
          this.saveDirect(backupValidated)
          return { data: backupValidated, recoveredFromBackup: true, isCorrupted: true }
        } catch {
          // Continue to next backup
        }
      }

      // If all backups fail, fallback to clean state without overwriting corrupted file
      const fallback: AppData = {
        schemaVersion: SCHEMA_VERSION,
        cards: [],
        settings: { ...DEFAULT_SETTINGS },
        lastModified: new Date().toISOString()
      }
      return { data: fallback, isCorrupted: true }
    }
  }

  public async saveData(data: AppData): Promise<boolean> {
    this.pendingData = data
    if (this.isWriting) {
      return true
    }

    this.isWriting = true
    try {
      while (this.pendingData) {
        const toSave = this.pendingData
        this.pendingData = null
        await this.writeAtomicWithBackup(toSave)
      }
      return true
    } catch (err) {
      console.error('Failed to save data:', err)
      return false
    } finally {
      this.isWriting = false
    }
  }

  private saveDirect(data: AppData): void {
    const json = JSON.stringify(data, null, 2)
    writeFileSync(this.dataFilePath, json, 'utf-8')
  }

  private async writeAtomicWithBackup(data: AppData): Promise<void> {
    // Validate schema before writing to disk
    AppDataSchema.parse(data)

    const json = JSON.stringify(data, null, 2)
    const tempFile = join(this.userDataPath, `${DATA_FILE_NAME}.tmp.${Date.now()}`)

    // Write temp file
    writeFileSync(tempFile, json, 'utf-8')

    // If main data file exists and is valid, create/rotate backup
    if (existsSync(this.dataFilePath)) {
      this.rotateBackups()
    }

    // Atomic rename
    renameSync(tempFile, this.dataFilePath)
  }

  private rotateBackups(): void {
    try {
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

  public getBackupFiles(): Array<{ name: string; path: string; time: string; size: number }> {
    try {
      const files = readdirSync(this.userDataPath)
      const backups: Array<{ name: string; path: string; time: string; size: number }> = []

      for (const file of files) {
        if (file.startsWith('tasks_data.backup.') && file.endsWith('.json')) {
          const filePath = join(this.userDataPath, file)
          try {
            const stat = readFileSync(filePath)
            backups.push({
              name: file,
              path: filePath,
              time: new Date().toISOString(),
              size: stat.byteLength
            })
          } catch {
            // Ignore
          }
        }
      }
      return backups
    } catch {
      return []
    }
  }

  public restoreFromBackup(backupName: string): AppData {
    const backupPath = join(this.userDataPath, backupName)
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file ${backupName} does not exist`)
    }

    const content = readFileSync(backupPath, 'utf-8')
    const parsed = JSON.parse(content)
    const validated = AppDataSchema.parse(parsed)

    // Save as current data with fresh backup
    this.writeAtomicWithBackup(validated)
    return validated
  }

  public importData(jsonContent: string): AppData {
    const parsed = JSON.parse(jsonContent)
    const validated = AppDataSchema.parse(parsed)

    // Create an explicit pre-import backup
    if (existsSync(this.dataFilePath)) {
      const preImportBackup = join(
        this.userDataPath,
        `tasks_data.pre_import.${Date.now()}.json`
      )
      copyFileSync(this.dataFilePath, preImportBackup)
    }

    this.writeAtomicWithBackup(validated)
    return validated
  }

  public exportData(): string {
    if (!existsSync(this.dataFilePath)) {
      return JSON.stringify({ schemaVersion: 1, cards: [], settings: DEFAULT_SETTINGS, lastModified: new Date().toISOString() }, null, 2)
    }
    return readFileSync(this.dataFilePath, 'utf-8')
  }
}
