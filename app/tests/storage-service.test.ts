import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StorageService } from '../src/main/storage'
import { AppData, DEFAULT_SETTINGS } from '../src/renderer/src/domain/types'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('StorageService (P0 & P1-07 Regression Tests)', () => {
  let tempDir: string
  let storage: StorageService

  const sampleData: AppData = {
    schemaVersion: 1,
    projects: [],
    cards: [
      {
        id: 'c-1',
        title: 'Original Task',
        status: 'TODO',
        owner: 'SELF',
        order: 0,
        collapsed: false,
        tasks: [],
        aiWork: { history: [] },
        createdAt: '2026-10-12T00:00:00Z',
        updatedAt: '2026-10-12T00:00:00Z'
      }
    ],
    settings: { ...DEFAULT_SETTINGS },
    lastModified: '2026-10-12T00:00:00Z'
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'todo-storage-test-'))
    storage = new StorageService(tempDir)
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore
    }
  })

  it('P0-01: importData creates pre-import backup and atomically saves data', async () => {
    // Save original data first
    await storage.saveData(sampleData)

    const importedData: AppData = {
      ...sampleData,
      cards: [
        {
          id: 'c-imported',
          title: 'Imported Project',
          status: 'AI_RUNNING',
          owner: 'GEMINI',
          order: 0,
          collapsed: false,
          tasks: [],
          aiWork: { history: [] },
          createdAt: '2026-10-12T01:00:00Z',
          updatedAt: '2026-10-12T01:00:00Z'
        }
      ]
    }

    const result = await storage.importData(JSON.stringify(importedData))
    expect(result.cards[0].id).toBe('c-imported')

    // Verify written to disk
    const onDisk = JSON.parse(readFileSync(storage.getDataFilePath(), 'utf-8'))
    expect(onDisk.cards[0].id).toBe('c-imported')

    // Verify pre-import backup was created
    const backups = storage.getBackupFiles()
    expect(backups.some((b) => b.name.startsWith('tasks_data.pre_import.'))).toBe(true)
  })

  it('P0-02: corrupted file sets recoveryRequired and prevents auto-save from overwriting', async () => {
    // Write corrupted JSON to data file
    writeFileSync(storage.getDataFilePath(), '{"invalid_json": true, schemaVersion', 'utf-8')

    // Load initial data
    const initial = storage.getInitialData()
    expect(initial.isCorrupted).toBe(true)
    expect(initial.recoveryRequired).toBe(true)
    expect(storage.isRecoveryRequired()).toBe(true)

    // Attempting auto-save with empty fallback must be BLOCKED!
    const emptyFallback: AppData = {
      schemaVersion: 1,
      projects: [],
      cards: [],
      settings: DEFAULT_SETTINGS,
      lastModified: new Date().toISOString()
    }

    const saved = await storage.saveData(emptyFallback)
    expect(saved).toBe(false) // Save rejected!

    // Verify file on disk is still the corrupted file (not overwritten by empty data)
    const content = readFileSync(storage.getDataFilePath(), 'utf-8')
    expect(content).toContain('invalid_json')
  })

  it('P0-04: getBackupFiles sorts by actual mtime and includes pre_import backups', async () => {
    const backup1Path = join(tempDir, 'tasks_data.backup.1.json')
    const preImportPath = join(tempDir, 'tasks_data.pre_import.12345.json')

    writeFileSync(backup1Path, JSON.stringify(sampleData), 'utf-8')
    writeFileSync(preImportPath, JSON.stringify(sampleData), 'utf-8')

    const backups = storage.getBackupFiles()
    expect(backups.length).toBe(2)
    expect(backups[0].time).toBeDefined()
    expect(typeof backups[0].size).toBe('number')
  })

  it('P1-07: restoreFromBackup rejects path traversal and invalid filename patterns', async () => {
    // Path traversal attempt
    await expect(storage.restoreFromBackup('../some_file.json')).rejects.toThrow()
    await expect(storage.restoreFromBackup('arbitrary.json')).rejects.toThrow()
    await expect(storage.restoreFromBackup('../../etc/passwd')).rejects.toThrow()
  })

  it('P1-07: restoreFromBackup successfully restores valid backup', async () => {
    const backupData: AppData = {
      ...sampleData,
      cards: [{ ...sampleData.cards[0], title: 'Backup Task' }]
    }
    const backupFile = 'tasks_data.backup.1.json'
    writeFileSync(join(tempDir, backupFile), JSON.stringify(backupData), 'utf-8')

    const restored = await storage.restoreFromBackup(backupFile)
    expect(restored.cards[0].title).toBe('Backup Task')

    const onDisk = JSON.parse(readFileSync(storage.getDataFilePath(), 'utf-8'))
    expect(onDisk.cards[0].title).toBe('Backup Task')
  })

  it('Optimization: initializeCleanAfterCorruption resets state and enables saving', async () => {
    writeFileSync(storage.getDataFilePath(), 'corrupted { json', 'utf-8')
    storage.getInitialData()
    expect(storage.isRecoveryRequired()).toBe(true)

    const clean = await storage.initializeCleanAfterCorruption()
    expect(clean.cards.length).toBe(0)
    expect(storage.isRecoveryRequired()).toBe(false)

    // Now save works normally
    const saved = await storage.saveData(sampleData)
    expect(saved).toBe(true)
  })

  it('P0-03: concurrent saveData calls resolve only after disk write settles and flush waits', async () => {
    const data1: AppData = {
      ...sampleData,
      cards: [{ ...sampleData.cards[0], title: 'Version 1' }]
    }
    const data2: AppData = {
      ...sampleData,
      cards: [{ ...sampleData.cards[0], title: 'Version 2' }]
    }
    const data3: AppData = {
      ...sampleData,
      cards: [{ ...sampleData.cards[0], title: 'Version 3' }]
    }

    // Fire 3 saves concurrently
    const p1 = storage.saveData(data1)
    const p2 = storage.saveData(data2)
    const p3 = storage.saveData(data3)

    // flush should wait for all 3 to finish
    await storage.flush()
    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    expect(r1).toBe(true)
    expect(r2).toBe(true)
    expect(r3).toBe(true)

    // Final data on disk must reflect the latest state
    const onDisk = JSON.parse(readFileSync(storage.getDataFilePath(), 'utf-8'))
    expect(onDisk.cards[0].title).toBe('Version 3')
  })

  it('P1-04: notified rounds persist across restarts in notified_rounds.json', () => {
    storage.markRoundNotified('round_1_active')
    storage.markRoundNotified('round_2_active')

    // Create a new StorageService instance pointing to the same folder
    const storage2 = new StorageService(tempDir)
    const rounds = storage2.getNotifiedRounds()

    expect(rounds.has('round_1_active')).toBe(true)
    expect(rounds.has('round_2_active')).toBe(true)
    expect(rounds.has('unnotified_round')).toBe(false)
  })
})
