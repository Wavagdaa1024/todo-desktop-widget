import { describe, it, expect } from 'vitest'
import { makeTasklineGraph } from '../src/renderer/src/domain/taskline'
import { reconcileHierarchy, addNodeToParent, getNodeCheckState } from '../src/renderer/src/domain/calculator'
import { TaskNode } from '../src/renderer/src/domain/types'

function makeTestNode(
  id: string,
  title: string,
  options: {
    status?: TaskNode['status']
    owner?: TaskNode['owner']
    parents?: string[]
    parentId?: string
    children?: TaskNode[]
    completed?: boolean
  } = {}
): TaskNode {
  return {
    id,
    title,
    status: options.status || (options.completed ? 'ACCEPTED' : 'TODO'),
    owner: options.owner || 'SELF',
    order: 0,
    parents: options.parents || [],
    parentId: options.parentId,
    children: options.children || [],
    rounds: [],
    events: [],
    completed: options.completed || options.status === 'ACCEPTED',
    createdAt: '2026-10-13T10:00:00Z',
    updatedAt: '2026-10-13T10:00:00Z'
  }
}

describe('Taskline Hierarchy & Tree-to-DAG Synchronization', () => {
  it('reconcileHierarchy automatically heals subtasks with missing parentId and parents', () => {
    // Simulating tasks created in legacy tree where subtasks had no parents array
    const rawTasks: TaskNode[] = [
      makeTestNode('t1', '需求确认'),
      makeTestNode('t2', '系统架构', {
        children: [
          makeTestNode('t2_sub1', '接口定义'),
          makeTestNode('t2_sub2', '协议联调')
        ]
      })
    ]

    const healed = reconcileHierarchy(rawTasks)

    expect(healed[1].children[0].parentId).toBe('t2')
    expect(healed[1].children[0].parents).toContain('t2')
    expect(healed[1].children[1].parentId).toBe('t2')
    expect(healed[1].children[1].parents).toContain('t2')
  })

  it('addNodeToParent initializes parentId and parents for newly added subtasks', () => {
    const rootTasks: TaskNode[] = [makeTestNode('parent_1', '父任务模块')]

    const updated = addNodeToParent(rootTasks, 'parent_1', '新增子任务', {
      owner: 'CODEX'
    })

    const parent = updated.find((t) => t.id === 'parent_1')!
    expect(parent.children.length).toBe(1)
    const child = parent.children[0]
    expect(child.title).toBe('新增子任务')
    expect(child.owner).toBe('CODEX')
    expect(child.parentId).toBe('parent_1')
    expect(child.parents).toEqual(['parent_1'])
  })

  it('User Regression Scenario: Subtask NEVER appears before parent task in DAG depth', () => {
    // The exact scenario from user screenshots (media_1791902537387_2a342ce8 & media_1791902542486_d1ab02ae)
    // Parent task 'p_codex' is at Column 2 (branched from earlier work).
    // Subtask 'sub_self' belongs to 'p_codex'.
    const pCodex = makeTestNode('p_codex', '11 (Codex)', {
      owner: 'CODEX',
      parents: ['prev_gemini'],
      children: [
        makeTestNode('sub_self', '11 (自己)', {
          owner: 'SELF',
          parentId: 'p_codex'
          // Even if sub_self.parents was empty in storage, reconcileHierarchy fixes it
        })
      ]
    })

    const rootList = [
      makeTestNode('t_hello', '你好', { owner: 'SELF' }),
      makeTestNode('prev_gemini', '11 (Gemini)', { owner: 'GEMINI', parents: ['t_hello'] }),
      pCodex,
      makeTestNode('t_detail', '详情', { owner: 'SELF' })
    ]

    const healed = reconcileHierarchy(rootList)

    // Flatten like TaskLineCanvas does
    const flat: TaskNode[] = []
    function traverse(nodes: TaskNode[], parent?: TaskNode) {
      nodes.forEach((n) => {
        flat.push({
          ...n,
          parentId: n.parentId || parent?.id,
          parents: parent && (!n.parents || n.parents.length === 0) ? [parent.id] : n.parents
        })
        if (n.children && n.children.length > 0) {
          traverse(n.children, n)
        }
      })
    }
    traverse(healed)

    const graph = makeTasklineGraph(flat, { collapseHistory: false })

    const pCodexVisual = graph.items.find((i) => i.id === 'p_codex')!
    const subSelfVisual = graph.items.find((i) => i.id === 'sub_self')!

    expect(pCodexVisual).toBeDefined()
    expect(subSelfVisual).toBeDefined()

    // Visual attributes verify hierarchy awareness
    expect(pCodexVisual.hasChildren).toBe(true)
    expect(pCodexVisual.subtaskCount).toBe(1)
    expect(pCodexVisual.acceptedSubtaskCount).toBe(0)

    expect(subSelfVisual.isSubtask).toBe(true)
    expect(subSelfVisual.parentId).toBe('p_codex')
    expect(subSelfVisual.parentTitle).toBe('11 (Codex)')

    // CRITICAL: sub_self's renderParents MUST contain p_codex
    expect(subSelfVisual.renderParents).toContain('p_codex')

    // Topological positions: sub_self x MUST be strictly to the right of p_codex x!
    const posParent = graph.positions.get('p_codex')!
    const posChild = graph.positions.get('sub_self')!

    expect(posChild.x).toBeGreaterThan(posParent.x)
    expect(posChild.x - posParent.x).toBeGreaterThanOrEqual(236 + 70) // Col gap!
  })

  it('Downstream tasks depending on a parent task follow all subtasks of that parent task', () => {
    // Phase 1 with 2 subtasks, and a downstream Task 2 that follows Phase 1
    const phase1 = makeTestNode('phase_1', '阶段一', {
      children: [
        makeTestNode('s1', '子任务 1', { parentId: 'phase_1', parents: ['phase_1'] }),
        makeTestNode('s2', '子任务 2', { parentId: 'phase_1', parents: ['phase_1'] })
      ]
    })
    const taskNext = makeTestNode('task_next', '阶段二：后续汇总', {
      parents: ['phase_1']
    })

    const graph = makeTasklineGraph([phase1, ...phase1.children, taskNext], { collapseHistory: false })

    const posPhase = graph.positions.get('phase_1')!
    const posS1 = graph.positions.get('s1')!
    const posS2 = graph.positions.get('s2')!
    const posNext = graph.positions.get('task_next')!

    // phase_1 is at Column 0
    expect(posPhase.x).toBe(50)
    // Subtasks s1 and s2 branch from phase_1 at Column 1
    expect(posS1.x).toBe(posPhase.x + 244 + 84)
    expect(posS2.x).toBe(posPhase.x + 244 + 84)
    // task_next follows all subtasks at Column 2
    expect(posNext.x).toBeGreaterThan(posS1.x)
  })

  it('Parent task reflects subtask completion state via getNodeCheckState', () => {
    const parent = makeTestNode('p_test', '父任务', {
      children: [
        makeTestNode('c1', '子任务 1', { completed: false, status: 'TODO' }),
        makeTestNode('c2', '子任务 2', { completed: false, status: 'TODO' })
      ]
    })

    // Initially unchecked
    expect(getNodeCheckState(parent)).toBe('unchecked')

    // 1 completed -> indeterminate
    parent.children[0].completed = true
    parent.children[0].status = 'ACCEPTED'
    expect(getNodeCheckState(parent)).toBe('indeterminate')

    // Both completed -> checked
    parent.children[1].completed = true
    parent.children[1].status = 'ACCEPTED'
    expect(getNodeCheckState(parent)).toBe('checked')
  })
})
