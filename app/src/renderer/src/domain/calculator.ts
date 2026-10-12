import { TaskItem } from './types'

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
  doneLeaves: number
  percentage: number
}

export function calculateProgress(tasks: TaskItem[]): ProgressResult {
  const leaves = getAllLeaves(tasks)
  const totalLeaves = leaves.length
  const doneLeaves = leaves.filter((leaf) => leaf.completed).length
  const percentage = totalLeaves === 0 ? 0 : Math.round((doneLeaves / totalLeaves) * 100)
  return {
    totalLeaves,
    doneLeaves,
    percentage
  }
}

export type CheckState = 'checked' | 'unchecked' | 'indeterminate'

export function getNodeCheckState(task: TaskItem): CheckState {
  if (isLeaf(task)) {
    return task.completed ? 'checked' : 'unchecked'
  }
  const leaves = getAllLeaves([task])
  if (leaves.length === 0) {
    return 'unchecked'
  }
  const doneCount = leaves.filter((l) => l.completed).length
  if (doneCount === leaves.length) {
    return 'checked'
  }
  if (doneCount === 0) {
    return 'unchecked'
  }
  return 'indeterminate'
}

function cloneTasks(tasks: TaskItem[]): TaskItem[] {
  return JSON.parse(JSON.stringify(tasks))
}

function setAllLeavesCompletion(task: TaskItem, completed: boolean): void {
  if (isLeaf(task)) {
    task.completed = completed
  } else {
    for (const child of task.children) {
      setAllLeavesCompletion(child, completed)
    }
  }
}

export function toggleTask(
  tasks: TaskItem[],
  targetId: string
): { updatedTasks: TaskItem[]; previousTasks: TaskItem[] } {
  const previousTasks = cloneTasks(tasks)
  const nextTasks = cloneTasks(tasks)

  function applyToggle(list: TaskItem[]): boolean {
    for (const item of list) {
      if (item.id === targetId) {
        if (isLeaf(item)) {
          item.completed = !item.completed
          item.updatedAt = new Date().toISOString()
        } else {
          const currentState = getNodeCheckState(item)
          const targetValue = currentState !== 'checked'
          setAllLeavesCompletion(item, targetValue)
          item.updatedAt = new Date().toISOString()
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

export function addTaskToParent(
  tasks: TaskItem[],
  parentId: string | null,
  newTitle: string,
  options?: { notes?: string; dueDate?: string }
): TaskItem[] {
  const trimmed = newTitle.trim()
  if (!trimmed) return tasks

  const nextTasks = cloneTasks(tasks)
  const now = new Date().toISOString()
  const newId = 'task_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now()

  if (parentId === null) {
    // Add top-level task
    const newTask: TaskItem = {
      id: newId,
      title: trimmed,
      completed: false,
      notes: options?.notes,
      dueDate: options?.dueDate,
      order: nextTasks.length,
      children: [],
      createdAt: now,
      updatedAt: now
    }
    nextTasks.push(newTask)
    return nextTasks
  }

  function findAndAdd(list: TaskItem[]): boolean {
    for (const item of list) {
      if (item.id === parentId) {
        const wasLeaf = isLeaf(item)
        const inheritedCompleted = wasLeaf ? item.completed : false

        const newTask: TaskItem = {
          id: newId,
          title: trimmed,
          completed: inheritedCompleted,
          notes: options?.notes,
          dueDate: options?.dueDate,
          order: item.children ? item.children.length : 0,
          children: [],
          createdAt: now,
          updatedAt: now
        }

        if (!item.children) {
          item.children = []
        }
        item.children.push(newTask)
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

export function updateTaskItem(
  tasks: TaskItem[],
  targetId: string,
  updates: Partial<Pick<TaskItem, 'title' | 'notes' | 'dueDate'>>
): TaskItem[] {
  const nextTasks = cloneTasks(tasks)
  const now = new Date().toISOString()

  function findAndUpdate(list: TaskItem[]): boolean {
    for (const item of list) {
      if (item.id === targetId) {
        if (updates.title !== undefined) {
          const t = updates.title.trim()
          if (!t) return false // Prevent empty title
          item.title = t
        }
        if (updates.notes !== undefined) {
          item.notes = updates.notes
        }
        if (updates.dueDate !== undefined) {
          item.dueDate = updates.dueDate
        }
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

export function deleteTaskItem(
  tasks: TaskItem[],
  targetId: string
): { updatedTasks: TaskItem[]; deletedTask: TaskItem | null } {
  const nextTasks = cloneTasks(tasks)
  let deleted: TaskItem | null = null

  function recursiveDelete(list: TaskItem[], parent: TaskItem | null): boolean {
    const index = list.findIndex((t) => t.id === targetId)
    if (index !== -1) {
      deleted = list.splice(index, 1)[0]
      // Re-order siblings
      list.forEach((t, i) => {
        t.order = i
      })
      if (parent && isLeaf(parent)) {
        // Parent became a leaf again!
        // Derivation strategy: if deleted task was completed, we keep completed true; otherwise false
        parent.completed = deleted.completed
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
  return { updatedTasks: nextTasks, deletedTask: deleted }
}

export function reorderSiblingTasks(
  tasks: TaskItem[],
  parentId: string | null,
  activeId: string,
  overId: string
): TaskItem[] {
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
