import { describe, it, expect } from 'vitest'
import type { TaskNode, OwnerType } from '../src/renderer/src/domain/types'
import {
  acceptNodeReview,
  rejectNodeReview,
  appendNodeProgress,
  blockNode
} from '../src/renderer/src/domain/calculator'

describe('PRD v4 Mubu-Style Node Interaction Tests', () => {
  const baseNode: TaskNode = {
    id: 'test_node_1',
    title: '修复 FMU 时间步长同步问题',
    status: 'IN_PROGRESS',
    owner: 'GEMINI',
    order: 0,
    parents: ['parent_prep'],
    children: [],
    rounds: [
      {
        id: 'round_01',
        roundNumber: 1,
        owner: 'GEMINI',
        startTime: '2026-10-14T08:00:00Z'
      }
    ],
    events: [
      {
        id: 'evt_init',
        roundId: 'round_01',
        timestamp: '2026-10-14T08:05:00Z',
        source: 'GEMINI',
        type: 'PROGRESS',
        summary: '初始信号定义完成'
      }
    ],
    completed: false,
    createdAt: '2026-10-14T08:00:00Z',
    updatedAt: '2026-10-14T08:05:00Z'
  }

  it('appendNodeProgress adds a PROGRESS event without altering node status', () => {
    const updated = appendNodeProgress(baseNode, {
      summary: '发现采样步长不匹配，已重设计算步长为 0.001s'
    })

    expect(updated.status).toBe('IN_PROGRESS')
    expect(updated.events?.length).toBe(2)
    const latest = updated.events?.[updated.events.length - 1]
    expect(latest?.type).toBe('PROGRESS')
    expect(latest?.summary).toContain('发现采样步长不匹配')
    // Old events are preserved
    expect(updated.events?.[0].summary).toBe('初始信号定义完成')
  })

  it('blockNode marks status as BLOCKED and appends BLOCKED event with blocker reason', () => {
    const updated = blockNode(baseNode, '缺少 MuJoCo 凸包碰撞体模型')

    expect(updated.status).toBe('BLOCKED')
    const latest = updated.events?.[updated.events.length - 1]
    expect(latest?.type).toBe('BLOCKED')
    expect(latest?.blockerReason).toBe('缺少 MuJoCo 凸包碰撞体模型')
  })

  it('WAITING_REVIEW transitions: accept review marks ACCEPTED without discarding history', () => {
    const reviewNode: TaskNode = {
      ...baseNode,
      status: 'WAITING_REVIEW'
    }

    const accepted = acceptNodeReview(reviewNode, '自测通过，步长严格对齐')
    expect(accepted.status).toBe('ACCEPTED')
    expect(accepted.completed).toBe(true)
    const latest = accepted.events?.[accepted.events.length - 1]
    expect(latest?.type).toBe('ACCEPTED')
    expect(latest?.summary).toContain('验收通过')
  })

  it('WAITING_REVIEW transitions: reject review preserves reason and resets status', () => {
    const reviewNode: TaskNode = {
      ...baseNode,
      status: 'WAITING_REVIEW'
    }

    const rejected = rejectNodeReview(reviewNode, '采样点在边界处发生微小数值振荡，需增加平滑滤波')
    expect(rejected.status).toBe('TODO')
    expect(rejected.completed).toBe(false)
    const latest = rejected.events?.[rejected.events.length - 1]
    expect(latest?.type).toBe('REJECTED')
    expect(latest?.summary).toContain('退回修改: 采样点在边界处发生微小数值振荡')
  })

  it('handoff node generation respects mode downstream vs parallel', () => {
    // Mode handoff: parents: [sourceNode.id]
    const handoffNode: TaskNode = {
      id: 'task_handoff_child',
      title: 'FMU 联调下一步',
      status: 'TODO', // starts in TODO per PRD 4.2
      owner: 'CODEX',
      order: 1,
      parents: [baseNode.id],
      children: [],
      rounds: [],
      events: [
        {
          id: 'evt_handoff',
          roundId: 'round_h',
          timestamp: new Date().toISOString(),
          source: 'SELF',
          type: 'ASSIGNED',
          summary: `从「${baseNode.title}」移交派发`
        }
      ],
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    expect(handoffNode.status).toBe('TODO')
    expect(handoffNode.parents).toEqual([baseNode.id])

    // Mode parallel: shares baseNode parents
    const parallelNode: TaskNode = {
      id: 'task_parallel_branch',
      title: '并行仿真分析',
      status: 'TODO',
      owner: 'CODEX',
      order: 2,
      parents: baseNode.parents || [],
      children: [],
      rounds: [],
      events: [
        {
          id: 'evt_parallel',
          roundId: 'round_p',
          timestamp: new Date().toISOString(),
          source: 'SELF',
          type: 'ASSIGNED',
          summary: `从「${baseNode.title}」创建并行任务`
        }
      ],
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    expect(parallelNode.status).toBe('TODO')
    expect(parallelNode.parents).toEqual(['parent_prep'])
  })
})
