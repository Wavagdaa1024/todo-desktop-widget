import { z } from 'zod'

export type TaskNodeStatus = 'TODO' | 'IN_PROGRESS' | 'WAITING_REVIEW' | 'BLOCKED' | 'ACCEPTED'
export type OwnerType = 'SELF' | 'GEMINI' | 'CODEX' | 'OTHER'
export type TaskEventType =
  | 'ASSIGNED'
  | 'STARTED'
  | 'PROGRESS'
  | 'BLOCKED'
  | 'RESUMED'
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'

// Legacy status type retained for backward-compatibility during transition
export type CardStatus = 'TODO' | 'AI_RUNNING' | 'WAITING_ACCEPT' | 'BLOCKED' | 'DONE'

export interface TaskEvent {
  id: string
  roundId: string
  timestamp: string // ISO timestamp
  source: OwnerType
  type: TaskEventType
  summary: string
  changedFiles?: string
  testResults?: string
  blockerReason?: string
  nextAction?: string
}

export interface ExecutionRound {
  id: string
  roundNumber: number
  owner: OwnerType
  startTime: string // ISO timestamp
  endTime?: string // ISO timestamp
  conclusion?: 'ACCEPTED' | 'REJECTED' | 'ABORTED'
  reviewNote?: string
}

export interface TaskItem {
  id: string
  title: string
  completed?: boolean
  notes?: string
  dueDate?: string // YYYY-MM-DD
  order: number
  children: TaskItem[]
  createdAt: string
  updatedAt: string
  status?: TaskNodeStatus
  owner?: OwnerType
  acceptanceCriteria?: string
  migrationNote?: string
  rounds?: ExecutionRound[]
  events?: TaskEvent[]
  parents?: string[]
  completedAt?: string
}

export interface TaskNode extends TaskItem {
  status: TaskNodeStatus
  owner: OwnerType
  rounds: ExecutionRound[]
  events: TaskEvent[]
  children: TaskNode[]
  parents?: string[]
  completedAt?: string
}

// Legacy progress log interface
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

export interface Project<T extends TaskItem = TaskItem> {
  id: string
  title: string
  category?: string
  description?: string
  dueDate?: string // YYYY-MM-DD
  order: number
  collapsed: boolean
  tasklineHistoryCollapsed?: boolean
  tasks: T[]
  legacyAiHistory?: ProgressLog[]
  legacyAiArchive?: {
    lastOwner?: OwnerType
    lastStatus?: string
    currentTaskDescription?: string
    recentProgress?: string
    currentBlockers?: string
    nextAction?: string
  }
  createdAt: string
  updatedAt: string
  // Compatibility properties
  status: CardStatus
  owner: OwnerType
  aiWork: {
    activeStartTime?: string
    currentTaskDescription?: string
    recentProgress?: string
    currentBlockers?: string
    nextAction?: string
    history: ProgressLog[]
  }
}

// Aliases for seamless backward compatibility
export type Card = Project

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  closeToTray: boolean
  autoStart: boolean
  alwaysOnTop: boolean
  aiWaitReminderThreshold: number // minutes: 0, 15, 30, 60 or custom
  hasSeenTrayNotice: boolean
}

export interface AppData {
  schemaVersion: 1 | 2
  projects: Project[]
  cards: Project[] // Alias for backward compatibility
  settings: AppSettings
  lastModified: string
  revision?: number
}

export interface StorageInitialResult {
  data: AppData
  recoveredFromBackup?: boolean
  isCorrupted?: boolean
  recoveryRequired?: boolean
}

// Zod Schemas for Runtime Validation
export const TaskEventSchema = z.object({
  id: z.string(),
  roundId: z.string(),
  timestamp: z.string(),
  source: z.enum(['SELF', 'GEMINI', 'CODEX', 'OTHER']),
  type: z.enum([
    'ASSIGNED',
    'STARTED',
    'PROGRESS',
    'BLOCKED',
    'RESUMED',
    'SUBMITTED',
    'ACCEPTED',
    'REJECTED'
  ]),
  summary: z.string(),
  changedFiles: z.string().optional(),
  testResults: z.string().optional(),
  blockerReason: z.string().optional(),
  nextAction: z.string().optional()
})

