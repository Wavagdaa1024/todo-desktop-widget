import {
  TaskItem,
  TaskNode,
  Project,
  OwnerType,
  ExecutionRound,
  TaskEvent
} from './types'

export function isLeaf(task: TaskItem): boolean {
  return !task.children || task.children.length === 0
}

export function getAllLeaves(tasks: TaskItem[]): TaskItem[] {
  const leaves: TaskItem[] = []
  function traverse(list: TaskItem[]) {
    for (const item of list) {
      if (isLeaf(item)) {
        leaves.push(item)
      } else {
        traverse(item.children)
      }
    }
  }
  traverse(tasks)
  return leaves
}

export interface ProgressResult {
  totalLeaves: number
  doneLeaves: number // Alias for acceptedLeaves
  acceptedLeaves: number
  inProgressLeaves: number
  waitingReviewLeaves: number
  blockedLeaves: number
  todoLeaves: number
  percentage: number
}

/**
 * Calculates project progress based strictly on accepted leaf nodes.
 * Unreviewed AI submissions (WAITING_REVIEW) do NOT increment progress.
 */
export function calculateProgress(tasks: TaskItem[]): ProgressResult {
  const leaves = getAllLeaves(tasks)
  const totalLeaves = leaves.length
  const isAccepted = (l: TaskItem) => l.status === 'ACCEPTED' || (!l.status && l.completed === true)
  const acceptedLeaves = leaves.filter(isAccepted).length
  const inProgressLeaves = leaves.filter((l) => l.status === 'IN_PROGRESS').length
  const waitingReviewLeaves = leaves.filter((l) => l.status === 'WAITING_REVIEW').length
  const blockedLeaves = leaves.filter((l) => l.status === 'BLOCKED').length
  const todoLeaves = leaves.filter((l) => l.status === 'TODO' || (!l.status && !l.completed)).length
  const percentage = totalLeaves === 0 ? 0 : Math.round((acceptedLeaves / totalLeaves) * 100)

  const result = {
    totalLeaves,
    doneLeaves: acceptedLeaves,
    percentage
  }

  Object.defineProperties(result, {
    acceptedLeaves: { value: acceptedLeaves, enumerable: false, writable: true },
    inProgressLeaves: { value: inProgressLeaves, enumerable: false, writable: true },
    waitingReviewLeaves: { value: waitingReviewLeaves, enumerable: false, writable: true },
    blockedLeaves: { value: blockedLeaves, enumerable: false, writable: true },
    todoLeaves: { value: todoLeaves, enumerable: false, writable: true }
  })

  return result as ProgressResult
}

export type CheckState = 'checked' | 'unchecked' | 'indeterminate'

export function getNodeCheckState(task: TaskItem): CheckState {
  const isAccepted = (t: TaskItem) => t.status === 'ACCEPTED' || (!t.status && t.completed === true)
  if (isLeaf(task)) {
    return isAccepted(task) ? 'checked' : 'unchecked'
  }
  const leaves = getAllLeaves([task])
  if (leaves.length === 0) {
    return 'unchecked'
  }
  const acceptedCount = leaves.filter(isAccepted).length
  if (acceptedCount === leaves.length) {
    return 'checked'
  }
  if (acceptedCount === 0) {
    return 'unchecked'
  }
  return 'indeterminate'
}

function cloneTasks<T extends TaskItem>(tasks: T[]): T[] {
  return JSON.parse(JSON.stringify(tasks))
}

function setAllLeavesStatus(task: TaskItem, accepted: boolean): void {
  const now = new Date().toISOString()
  task.rounds = task.rounds || []
  task.events = task.events || []
  if (isLeaf(task)) {
    if (accepted && task.status !== 'ACCEPTED') {
      task.status = 'ACCEPTED'
      task.completed = true
      const roundId = `round_manual_${Date.now()}`
      task.rounds = [
        ...task.rounds,
        {
          id: roundId,
          roundNumber: task.rounds.length + 1,
          owner: task.owner || 'SELF',
          startTime: now,
          endTime: now,
          conclusion: 'ACCEPTED',
          reviewNote: '直接确认完成'
        }
      ]
      task.events = [
        ...task.events,
        {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          roundId,
          timestamp: now,
          source: 'SELF',
          type: 'ACCEPTED',
          summary: '确认完成'
        }
      ]
    } else if (!accepted && task.status === 'ACCEPTED') {
      task.status = 'TODO'
      task.completed = false
      task.events = [
        ...task.events,
        {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          roundId: task.rounds[task.rounds.length - 1]?.id || `round_${Date.now()}`,
          timestamp: now,
          source: 'SELF',
          type: 'STARTED',
          summary: '重新打开任务'
        }
      ]
    }
    task.updatedAt = now
  } else {
    for (const child of task.children || []) {
      setAllLeavesStatus(child, accepted)
    }
  }
}

