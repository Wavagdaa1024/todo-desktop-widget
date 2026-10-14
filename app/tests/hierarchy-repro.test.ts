import { describe, it, expect } from 'vitest'
import { makeTasklineGraph } from '../src/renderer/src/domain/taskline'
import { reconcileHierarchy } from '../src/renderer/src/domain/calculator'
import { TaskNode } from '../src/renderer/src/domain/types'

describe('Reproduce user scenario with 层级1, 层级1.1, etc.', () => {
  it('checks depths and positions of user tree', () => {
    // Exactly as created by TaskCard / TaskTree:
    // 层级1
    //   层级1.1
    //     层级1.1.1
    //   层级1.2
    // 层级2
    const now = '2026-10-14T06:00:00Z'
    const c1_1_1: TaskNode = {
      id: 'id_1_1_1',
      title: '层级1.1.1',
      status: 'TODO',
      owner: 'SELF',
      order: 0,
      parents: [],
      children: [],
      rounds: [],
      events: [],
      createdAt: now,
      updatedAt: now
    }
    const c1_1: TaskNode = {
      id: 'id_1_1',
      title: '层级1.1',
      status: 'TODO',
      owner: 'SELF',
      order: 0,
      parents: [],
      children: [c1_1_1],
      rounds: [],
      events: [],
      createdAt: now,
      updatedAt: now
    }
    const c1_2: TaskNode = {
      id: 'id_1_2',
      title: '层级1.2',
      status: 'TODO',
      owner: 'SELF',
      order: 1,
      parents: [],
      children: [],
      rounds: [],
      events: [],
      createdAt: now,
      updatedAt: now
    }
    const c1: TaskNode = {
      id: 'id_1',
      title: '层级1',
      status: 'TODO',
      owner: 'SELF',
      order: 0,
      parents: [],
      children: [c1_1, c1_2],
      rounds: [],
      events: [],
      createdAt: now,
      updatedAt: now
    }
    const c2: TaskNode = {
      id: 'id_2',
      title: '层级2',
      status: 'TODO',
      owner: 'SELF',
      order: 1,
      parents: [],
      children: [],
      rounds: [],
      events: [],
      createdAt: now,
      updatedAt: now
    }

    const projectTasks = [c1, c2]

    // Now reproduce TaskLineCanvas flattening:
    const list: TaskNode[] = []
    const healedTasks = reconcileHierarchy(projectTasks)

    function traverse(nodes: TaskNode[], parent?: TaskNode) {
      if (!Array.isArray(nodes)) return
      nodes.forEach((n) => {
        const item: TaskNode = {
          ...n,
          parentId: n.parentId || parent?.id,
          parents:
            parent && (!n.parents || n.parents.length === 0)
              ? [parent.id]
              : n.parents
        }
        list.push(item)
        if (n.children && n.children.length > 0) {
          traverse(n.children as TaskNode[], n)
        }
      })
    }
    traverse(healedTasks)

    console.log('FLATTENED NODES:')
    list.forEach((n) => {
      console.log(`Node ${n.id} (${n.title}): parentId=${n.parentId}, parents=${JSON.stringify(n.parents)}, children=${n.children?.map(c => c.id)}`)
    })

    const graph = makeTasklineGraph(list, {
      collapseHistory: false
    })

    const posC1 = graph.positions.get('id_1')!
    const posC1_1 = graph.positions.get('id_1_1')!
    const posC1_1_1 = graph.positions.get('id_1_1_1')!
    const posC1_2 = graph.positions.get('id_1_2')!
    const posC2 = graph.positions.get('id_2')!

    // Verify Column alignments:
    // Column 0: Root tasks id_1 and id_2
    expect(posC1.x).toBe(50)
    expect(posC2.x).toBe(50)

    // Column 1: Subtasks of id_1 (id_1_1 and id_1_2) MUST be to the right of Column 0
    expect(posC1_1.x).toBe(378)
    expect(posC1_2.x).toBe(378)
    expect(posC1_1.x).toBeGreaterThan(posC1.x)

    // Column 2: Sub-subtask id_1_1_1 MUST be to the right of Column 1
    expect(posC1_1_1.x).toBe(706)
    expect(posC1_1_1.x).toBeGreaterThan(posC1_1.x)

    // Verify Visual Node Badges & Hierarchy
    const itemC1 = graph.items.find((i) => i.id === 'id_1')!
    const itemC1_1 = graph.items.find((i) => i.id === 'id_1_1')!
    const itemC1_1_1 = graph.items.find((i) => i.id === 'id_1_1_1')!
    const itemC1_2 = graph.items.find((i) => i.id === 'id_1_2')!
    const itemC2 = graph.items.find((i) => i.id === 'id_2')!

    expect(itemC1.hasChildren).toBe(true)
    expect(itemC1.isSubtask).toBe(false)

    expect(itemC1_1.hasChildren).toBe(true)
    expect(itemC1_1.isSubtask).toBe(true)
    expect(itemC1_1.parentTitle).toBe('层级1')
    expect(itemC1_1.renderParents).toEqual(['id_1'])

    expect(itemC1_1_1.hasChildren).toBe(false)
    expect(itemC1_1_1.isSubtask).toBe(true)
    expect(itemC1_1_1.parentTitle).toBe('层级1.1')
    expect(itemC1_1_1.renderParents).toEqual(['id_1_1'])

    expect(itemC1_2.hasChildren).toBe(false)
    expect(itemC1_2.isSubtask).toBe(true)
    expect(itemC1_2.parentTitle).toBe('层级1')
    expect(itemC1_2.renderParents).toEqual(['id_1'])

    expect(itemC2.hasChildren).toBe(false)
    expect(itemC2.isSubtask).toBe(false)

    // Verify SVG connecting edges
    const edgePairs = graph.edges.map((e) => `${e.from}->${e.to}`)
    expect(edgePairs).toContain('id_1->id_1_1')
    expect(edgePairs).toContain('id_1_1->id_1_1_1')
    expect(edgePairs).toContain('id_1->id_1_2')
  })
})
