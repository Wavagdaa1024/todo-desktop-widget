import { describe, it, expect } from 'vitest'
import { AppDataSchema, DEFAULT_SETTINGS, AppData } from '../src/renderer/src/domain/types'

describe('Storage Domain & Validation', () => {
  it('validates a complete valid AppData object', () => {
    const validData: AppData = {
      schemaVersion: 1,
      cards: [
        {
          id: 'card-1',
          title: 'Simulation Project',
          category: 'Robotics',
          description: 'MuJoCo + FMU simulation',
          status: 'AI_RUNNING',
          owner: 'GEMINI',
          dueDate: '2026-10-20',
          order: 0,
          collapsed: false,
          tasks: [
            {
              id: 't-1',
              title: 'Subtask 1',
              completed: false,
              order: 0,
              children: [],
              createdAt: '2026-10-12T00:00:00Z',
              updatedAt: '2026-10-12T00:00:00Z'
            }
          ],
          aiWork: {
            activeStartTime: '2026-10-12T10:00:00Z',
            currentTaskDescription: 'Debugging step size',
            recentProgress: 'Mapped signals',
            history: []
          },
          createdAt: '2026-10-12T00:00:00Z',
          updatedAt: '2026-10-12T00:00:00Z'
        }
      ],
      settings: { ...DEFAULT_SETTINGS },
      lastModified: '2026-10-12T10:00:00Z'
    }

    const parsed = AppDataSchema.parse(validData)
    expect(parsed.cards.length).toBe(1)
    expect(parsed.schemaVersion).toBe(1)
  })

  it('rejects data with invalid schema version', () => {
    const invalid = {
      schemaVersion: 2, // only version 1 supported currently
      cards: [],
      settings: DEFAULT_SETTINGS,
      lastModified: '2026'
    }

    expect(() => AppDataSchema.parse(invalid)).toThrow()
  })

  it('rejects data with missing required fields in cards', () => {
    const invalidCard = {
      schemaVersion: 1,
      cards: [
        {
          id: 'card-1',
          // missing title
          status: 'TODO'
        }
      ],
      settings: DEFAULT_SETTINGS,
      lastModified: '2026'
    }

    expect(() => AppDataSchema.parse(invalidCard)).toThrow()
  })
})