/**
 * Toggles leaf task between ACCEPTED and TODO.
 * User-executed tasks can be directly accepted or reopened.
 */
export function toggleTask<T extends TaskItem>(
  tasks: T[],
  targetId: string
): { updatedTasks: T[]; previousTasks: T[] } {
  const previousTasks = cloneTasks(tasks)
  const nextTasks = cloneTasks(tasks)
  const now = new Date().toISOString()

  function applyToggle(list: TaskItem[]): boolean {
    for (const item of list) {
      if (item.id === targetId) {
        item.rounds = item.rounds || []
        item.events = item.events || []
        if (isLeaf(item)) {
          const isCurrentlyAccepted = item.status === 'ACCEPTED' || (!item.status && item.completed === true)
          if (isCurrentlyAccepted) {
            item.status = 'TODO'
            item.completed = false
            item.events.push({
              id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              roundId: item.rounds[item.rounds.length - 1]?.id || `round_${Date.now()}`,
              timestamp: now,
              source: 'SELF',
              type: 'STARTED',
              summary: '重新开启任务'
            })
          } else {
            item.status = 'ACCEPTED'
            item.completed = true
            const roundId = `round_direct_${Date.now()}`
            item.rounds.push({
              id: roundId,
              roundNumber: item.rounds.length + 1,
              owner: item.owner || 'SELF',
              startTime: now,
              endTime: now,
              conclusion: 'ACCEPTED',
              reviewNote: '直接确认完成'
            })
            item.events.push({
              id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              roundId,
              timestamp: now,
              source: 'SELF',
              type: 'ACCEPTED',
              summary: '直接确认完成'
            })
          }
          item.updatedAt = now
        } else {
          const currentState = getNodeCheckState(item)
          const targetValue = currentState !== 'checked'
          setAllLeavesStatus(item, targetValue)
          item.updatedAt = now
        }
        return true
      }
      if (item.children && item.children.length > 0) {
        if (applyToggle(item.children)) {
          return true
        }
      }
    }
    return false
  }

  applyToggle(nextTasks)
  return { updatedTasks: nextTasks, previousTasks }
}

export function addNodeToParent<T extends TaskItem>(
  tasks: T[],
  parentId: string | null,
  newTitle: string,
  options?: {
    owner?: OwnerType
    notes?: string
    dueDate?: string
    acceptanceCriteria?: string
  }
): T[] {
  const trimmed = newTitle.trim()
  if (!trimmed) return tasks

  const nextTasks = cloneTasks(tasks)
  const now = new Date().toISOString()
  const newId = 'task_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now()

  const newNode: TaskNode = {
    id: newId,
    title: trimmed,
    status: 'TODO',
    owner: options?.owner || 'SELF',
    notes: options?.notes,
    dueDate: options?.dueDate,
    acceptanceCriteria: options?.acceptanceCriteria,
    order: 0,
    parentId: parentId || undefined,
    parents: parentId ? [parentId] : [],
    children: [],
    rounds: [],
    events: [],
    createdAt: now,
    updatedAt: now,
    completed: false
  }

  if (parentId === null) {
    newNode.order = nextTasks.length
    nextTasks.push(newNode as unknown as T)
    return nextTasks
  }

  function findAndAdd(list: TaskItem[]): boolean {
    for (const item of list) {
      if (item.id === parentId) {
        const wasLeaf = isLeaf(item)
        const inheritedCompleted = wasLeaf ? item.status === 'ACCEPTED' || Boolean(item.completed) : false
        if (!item.children) {
          item.children = []
        }
        newNode.parentId = item.id
        newNode.parents = [item.id]
        newNode.status = inheritedCompleted ? 'ACCEPTED' : 'TODO'
        newNode.completed = inheritedCompleted
        newNode.order = item.children.length
        item.children.push(newNode as unknown as T)
        item.updatedAt = now
        return true
      }
      if (item.children && item.children.length > 0) {
        if (findAndAdd(item.children)) {
          return true
        }
      }
    }
    return false
  }

  findAndAdd(nextTasks)
  return nextTasks
}

