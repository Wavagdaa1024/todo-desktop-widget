import { z } from 'zod'

export type CardStatus = 'TODO' | 'AI_RUNNING' | 'WAITING_ACCEPT' | 'BLOCKED' | 'DONE'
export type OwnerType = 'SELF' | 'GEMINI' | 'CODEX' | 'OTHER'

export interface TaskItem {
  id: string
  title: string
  completed: boolean
  notes?: string
  dueDate?: string // YYYY-MM-DD
  order: number
  children: TaskItem[]
  createdAt: string
  updatedAt: string
}

export interface ProgressLog {
  id: string
  timestamp: string
  source: OwnerType
  summary: string
  changedFiles?: string
  testResults?: string
  blockers?: string
  nextAction?: string
}

export interface Card {
  id: string
  title: string
  category?: string
  description?: string
  status: CardStatus
  owner: OwnerType
  dueDate?: string // YYYY-MM-DD
  order: number
  collapsed: boolean
  tasks: TaskItem[]
  aiWork: {
    activeStartTime?: string // ISO timestamp
    currentTaskDescription?: string
    recentProgress?: string
    currentBlockers?: string
    nextAction?: string
    history: ProgressLog[]
  }
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  closeToTray: boolean
  autoStart: boolean
  alwaysOnTop: boolean
  aiWaitReminderThreshold: number // minutes: 0, 15, 30, 60 or custom
  hasSeenTrayNotice: boolean
}

export interface AppData {
  schemaVersion: 1
  cards: Card[]
  settings: AppSettings
  lastModified: string
}

export interface StorageInitialResult {
  data: AppData
  recoveredFromBackup?: boolean
  isCorrupted?: boolean
  recoveryRequired?: boolean
}

// Zod Schemas for Runtime Validation
export const TaskItemSchema: z.ZodType<TaskItem> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: z.string(),
    completed: z.boolean(),
    notes: z.string().optional(),
    dueDate: z.string().optional(),
    order: z.number(),
    children: z.array(TaskItemSchema),
    createdAt: z.string(),
    updatedAt: z.string()
  })
)

export const ProgressLogSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  source: z.enum(['SELF', 'GEMINI', 'CODEX', 'OTHER']),
  summary: z.string(),
  changedFiles: z.string().optional(),
  testResults: z.string().optional(),
  blockers: z.string().optional(),
  nextAction: z.string().optional()
})

export const CardSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['TODO', 'AI_RUNNING', 'WAITING_ACCEPT', 'BLOCKED', 'DONE']),
  owner: z.enum(['SELF', 'GEMINI', 'CODEX', 'OTHER']),
  dueDate: z.string().optional(),
  order: z.number(),
  collapsed: z.boolean(),
  tasks: z.array(TaskItemSchema),
  aiWork: z.object({
    activeStartTime: z.string().optional(),
    currentTaskDescription: z.string().optional(),
    recentProgress: z.string().optional(),
    currentBlockers: z.string().optional(),
    nextAction: z.string().optional(),
    history: z.array(ProgressLogSchema)
  }),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const AppSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  closeToTray: z.boolean(),
  autoStart: z.boolean(),
  alwaysOnTop: z.boolean(),
  aiWaitReminderThreshold: z.number(),
  hasSeenTrayNotice: z.boolean()
})

export const AppDataSchema = z.object({
  schemaVersion: z.literal(1),
  cards: z.array(CardSchema),
  settings: AppSettingsSchema,
  lastModified: z.string()
})

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  closeToTray: true,
  autoStart: false,
  alwaysOnTop: false,
  aiWaitReminderThreshold: 30,
  hasSeenTrayNotice: false
}
