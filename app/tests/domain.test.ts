import { describe, it, expect } from 'vitest'
import {
  calculateProgress,
  getNodeCheckState,
  toggleTask,
  addTaskToParent,
  deleteTaskItem,
  restoreTaskItem,
  updateTaskItem,
  getAllLeaves,
  reorderCards,
  reconcileCardStatus
} from '../src/renderer/src/domain/calculator'
import { getDueDateStatus, isCardOverdue } from '../src/renderer/src/domain/date'
import { TaskItem, Card } from '../src/renderer/src/domain/types'

describe('Domain: Task Tree & Progress Calculation', () => {
  it('handles empty task tree with 0 leaves and 0%', () => {
    const res = calculateProgress([])
    expect(res).toEqual({ totalLeaves: 0, doneLeaves: 0, percentage: 0 })
  })

  it('matches plan.md Section 2.2 example: FMU + MuJoCo 3/6 = 50%', () => {
    const fmuTasks: TaskItem[] = [
      {
        id: 'p1',
        title: '检查 FMU',
        completed: false,
        order: 0,
        createdAt: '',
        updatedAt: '',
        children: [
          { id: 'l1', title: '确认 FMI 版本', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' },
          { id: 'l2', title: '检查输入输出变量', completed: true, order: 1, children: [], createdAt: '', updatedAt: '' }
        ]
      },
      {
        id: 'p2',
        title: 'MuJoCo 联调',
        completed: false,
        order: 1,
        createdAt: '',
        updatedAt: '',
        children: [
          { id: 'l3', title: '加载 MJCF 场景', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' },
          { id: 'l4', title: '实现信号交换', completed: false, order: 1, children: [], createdAt: '', updatedAt: '' },
          { id: 'l5', title: '验证时间步长同步', completed: false, order: 2, children: [], createdAt: '', updatedAt: '' }
        ]
      },
      {
        id: 'l6',
        title: '绘制仿真结果',
        completed: false,
        order: 2,
        children: [],
        createdAt: '',
        updatedAt: ''
      }
    ]

    const leaves = getAllLeaves(fmuTasks)
    expect(leaves.length).toBe(6)

    const res = calculateProgress(fmuTasks)
    expect(res.totalLeaves).toBe(6)
    expect(res.doneLeaves).toBe(3)
    expect(res.percentage).toBe(50)

    // Check parent check states
    expect(getNodeCheckState(fmuTasks[0])).toBe('checked') // p1: both l1 & l2 are completed
    expect(getNodeCheckState(fmuTasks[1])).toBe('indeterminate') // p2: l3 completed, l4 & l5 not
    expect(getNodeCheckState(fmuTasks[2])).toBe('unchecked') // l6: leaf uncompleted
  })

  it('toggleTask toggles leaf and updates percentage', () => {
    const tasks: TaskItem[] = [
      { id: 'l1', title: 'Task 1', completed: false, order: 0, children: [], createdAt: '', updatedAt: '' },
      { id: 'l2', title: 'Task 2', completed: false, order: 1, children: [], createdAt: '', updatedAt: '' }
    ]

    const { updatedTasks } = toggleTask(tasks, 'l1')
    expect(updatedTasks[0].completed).toBe(true)
    expect(calculateProgress(updatedTasks).percentage).toBe(50)

    // Toggle back
    const { updatedTasks: updated2 } = toggleTask(updatedTasks, 'l1')
    expect(updated2[0].completed).toBe(false)
    expect(calculateProgress(updated2).percentage).toBe(0)
  })

  it('toggleTask on parent sets all descendant leaves to true, and if all done, sets to false', () => {
    const tasks: TaskItem[] = [
      {
        id: 'parent',
        title: 'Parent',
        completed: false,
        order: 0,
        createdAt: '',
        updatedAt: '',
        children: [
          { id: 'c1', title: 'Child 1', completed: false, order: 0, children: [], createdAt: '', updatedAt: '' },
          { id: 'c2', title: 'Child 2', completed: true, order: 1, children: [], createdAt: '', updatedAt: '' }
        ]
      }
    ]

    // Initially indeterminate -> toggle parent should complete all children
    const { updatedTasks } = toggleTask(tasks, 'parent')
    expect(updatedTasks[0].children[0].completed).toBe(true)
    expect(updatedTasks[0].children[1].completed).toBe(true)
    expect(calculateProgress(updatedTasks).percentage).toBe(100)
    expect(getNodeCheckState(updatedTasks[0])).toBe('checked')

    // Toggling checked parent should uncheck all children
    const { updatedTasks: uncheckedAll } = toggleTask(updatedTasks, 'parent')
    expect(uncheckedAll[0].children[0].completed).toBe(false)
    expect(uncheckedAll[0].children[1].completed).toBe(false)
    expect(calculateProgress(uncheckedAll).percentage).toBe(0)
    expect(getNodeCheckState(uncheckedAll[0])).toBe('unchecked')
  })

  it('adding child to completed leaf preserves completion without silent loss (Section 2.2 Rule 6)', () => {
    const tasks: TaskItem[] = [
      { id: 't1', title: 'Previously Done Leaf', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' }
    ]

    const updated = addTaskToParent(tasks, 't1', 'New Child')
    expect(updated[0].children.length).toBe(1)
    expect(updated[0].children[0].completed).toBe(true)
    // Percentage remains 100%
    expect(calculateProgress(updated).percentage).toBe(100)
  })

  it('deleting child task until parent becomes leaf derives completed status (Section 2.2 Rule 7)', () => {
    const tasks: TaskItem[] = [
      {
        id: 'parent',
        title: 'Parent',
        completed: false,
        order: 0,
        createdAt: '',
        updatedAt: '',
        children: [
          { id: 'child', title: 'Child', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' }
        ]
      }
    ]

    const { updatedTasks } = deleteTaskItem(tasks, 'child')
    expect(updatedTasks[0].children.length).toBe(0)
    expect(updatedTasks[0].completed).toBe(true)
    expect(calculateProgress(updatedTasks).percentage).toBe(100)
  })
})

describe('Domain: Due Date & Overdue Calculation', () => {
  it('correctly determines yesterday, today, tomorrow', () => {
    const today = '2026-10-12'
    expect(getDueDateStatus('2026-10-11', false, today)).toBe('OVERDUE')
    expect(getDueDateStatus('2026-10-12', false, today)).toBe('TODAY')
    expect(getDueDateStatus('2026-10-13', false, today)).toBe('FUTURE')
  })

  it('never marks completed tasks as overdue', () => {
    const today = '2026-10-12'
    expect(getDueDateStatus('2026-10-11', true, today)).toBe('NONE')
  })

  it('determines card overdue based on card date or leaf task dates', () => {
    const today = '2026-10-12'
    const card: Card = {
      id: 'c1',
      title: 'Card 1',
      status: 'TODO',
      owner: 'SELF',
      order: 0,
      collapsed: false,
      tasks: [
        {
          id: 't1',
          title: 'Subtask',
          completed: false,
          dueDate: '2026-10-11', // Overdue leaf
          order: 0,
          children: [],
          createdAt: '',
          updatedAt: ''
        }
      ],
      aiWork: { history: [] },
      createdAt: '',
      updatedAt: ''
    }

    expect(isCardOverdue(card, today)).toBe(true)

    // If card status is DONE, it is not overdue
    card.status = 'DONE'
    expect(isCardOverdue(card, today)).toBe(false)
  })
})

describe('Domain: Card Reordering (P1-01)', () => {
  it('correctly reorders cards by stable ID regardless of initial array ordering', () => {
    const cards: Card[] = [
      {
        id: 'card-c',
        title: 'Card C',
        status: 'TODO',
        owner: 'SELF',
        order: 2,
        collapsed: false,
        tasks: [],
        aiWork: { history: [] },
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'card-a',
        title: 'Card A',
        status: 'TODO',
        owner: 'SELF',
        order: 0,
        collapsed: false,
        tasks: [],
        aiWork: { history: [] },
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'card-b',
        title: 'Card B',
        status: 'TODO',
        owner: 'SELF',
        order: 1,
        collapsed: false,
        tasks: [],
        aiWork: { history: [] },
        createdAt: '',
        updatedAt: ''
      }
    ]

    // Move 'card-b' up: it should swap with 'card-a'
    const reordered = reorderCards(cards, 'card-b', 'up')
    const sorted = [...reordered].sort((a, b) => a.order - b.order)
    expect(sorted[0].id).toBe('card-b')
    expect(sorted[1].id).toBe('card-a')
    expect(sorted[2].id).toBe('card-c')

    // Move 'card-b' up again (already at top): should return same order
    const topAgain = reorderCards(reordered, 'card-b', 'up')
    const sortedTop = [...topAgain].sort((a, b) => a.order - b.order)
    expect(sortedTop[0].id).toBe('card-b')

    // Move 'card-b' down: should swap back with 'card-a'
    const downResult = reorderCards(topAgain, 'card-b', 'down')
    const sortedDown = [...downResult].sort((a, b) => a.order - b.order)
    expect(sortedDown[0].id).toBe('card-a')
    expect(sortedDown[1].id).toBe('card-b')
    expect(sortedDown[2].id).toBe('card-c')
  })
})

describe('Domain: Card Status Reconciliation (P1-06)', () => {
  it('reverts DONE card to WAITING_ACCEPT if AI info is present and tasks become incomplete', () => {
    const card: Card = {
      id: 'c1',
      title: 'AI Task',
      status: 'DONE',
      owner: 'GEMINI',
      order: 0,
      collapsed: false,
      tasks: [
        { id: 't1', title: 'Task 1', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' }
      ],
      aiWork: { activeStartTime: '2026-10-12T00:00:00Z', history: [] },
      createdAt: '',
      updatedAt: ''
    }

    // New incomplete task added
    const updatedTasks: TaskItem[] = [
      { id: 't1', title: 'Task 1', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' },
      { id: 't2', title: 'New Task 2', completed: false, order: 1, children: [], createdAt: '', updatedAt: '' }
    ]

    const reconciled = reconcileCardStatus(card, updatedTasks)
    expect(reconciled.status).toBe('WAITING_ACCEPT')
    expect(reconciled.tasks.length).toBe(2)
  })

  it('reverts DONE card to TODO if no AI info is present and tasks become incomplete', () => {
    const card: Card = {
      id: 'c2',
      title: 'Manual Task',
      status: 'DONE',
      owner: 'SELF',
      order: 0,
      collapsed: false,
      tasks: [
        { id: 't1', title: 'Task 1', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' }
      ],
      aiWork: { history: [] },
      createdAt: '',
      updatedAt: ''
    }

    const updatedTasks: TaskItem[] = [
      { id: 't1', title: 'Task 1', completed: false, order: 0, children: [], createdAt: '', updatedAt: '' }
    ]

    const reconciled = reconcileCardStatus(card, updatedTasks)
    expect(reconciled.status).toBe('TODO')
  })

  it('leaves non-DONE cards untouched during reconciliation', () => {
    const card: Card = {
      id: 'c3',
      title: 'Running Task',
      status: 'AI_RUNNING',
      owner: 'CODEX',
      order: 0,
      collapsed: false,
      tasks: [],
      aiWork: { history: [] },
      createdAt: '',
      updatedAt: ''
    }

    const reconciled = reconcileCardStatus(card, [])
    expect(reconciled.status).toBe('AI_RUNNING')
  })

  it('Optimization: reorderCards preserves contiguous indices across order movements', () => {
    const cards: Card[] = [
      { id: 'c1', title: 'Task 1', status: 'TODO', owner: 'SELF', order: 0, collapsed: false, tasks: [], aiWork: { history: [] }, createdAt: '', updatedAt: '' },
      { id: 'c2', title: 'Task 2', status: 'TODO', owner: 'SELF', order: 1, collapsed: false, tasks: [], aiWork: { history: [] }, createdAt: '', updatedAt: '' },
      { id: 'c3', title: 'Task 3', status: 'TODO', owner: 'SELF', order: 2, collapsed: false, tasks: [], aiWork: { history: [] }, createdAt: '', updatedAt: '' }
    ]

    // Move c3 up
    const reordered = reorderCards(cards, 'c3', 'up')
    expect(reordered.map((c) => c.id)).toEqual(['c1', 'c3', 'c2'])
    expect(reordered.map((c) => c.order)).toEqual([0, 1, 2])

    // Move c1 down
    const reordered2 = reorderCards(reordered, 'c1', 'down')
    expect(reordered2.map((c) => c.id)).toEqual(['c3', 'c1', 'c2'])
    expect(reordered2.map((c) => c.order)).toEqual([0, 1, 2])
  })

  it('P1-02: restoreTaskItem restores deleted subtask without rolling back subsequent edits to siblings', () => {
    const tasks: TaskItem[] = [
      { id: 't1', title: 'Task 1', completed: false, order: 0, children: [], createdAt: '', updatedAt: '' },
      { id: 't2', title: 'Task 2', completed: false, order: 1, children: [], createdAt: '', updatedAt: '' },
      { id: 't3', title: 'Task 3', completed: false, order: 2, children: [], createdAt: '', updatedAt: '' }
    ]

    // 1. Delete task t2
    const { updatedTasks, deletedTask, parentId, originalIndex } = deleteTaskItem(tasks, 't2')
    expect(deletedTask?.id).toBe('t2')
    expect(updatedTasks.map((t) => t.id)).toEqual(['t1', 't3'])

    // 2. Modify sibling t1 title while t2 is in deleted state
    const modifiedTasks = updateTaskItem(updatedTasks, 't1', { title: 'Task 1 Renamed' })
    expect(modifiedTasks[0].title).toBe('Task 1 Renamed')

    // 3. User clicks Undo: restore deletedTask into modifiedTasks
    const restoredTasks = restoreTaskItem(modifiedTasks, deletedTask!, parentId, originalIndex)
    expect(restoredTasks.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
    // Sibling edit must NOT be lost!
    expect(restoredTasks[0].title).toBe('Task 1 Renamed')
    expect(restoredTasks[1].title).toBe('Task 2')
  })
})