export function updateTaskNode<T extends TaskItem>(
  tasks: T[],
  targetId: string,
  updates: Partial<TaskItem>
): T[] {
  const nextTasks = cloneTasks(tasks)
  const now = new Date().toISOString()

  function findAndUpdate(list: TaskItem[]): boolean {
    for (const item of list) {
      if (item.id === targetId) {
        if (updates.title !== undefined) {
          const t = updates.title.trim()
          if (!t) return false
          item.title = t
        }
        if (updates.owner !== undefined) item.owner = updates.owner
        if (updates.status !== undefined) {
          item.status = updates.status
          item.completed = updates.status === 'ACCEPTED'
        }
        if (updates.notes !== undefined) item.notes = updates.notes
        if (updates.dueDate !== undefined) item.dueDate = updates.dueDate
        if (updates.acceptanceCriteria !== undefined) item.acceptanceCriteria = updates.acceptanceCriteria
        item.updatedAt = now
        return true
      }
      if (item.children && item.children.length > 0) {
        if (findAndUpdate(item.children)) {
          return true
        }
      }
    }
    return false
  }

  findAndUpdate(nextTasks)
  return nextTasks
}

export interface DeleteTaskResult<T extends TaskItem = TaskItem> {
  updatedTasks: T[]
  deletedTask: T | null
  parentId: string | null
  originalIndex: number
}

export function deleteTaskNode<T extends TaskItem>(
  tasks: T[],
  targetId: string
): DeleteTaskResult<T> {
  const nextTasks = cloneTasks(tasks)
  let deleted: T | null = null
  let parentId: string | null = null
  let originalIndex = -1

  function recursiveDelete(list: TaskItem[], parent: TaskItem | null): boolean {
    const index = list.findIndex((t) => t.id === targetId)
    if (index !== -1) {
      originalIndex = index
      parentId = parent ? parent.id : null
      deleted = list.splice(index, 1)[0] as T
      list.forEach((t, i) => {
        t.order = i
      })
      if (parent && isLeaf(parent)) {
        parent.status = deleted.status || (deleted.completed ? 'ACCEPTED' : 'TODO')
        parent.completed = deleted.status === 'ACCEPTED' || Boolean(deleted.completed)
        parent.updatedAt = new Date().toISOString()
      }
      return true
    }
    for (const item of list) {
      if (item.children && item.children.length > 0) {
        if (recursiveDelete(item.children, item)) {
          return true
        }
      }
    }
    return false
  }

  recursiveDelete(nextTasks, null)
  return { updatedTasks: nextTasks, deletedTask: deleted, parentId, originalIndex }
}

export function restoreTaskNode<T extends TaskItem>(
  tasks: T[],
  itemToRestore: T,
  parentId: string | null,
  index: number
): T[] {
  const nextTasks = cloneTasks(tasks)

  function recursiveRestore(list: TaskItem[], currentParentId: string | null): boolean {
    if (currentParentId === parentId) {
      if (list.some((t) => t.id === itemToRestore.id)) return true
      const targetIdx = Math.min(Math.max(0, index), list.length)
      list.splice(targetIdx, 0, cloneTasks([itemToRestore])[0])
      list.forEach((t, i) => {
        t.order = i
      })
      return true
    }
    for (const item of list) {
      if (item.id === parentId) {
        if (!item.children) item.children = []
        if (item.children.some((t) => t.id === itemToRestore.id)) return true
        const targetIdx = Math.min(Math.max(0, index), item.children.length)
        item.children.splice(targetIdx, 0, cloneTasks([itemToRestore])[0])
        item.children.forEach((t, i) => {
          t.order = i
        })
        return true
      }
      if (item.children && item.children.length > 0) {
        if (recursiveRestore(item.children, item.id)) {
          return true
        }
      }
    }
    return false
  }

  recursiveRestore(nextTasks, null)
  return nextTasks
}

export function reorderSiblingNodes<T extends TaskItem>(
  tasks: T[],
  parentId: string | null,
  activeId: string,
  overId: string
): T[] {
  if (activeId === overId) return tasks
  const nextTasks = cloneTasks(tasks)

  function getList(list: TaskItem[]): TaskItem[] | null {
    if (parentId === null) return list
    for (const item of list) {
      if (item.id === parentId) return item.children
      if (item.children && item.children.length > 0) {
        const found = getList(item.children)
        if (found) return found
      }
    }
    return null
  }

  const siblings = getList(nextTasks)
  if (!siblings) return tasks

  const oldIndex = siblings.findIndex((t) => t.id === activeId)
  const newIndex = siblings.findIndex((t) => t.id === overId)
  if (oldIndex === -1 || newIndex === -1) return tasks

  const [moved] = siblings.splice(oldIndex, 1)
  siblings.splice(newIndex, 0, moved)
  siblings.forEach((t, i) => {
    t.order = i
  })

  return nextTasks
}

