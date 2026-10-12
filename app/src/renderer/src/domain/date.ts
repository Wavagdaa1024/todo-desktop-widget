import { Card } from './types'
import { getAllLeaves } from './calculator'

export function getTodayDateString(ref: Date = new Date()): string {
  const year = ref.getFullYear()
  const month = String(ref.getMonth() + 1).padStart(2, '0')
  const day = String(ref.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export type DueDateStatus = 'OVERDUE' | 'TODAY' | 'FUTURE' | 'NONE'

export function getDueDateStatus(
  dueDate?: string,
  isCompleted: boolean = false,
  todayStr: string = getTodayDateString()
): DueDateStatus {
  if (isCompleted || !dueDate) {
    return 'NONE'
  }
  const cleanDate = dueDate.trim()
  if (!cleanDate) {
    return 'NONE'
  }
  if (cleanDate < todayStr) {
    return 'OVERDUE'
  }
  if (cleanDate === todayStr) {
    return 'TODAY'
  }
  return 'FUTURE'
}

export function isCardOverdue(card: Card, todayStr: string = getTodayDateString()): boolean {
  if (card.status === 'DONE') {
    return false
  }
  // Check card itself
  if (card.dueDate && getDueDateStatus(card.dueDate, false, todayStr) === 'OVERDUE') {
    return true
  }
  // Check uncompleted leaves
  const leaves = getAllLeaves(card.tasks)
  for (const leaf of leaves) {
    if (!leaf.completed && leaf.dueDate && getDueDateStatus(leaf.dueDate, false, todayStr) === 'OVERDUE') {
      return true
    }
  }
  return false
}

export function formatDueDateBadge(
  dueDate?: string,
  isCompleted: boolean = false,
  todayStr: string = getTodayDateString()
): { text: string; status: DueDateStatus } | null {
  const status = getDueDateStatus(dueDate, isCompleted, todayStr)
  if (!dueDate || status === 'NONE') return null

  if (status === 'OVERDUE') {
    return { text: `逾期 (${dueDate})`, status }
  }
  if (status === 'TODAY') {
    return { text: `今天到期`, status }
  }
  return { text: dueDate, status }
}
