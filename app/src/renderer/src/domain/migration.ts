import {
  AppData,
  Project,
  TaskNode,
  TaskNodeStatus,
  OwnerType,
  ExecutionRound,
  TaskEvent,
  DEFAULT_SETTINGS,
  AppDataSchema
} from './types'

export function isSchemaV1(data: any): boolean {
  if (!data || typeof data !== 'object') return false
  return data.schemaVersion === 1 || (Array.isArray(data.cards) && !Array.isArray(data.projects))
}

export function migrateV1ToV2(v1Data: any): AppData {
  if (!v1Data || typeof v1Data !== 'object') {
    return {
      schemaVersion: 2,
      projects: [],
      cards: [],
      settings: { ...DEFAULT_SETTINGS },
      lastModified: new Date().toISOString()
    }
  }

  const rawCards = Array.isArray(v1Data.cards) ? v1Data.cards : []

  const projects: Project[] = rawCards.map((card: any, cardIdx: number) => {
    const cardOwner: OwnerType =
      card.owner && ['SELF', 'GEMINI', 'CODEX', 'OTHER'].includes(card.owner)
        ? card.owner
        : 'SELF'

    function mapTasks(tasks: any[]): TaskNode[] {
      if (!Array.isArray(tasks)) return []

      return tasks.map((t, idx) => {
        const isCompleted = Boolean(t.completed)
        const nodeStatus: TaskNodeStatus = isCompleted ? 'ACCEPTED' : 'TODO'
        const initialEvents: TaskEvent[] = []
        const initialRounds: ExecutionRound[] = []
        const now = t.updatedAt || new Date().toISOString()
        const taskId = t.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

        if (isCompleted) {
          const roundId = `round_legacy_${taskId}`
          initialRounds.push({
            id: roundId,
            roundNumber: 1,
            owner: cardOwner,
            startTime: t.createdAt || now,
            endTime: now,
            conclusion: 'ACCEPTED',
            reviewNote: '旧版任务勾选完成 (历史数据安全迁移)'
          })
          initialEvents.push({
            id: `event_legacy_${taskId}`,
            roundId,
            timestamp: now,
            source: cardOwner,
            type: 'ACCEPTED',
            summary: '旧版完成勾选迁移'
          })
        }

        const node: TaskNode = {
          id: taskId,
          title: t.title || '未命名任务',
          status: nodeStatus,
          owner: cardOwner,
          notes: t.notes || undefined,
          dueDate: t.dueDate || undefined,
          order: typeof t.order === 'number' ? t.order : idx,
          children: mapTasks(t.children || []),
          rounds: initialRounds,
          events: initialEvents,
          createdAt: t.createdAt || new Date().toISOString(),
          updatedAt: t.updatedAt || new Date().toISOString(),
          migrationNote: isCompleted ? '旧版完成勾选迁移' : undefined,
          completed: isCompleted
        }

        return node
      })
    }

    const mappedTasks = mapTasks(card.tasks || [])

    const project: Project = {
      id: card.id || `proj_${Date.now()}_${cardIdx}`,
      title: card.title || `项目 ${cardIdx + 1}`,
      category: card.category || undefined,
      description: card.description || undefined,
      dueDate: card.dueDate || undefined,
      order: typeof card.order === 'number' ? card.order : cardIdx,
      collapsed: Boolean(card.collapsed),
      tasks: mappedTasks,
      legacyAiHistory: Array.isArray(card.aiWork?.history) ? card.aiWork.history : [],
      legacyAiArchive: {
        lastOwner: cardOwner,
        lastStatus: card.status,
        currentTaskDescription: card.aiWork?.currentTaskDescription,
        recentProgress: card.aiWork?.recentProgress,
        currentBlockers: card.aiWork?.currentBlockers,
        nextAction: card.aiWork?.nextAction
      },
      createdAt: card.createdAt || new Date().toISOString(),
      updatedAt: card.updatedAt || new Date().toISOString(),
      // Retain compatibility properties
      status: card.status || 'TODO',
      owner: cardOwner,
      aiWork: card.aiWork || { history: [] }
    }

    return project
  })

  const migrated: AppData = {
    schemaVersion: 2,
    projects,
    cards: projects,
    settings: v1Data.settings ? { ...DEFAULT_SETTINGS, ...v1Data.settings } : { ...DEFAULT_SETTINGS },
    lastModified: new Date().toISOString(),
    revision: (v1Data.revision || 0) + 1
  }

  // Strict runtime validation
  return AppDataSchema.parse(migrated)
}