// Node Execution Lifecycle Helpers (R1 & R2)
export function startNodeExecution(
  node: TaskNode,
  owner: OwnerType
): TaskNode {
  const updated = cloneTasks([node])[0]
  updated.rounds = updated.rounds || []
  updated.events = updated.events || []
  const now = new Date().toISOString()
  const roundId = `round_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`

  const newRound: ExecutionRound = {
    id: roundId,
    roundNumber: updated.rounds.length + 1,
    owner,
    startTime: now
  }

  const newEvent: TaskEvent = {
    id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    roundId,
    timestamp: now,
    source: owner,
    type: 'STARTED',
    summary: `开始第 ${newRound.roundNumber} 轮执行`
  }

  updated.owner = owner
  updated.status = 'IN_PROGRESS'
  updated.rounds.push(newRound)
  updated.events.push(newEvent)
  updated.updatedAt = now
  return updated
}

export function appendNodeProgress(
  node: TaskNode,
  payload: {
    summary: string
    source?: OwnerType
    changedFiles?: string
    testResults?: string
    nextAction?: string
  }
): TaskNode {
  const updated = cloneTasks([node])[0]
  updated.rounds = updated.rounds || []
  updated.events = updated.events || []
  const now = new Date().toISOString()
  const currentRound = updated.rounds[updated.rounds.length - 1]
  const roundId = currentRound ? currentRound.id : `round_${Date.now()}`

  const newEvent: TaskEvent = {
    id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    roundId,
    timestamp: now,
    source: payload.source || updated.owner || 'SELF',
    type: 'PROGRESS',
    summary: payload.summary,
    changedFiles: payload.changedFiles,
    testResults: payload.testResults,
    nextAction: payload.nextAction
  }

  updated.events.push(newEvent)
  updated.updatedAt = now
  return updated
}

export function blockNode(
  node: TaskNode,
  blockerReason: string,
  source?: OwnerType
): TaskNode {
  const updated = cloneTasks([node])[0]
  updated.rounds = updated.rounds || []
  updated.events = updated.events || []
  const now = new Date().toISOString()
  const currentRound = updated.rounds[updated.rounds.length - 1]
  const roundId = currentRound ? currentRound.id : `round_${Date.now()}`

  const newEvent: TaskEvent = {
    id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    roundId,
    timestamp: now,
    source: source || updated.owner || 'SELF',
    type: 'BLOCKED',
    summary: '遇到阻塞',
    blockerReason
  }

  updated.status = 'BLOCKED'
  updated.events.push(newEvent)
  updated.updatedAt = now
  return updated
}

export function resumeNode(
  node: TaskNode,
  source?: OwnerType
): TaskNode {
  const updated = cloneTasks([node])[0]
  updated.rounds = updated.rounds || []
  updated.events = updated.events || []
  const now = new Date().toISOString()
  const currentRound = updated.rounds[updated.rounds.length - 1]
  const roundId = currentRound ? currentRound.id : `round_${Date.now()}`

  const newEvent: TaskEvent = {
    id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    roundId,
    timestamp: now,
    source: source || updated.owner || 'SELF',
    type: 'RESUMED',
    summary: '恢复执行'
  }

  updated.status = 'IN_PROGRESS'
  updated.events.push(newEvent)
  updated.updatedAt = now
  return updated
}

export function submitNodeForReview(
  node: TaskNode,
  payload: {
    summary: string
    source?: OwnerType
    changedFiles?: string
    testResults?: string
    nextAction?: string
  }
): TaskNode {
  const updated = cloneTasks([node])[0]
  updated.rounds = updated.rounds || []
  updated.events = updated.events || []
  const now = new Date().toISOString()
  const currentRound = updated.rounds[updated.rounds.length - 1]
  const roundId = currentRound ? currentRound.id : `round_${Date.now()}`

  const newEvent: TaskEvent = {
    id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    roundId,
    timestamp: now,
    source: payload.source || updated.owner || 'SELF',
    type: 'SUBMITTED',
    summary: payload.summary,
    changedFiles: payload.changedFiles,
    testResults: payload.testResults,
    nextAction: payload.nextAction
  }

  updated.status = 'WAITING_REVIEW'
  updated.events.push(newEvent)
  updated.updatedAt = now
  return updated
}