export const ExecutionRoundSchema = z.object({
  id: z.string(),
  roundNumber: z.number(),
  owner: z.enum(['SELF', 'GEMINI', 'CODEX', 'OTHER']),
  startTime: z.string(),
  endTime: z.string().optional(),
  conclusion: z.enum(['ACCEPTED', 'REJECTED', 'ABORTED']).optional(),
  reviewNote: z.string().optional()
})

export const TaskNodeSchema: z.ZodType<TaskNode, z.ZodTypeDef, any> = z.lazy(() =>
  z
    .object({
      id: z.string(),
      title: z.string(),
      status: z
        .enum(['TODO', 'IN_PROGRESS', 'WAITING_REVIEW', 'BLOCKED', 'ACCEPTED'])
        .optional()
        .default('TODO'),
      owner: z.enum(['SELF', 'GEMINI', 'CODEX', 'OTHER']).optional().default('SELF'),
      acceptanceCriteria: z.string().optional(),
      notes: z.string().optional(),
      dueDate: z.string().optional(),
      order: z.number(),
      children: z.array(TaskNodeSchema),
      rounds: z.array(ExecutionRoundSchema).optional().default([]),
      events: z.array(TaskEventSchema).optional().default([]),
      parents: z.array(z.string()).optional().default([]),
      completedAt: z.string().optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
      migrationNote: z.string().optional(),
      completed: z.boolean().optional()
    })
    .transform((val) => {
      let status = val.status
      if (val.completed !== undefined) {
        if (val.completed && status === 'TODO') {
          status = 'ACCEPTED'
        } else if (!val.completed && status === 'ACCEPTED') {
          status = 'TODO'
        }
      }
      return {
        ...val,
        status,
        completed: status === 'ACCEPTED'
      }
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

export const ProjectSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  order: z.number().optional().default(0),
  collapsed: z.boolean().optional().default(false),
  tasklineHistoryCollapsed: z.boolean().optional().default(true),
  tasks: z.array(TaskNodeSchema).default([]),
  legacyAiHistory: z.array(ProgressLogSchema).optional(),
  legacyAiArchive: z
    .object({
      lastOwner: z.enum(['SELF', 'GEMINI', 'CODEX', 'OTHER']).optional(),
      lastStatus: z.string().optional(),
      currentTaskDescription: z.string().optional(),
      recentProgress: z.string().optional(),
      currentBlockers: z.string().optional(),
      nextAction: z.string().optional()
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(['TODO', 'AI_RUNNING', 'WAITING_ACCEPT', 'BLOCKED', 'DONE']).optional().default('TODO'),
  owner: z.enum(['SELF', 'GEMINI', 'CODEX', 'OTHER']).optional().default('SELF'),
  aiWork: z
    .object({
      activeStartTime: z.string().optional(),
      currentTaskDescription: z.string().optional(),
      recentProgress: z.string().optional(),
      currentBlockers: z.string().optional(),
      nextAction: z.string().optional(),
      history: z.array(ProgressLogSchema).default([])
    })
    .optional()
    .default({ history: [] })
})

export const CardSchema = ProjectSchema
export const TaskItemSchema = TaskNodeSchema

export const AppSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  closeToTray: z.boolean(),
  autoStart: z.boolean(),
  alwaysOnTop: z.boolean(),
  aiWaitReminderThreshold: z.number(),
  hasSeenTrayNotice: z.boolean()
})

export const AppDataSchema = z
  .object({
    schemaVersion: z.union([z.literal(1), z.literal(2)]).default(2),
    projects: z.array(ProjectSchema).optional().default([]),
    cards: z.array(ProjectSchema).optional().default([]),
    settings: AppSettingsSchema,
    lastModified: z.string(),
    revision: z.number().optional()
  })
  .transform((val) => {
    const list = val.projects.length > 0 ? val.projects : val.cards
    return {
      ...val,
      projects: list,
      cards: list
    }
  })

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  closeToTray: true,
  autoStart: false,
  alwaysOnTop: false,
  aiWaitReminderThreshold: 30,
  hasSeenTrayNotice: false
}
