import { describe, it, expect } from 'vitest'
import { makeTasklineGraph, getCompletedTime, isNodeCompleted } from '../src/renderer/src/domain/taskline'
import { TaskNode } from '../src/renderer/src/domain/types'

function makeMockNode(
  id: string,
  title: string,
  status: TaskNode['status'],
  owner: TaskNode['owner'] = 'SELF',
  parents: string[] = [],
  completedAt?: string
): TaskNode {
  return {
    id,
    title,
    status,
    owner,
    order: 0,
    parents,
    completedAt,
    children: [],
    rounds: [],
    events: completedAt
      ? [
          {
            id: `evt_${id}`,
            roundId: `r_${id}`,
            timestamp: completedAt,
            source: owner,
            type: 'ACCEPTED',
            summary: `${title} 完成`
          }
        ]
      : [],
    createdAt: completedAt || '2026-10-13T10:00:00Z',
    updatedAt: completedAt || '2026-10-13T10:00:00Z'
  }
}

describe('v3.1 Taskline Completed History Auto-Collapse Rules', () => {
  it('Rule 3: 0 completed nodes -> no history capsule and no blank placeholder', () => {
    const nodes: TaskNode[] = [
      makeMockNode('z1', '推导观测器方程', 'IN_PROGRESS', 'CODEX'),
      makeMockNode('z2', '离散化算法实现', 'TODO', 'GEMINI', ['z1'])
    ]

    const g = makeTasklineGraph(nodes, { collapseHistory: true })

    expect(g.totalCompleted).toBe(0)
    expect(g.showCapsule).toBe(false)
    expect(g.hiddenCount).toBe(0)
    expect(g.items.some((i) => i.isArchive)).toBe(false)
    expect(g.items.length).toBe(2)
    expect(g.latestCompletedNode).toBeNull()
    // First column is active node z1, not an empty capsule column
    expect(g.stages[0].title).toBe('继续推进 · 01')
  })

  it('Rule 4: 1 completed node -> displays normally as regular card, no history capsule', () => {
    const nodes: TaskNode[] = [
      makeMockNode('f1', '制定联合仿真方案', 'ACCEPTED', 'CODEX', [], '2026-10-13T14:22:00Z'),
      makeMockNode('f2', '修复 FMU 桥接代码', 'IN_PROGRESS', 'GEMINI', ['f1']),
      makeMockNode('f3', '编写独立测试方案', 'WAITING_REVIEW', 'CODEX', ['f1']),
      makeMockNode('f4', '联合调试与验收', 'TODO', 'SELF', ['f2', 'f3'])
    ]

    const g = makeTasklineGraph(nodes, { collapseHistory: true })

    expect(g.totalCompleted).toBe(1)
    expect(g.showCapsule).toBe(false)
    expect(g.hiddenCount).toBe(0)
    expect(g.items.some((i) => i.isArchive)).toBe(false)
    expect(g.items.length).toBe(4)
    expect(g.latestCompletedNode?.id).toBe('f1')

    // Node f1 is regular card in Column 0
    const f1Item = g.items.find((i) => i.id === 'f1')
    expect(f1Item).toBeDefined()
    expect(f1Item?.isArchive).toBe(false)
    expect(f1Item?.isRecentDone).toBe(false) // Only highlighted as recentDone if >= 2 completed

    // Normal stage title
    expect(g.stages[0].title).toBe('起点 / 历史')
  })

  it('Rule 1 & Rule 5: 5 completed nodes -> auto-collapses 4, keeps latest completed visible as card', () => {
    const nodes: TaskNode[] = [
      makeMockNode('r1', '动力学辨识', 'ACCEPTED', 'CODEX', [], '2026-10-13T09:40:00Z'),
      makeMockNode('r2', '状态空间模型', 'ACCEPTED', 'GEMINI', ['r1'], '2026-10-13T10:50:00Z'),
      makeMockNode('r3', '极点配置算法', 'ACCEPTED', 'CODEX', ['r2'], '2026-10-13T11:55:00Z'),
      makeMockNode('r4', 'Simulink 闭环仿真', 'ACCEPTED', 'GEMINI', ['r3'], '2026-10-13T13:45:00Z'),
      makeMockNode('r5', '控制器参数复核', 'ACCEPTED', 'CODEX', ['r4'], '2026-10-13T14:30:00Z'),
      // Active parallel branches
      makeMockNode('r6', '实机驱动器适配', 'IN_PROGRESS', 'GEMINI', ['r5']),
      makeMockNode('r7', '轨迹跟踪精度测试', 'WAITING_REVIEW', 'CODEX', ['r5']),
      // Merge branch
      makeMockNode('r8', '全行程防碰撞测试', 'TODO', 'SELF', ['r6', 'r7'])
    ]

    // Default: collapseHistory is true
    const g = makeTasklineGraph(nodes)

    expect(g.totalCompleted).toBe(5)
    expect(g.showCapsule).toBe(true)
    expect(g.hiddenCount).toBe(4) // 5 - 1 = 4
    expect(g.latestCompletedNode?.id).toBe('r5')

    // Capsule exists with count 4
    const capsule = g.items.find((i) => i.id === '__archive__')
    expect(capsule).toBeDefined()
    expect(capsule?.isArchive).toBe(true)
    expect(capsule?.title).toBe('已完成历史 · 4 步')

    // r5 is visible and flagged as recent done
    const r5Item = g.items.find((i) => i.id === 'r5')
    expect(r5Item).toBeDefined()
    expect(r5Item?.isRecentDone).toBe(true)

    // Hidden nodes (r1, r2, r3, r4) are NOT in visible items
    expect(g.items.some((i) => i.id === 'r1')).toBe(false)
    expect(g.items.some((i) => i.id === 'r2')).toBe(false)
    expect(g.items.some((i) => i.id === 'r3')).toBe(false)
    expect(g.items.some((i) => i.id === 'r4')).toBe(false)

    // Stage 0 is the compact history stage
    expect(g.stages[0].isHistoryStage).toBe(true)
    expect(g.stages[0].title).toBe('已归档历史')
    expect(g.stages[1].title).toBe('最近完成')

    // r5 connects from __archive__
    expect(r5Item?.renderParents).toContain('__archive__')

    // r6 and r7 branch from r5
    const r6Item = g.items.find((i) => i.id === 'r6')
    const r7Item = g.items.find((i) => i.id === 'r7')
    expect(r6Item?.renderParents).toContain('r5')
    expect(r7Item?.renderParents).toContain('r5')

    // r8 merges from r6 and r7
    const r8Item = g.items.find((i) => i.id === 'r8')
    expect(r8Item?.renderParents).toEqual(['r6', 'r7'])
  })

  it('Rule 5 Increment: completing another node increments history count to 5 and updates latest', () => {
    const nodes: TaskNode[] = [
      makeMockNode('r1', '动力学辨识', 'ACCEPTED', 'CODEX', [], '2026-10-13T09:40:00Z'),
      makeMockNode('r2', '状态空间模型', 'ACCEPTED', 'GEMINI', ['r1'], '2026-10-13T10:50:00Z'),
      makeMockNode('r3', '极点配置算法', 'ACCEPTED', 'CODEX', ['r2'], '2026-10-13T11:55:00Z'),
      makeMockNode('r4', 'Simulink 闭环仿真', 'ACCEPTED', 'GEMINI', ['r3'], '2026-10-13T13:45:00Z'),
      makeMockNode('r5', '控制器参数复核', 'ACCEPTED', 'CODEX', ['r4'], '2026-10-13T14:30:00Z'),
      // Now r7 is also accepted!
      makeMockNode('r7', '轨迹跟踪精度测试', 'ACCEPTED', 'CODEX', ['r5'], '2026-10-13T15:00:00Z'),
      makeMockNode('r6', '实机驱动器适配', 'IN_PROGRESS', 'GEMINI', ['r5']),
      makeMockNode('r8', '全行程防碰撞测试', 'TODO', 'SELF', ['r6', 'r7'])
    ]

    const g = makeTasklineGraph(nodes, { collapseHistory: true })

    expect(g.totalCompleted).toBe(6)
    expect(g.showCapsule).toBe(true)
    expect(g.hiddenCount).toBe(5)
    // Latest completed is now r7
    expect(g.latestCompletedNode?.id).toBe('r7')

    const capsule = g.items.find((i) => i.id === '__archive__')
    expect(capsule?.title).toBe('已完成历史 · 5 步')

    // r5 is now hidden inside capsule
    expect(g.items.some((i) => i.id === 'r5')).toBe(false)
    // r7 is the single visible recent completed card
    expect(g.items.some((i) => i.id === 'r7')).toBe(true)
  })

  it('Rule 2: Active nodes are NEVER collapsed regardless of execution duration', () => {
    const nodes: TaskNode[] = [
      makeMockNode('c1', '理论框架', 'ACCEPTED', 'CODEX', [], '2026-10-13T08:00:00Z'),
      makeMockNode('c2', '算法实现', 'ACCEPTED', 'CODEX', ['c1'], '2026-10-13T09:00:00Z'),
      makeMockNode('a1', '长周期训练', 'IN_PROGRESS', 'GEMINI', ['c2']),
      makeMockNode('a2', '专家人工评审', 'WAITING_REVIEW', 'CODEX', ['c2']),
      makeMockNode('a3', '外部依赖阻塞', 'BLOCKED', 'SELF', ['c2']),
      makeMockNode('a4', '后续规划待开始', 'TODO', 'SELF', ['a1'])
    ]

    const g = makeTasklineGraph(nodes, { collapseHistory: true })

    expect(g.items.some((i) => i.id === 'a1')).toBe(true)
    expect(g.items.some((i) => i.id === 'a2')).toBe(true)
    expect(g.items.some((i) => i.id === 'a3')).toBe(true)
    expect(g.items.some((i) => i.id === 'a4')).toBe(true)
  })

  it('Rule 6: Expanded view restores all 5 completed nodes with full DAG topology', () => {
    const nodes: TaskNode[] = [
      makeMockNode('r1', '动力学辨识', 'ACCEPTED', 'CODEX', [], '2026-10-13T09:40:00Z'),
      makeMockNode('r2', '状态空间模型', 'ACCEPTED', 'GEMINI', ['r1'], '2026-10-13T10:50:00Z'),
      makeMockNode('r3', '极点配置算法', 'ACCEPTED', 'CODEX', ['r2'], '2026-10-13T11:55:00Z'),
      makeMockNode('r4', 'Simulink 闭环仿真', 'ACCEPTED', 'GEMINI', ['r3'], '2026-10-13T13:45:00Z'),
      makeMockNode('r5', '控制器参数复核', 'ACCEPTED', 'CODEX', ['r4'], '2026-10-13T14:30:00Z'),
      makeMockNode('r6', '实机驱动器适配', 'IN_PROGRESS', 'GEMINI', ['r5']),
      makeMockNode('r7', '轨迹跟踪精度测试', 'WAITING_REVIEW', 'CODEX', ['r5']),
      makeMockNode('r8', '全行程防碰撞测试', 'TODO', 'SELF', ['r6', 'r7'])
    ]

    const g = makeTasklineGraph(nodes, { collapseHistory: false })

    expect(g.showCapsule).toBe(false)
    expect(g.hiddenCount).toBe(0)
    expect(g.items.some((i) => i.isArchive)).toBe(false)

    // All 8 nodes are present in the graph items
    expect(g.items.length).toBe(8)
    const ids = g.items.map((i) => i.id)
    expect(ids).toEqual(['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'])

    // Connections between completed nodes are fully intact
    expect(g.items.find((i) => i.id === 'r2')?.renderParents).toEqual(['r1'])
    expect(g.items.find((i) => i.id === 'r3')?.renderParents).toEqual(['r2'])
    expect(g.items.find((i) => i.id === 'r4')?.renderParents).toEqual(['r3'])
    expect(g.items.find((i) => i.id === 'r5')?.renderParents).toEqual(['r4'])
    expect(g.items.find((i) => i.id === 'r6')?.renderParents).toEqual(['r5'])
    expect(g.items.find((i) => i.id === 'r7')?.renderParents).toEqual(['r5'])
    expect(g.items.find((i) => i.id === 'r8')?.renderParents).toEqual(['r6', 'r7'])
  })

  it('Reroutes edges cleanly from hidden ancestors when node depends on an earlier hidden step', () => {
    // Scenario where an active branch depends directly on r3 (which is hidden in collapse)
    const nodes: TaskNode[] = [
      makeMockNode('r1', '动力学辨识', 'ACCEPTED', 'CODEX', [], '2026-10-13T09:40:00Z'),
      makeMockNode('r2', '状态空间模型', 'ACCEPTED', 'GEMINI', ['r1'], '2026-10-13T10:50:00Z'),
      makeMockNode('r3', '极点配置算法', 'ACCEPTED', 'CODEX', ['r2'], '2026-10-13T11:55:00Z'),
      makeMockNode('r4', 'Simulink 闭环仿真', 'ACCEPTED', 'GEMINI', ['r3'], '2026-10-13T13:45:00Z'),
      makeMockNode('r5', '控制器参数复核', 'ACCEPTED', 'CODEX', ['r4'], '2026-10-13T14:30:00Z'),
      // Active branch branching directly from r3
      makeMockNode('r_extra', '极点鲁棒性分析', 'IN_PROGRESS', 'CODEX', ['r3'])
    ]

    const g = makeTasklineGraph(nodes, { collapseHistory: true })

    const extraItem = g.items.find((i) => i.id === 'r_extra')
    expect(extraItem).toBeDefined()
    // Since r3 is hidden and r_extra has no other visible parent, it routes cleanly to __archive__
    expect(extraItem?.renderParents).toContain('__archive__')
  })
})