export function acceptNodeReview(
  node: TaskNode,
  reviewNote?: string
): TaskNode {
  const updated = cloneTasks([node])[0]
  updated.rounds = updated.rounds || []
  updated.events = updated.events || []
  const now = new Date().toISOString()
  const currentRound = updated.rounds[updated.rounds.length - 1]
  if (currentRound) {
    currentRound.endTime = now
    currentRound.conclusion = 'ACCEPTED'
    currentRound.reviewNote = reviewNote
  }

  const roundId = currentRound ? currentRound.id : `round_${Date.now()}`
  const newEvent: TaskEvent = {
    id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    roundId,
    timestamp: now,
    source: 'SELF',
    type: 'ACCEPTED',
    summary: reviewNote ? `人工验收通过: ${reviewNote}` : '人工验收通过'
  }

  updated.status = 'ACCEPTED'
  updated.completed = true
  updated.events.push(newEvent)
  updated.updatedAt = now
  return updated
}

export function rejectNodeReview(
  node: TaskNode,
  rejectionReason: string
): TaskNode {
  const updated = cloneTasks([node])[0]
  updated.rounds = updated.rounds || []
  updated.events = updated.events || []
  const now = new Date().toISOString()
  const currentRound = updated.rounds[updated.rounds.length - 1]
  if (currentRound) {
    currentRound.endTime = now
    currentRound.conclusion = 'REJECTED'
    currentRound.reviewNote = rejectionReason
  }

  const roundId = currentRound ? currentRound.id : `round_${Date.now()}`
  const newEvent: TaskEvent = {
    id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    roundId,
    timestamp: now,
    source: 'SELF',
    type: 'REJECTED',
    summary: `退回修改: ${rejectionReason}`
  }

  updated.status = 'TODO'
  updated.completed = false
  updated.events.push(newEvent)
  updated.updatedAt = now
  return updated
}

export function reorderProjects(
  projects: Project[],
  targetProjectId: string,
  direction: 'up' | 'down'
): Project[] {
  const sorted = [...projects].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex((c) => c.id === targetProjectId)
  if (idx === -1) return projects

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= sorted.length) return projects

  const [moved] = sorted.splice(idx, 1)
  sorted.splice(targetIdx, 0, moved)
  sorted.forEach((c, i) => {
    c.order = i
  })
  return sorted
}

// Backward-compatibility aliases
export const addTaskToParent = addNodeToParent
export const updateTaskItem = <T extends TaskItem>(
  tasks: T[],
  targetId: string,
  updates: Partial<Pick<TaskItem, 'title' | 'notes' | 'dueDate'>>
): T[] => updateTaskNode(tasks, targetId, updates)
export const deleteTaskItem = deleteTaskNode
export const restoreTaskItem = restoreTaskNode
export const reorderSiblingTasks = reorderSiblingNodes
export const reorderCards = reorderProjects

export function reconcileCardStatus<T extends TaskItem = TaskItem>(card: Project<T>, newTasks?: T[]): Project<T> {
  const tasksToInspect = newTasks !== undefined ? newTasks : card.tasks
  let nextStatus = card.status
  if (card.status === 'DONE') {
    const prog = calculateProgress(tasksToInspect)
    if (prog.totalLeaves > 0 && prog.doneLeaves < prog.totalLeaves) {
      nextStatus = card.owner === 'SELF' ? 'TODO' : 'WAITING_ACCEPT'
    }
  }
  return {
    ...card,
    tasks: tasksToInspect,
    status: nextStatus
  }
}

/**
 * Automatically heals and ensures strict parent-child hierarchy across tasks and subtasks:
 * - Subtasks have parentId set to direct parent.id.
 * - Subtask DAG parents array is guaranteed to include direct parent.id so it is never positioned before parent.
 * - Parent status/progress can cascade cleanly.
 */
export function reconcileHierarchy<T extends TaskItem>(tasks: T[]): T[] {
  if (!Array.isArray(tasks)) return tasks

  function heal(list: TaskItem[], parent?: TaskItem): TaskItem[] {
    return list.map((item) => {
      const updated: TaskItem = { ...item }
      if (parent) {
        updated.parentId = parent.id
        const currentParents = Array.isArray(updated.parents) ? [...updated.parents] : []
        if (currentParents.length === 0) {
          updated.parents = [parent.id]
        } else if (!currentParents.includes(parent.id)) {
          updated.parents = [...currentParents, parent.id]
        }
      }
      if (Array.isArray(updated.children) && updated.children.length > 0) {
        updated.children = heal(updated.children, updated)
      }
      return updated
    })
  }

  return heal(tasks) as T[]
}

