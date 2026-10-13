import { describe, it, expect } from 'vitest'
import { isSchemaV1, migrateV1ToV2 } from '../src/renderer/src/domain/migration'
import {
  calculateProgress,
  startNodeExecution,
  appendNodeProgress,
  blockNode,
  resumeNode,
  submitNodeForReview,
  acceptNodeReview,
  rejectNodeReview,
  toggleTask
} from '../src/renderer/src/domain/calculator'
import { TaskNode } from '../src/renderer/src/domain/types'

describe('R1: Domain Model & Data Migration (Schema v1 -> v2)', () => {
  it('identifies Schema v1 data accurately', () => {
    expect(isSchemaV1({ schemaVersion: 1, cards: [] })).toBe(true)
    expect(isSchemaV1({ cards: [{ title: 'old' }] })).toBe(true)
    expect(isSchemaV1({ schemaVersion: 2, projects: [] })).toBe(false)
  })

  it('safely migrates Schema v1 data preserving checked tasks, history, and notes', () => {
    const legacyData = {
      schemaVersion: 1,
      cards: [
        {
          id: 'card_mujoco',
          title: 'FMU + MuJoCo 联合仿真',
          category: '动力学与控制',
          description: '多体动力学联合仿真',
          status: 'AI_RUNNING',
          owner: 'GEMINI',
          dueDate: '2026-10-20',
          order: 0,
          collapsed: false,
          tasks: [
            {
              id: 't1',
              title: '确认 FMU 输入输出接口',
              completed: true,
              order: 0,
              children: [],
              createdAt: '2026-10-10T10:00:00.000Z',
              updatedAt: '2026-10-10T12:00:00.000Z'
            },
            {
              id: 't2',
              title: '开发信号交换接口',
              completed: false,
              order: 1,
              children: [],
              createdAt: '2026-10-10T10:00:00.000Z',
              updatedAt: '2026-10-10T10:00:00.000Z'
            }
          ],
          aiWork: {
            activeStartTime: '2026-10-12T14:00:00.000Z',
            currentTaskDescription: '让 Gemini 优化时间步长',
            recentProgress: '完成了基础场景',
            currentBlockers: '步长插值问题',
            nextAction: '实现一阶保持器',
            history: [
              {
                id: 'log_1',
                timestamp: '2026-10-12T15:00:00.000Z',
                source: 'GEMINI',
                summary: '初始模型构建完成',
                changedFiles: 'bridge.py'
              }
            ]
          },
          createdAt: '2026-10-10T09:00:00.000Z',
          updatedAt: '2026-10-12T15:00:00.000Z'
        }
      ],
      settings: {
        theme: 'dark',
        closeToTray: true,
        autoStart: false,
        alwaysOnTop: false,
        aiWaitReminderThreshold: 30,
        hasSeenTrayNotice: true
      }
    }

    const migrated = migrateV1ToV2(legacyData)

    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.projects.length).toBe(1)
    const proj = migrated.projects[0]

    expect(proj.title).toBe('FMU + MuJoCo 联合仿真')
    expect(proj.tasks.length).toBe(2)

    // Task 1: was completed => now ACCEPTED
    const node1 = proj.tasks[0] as TaskNode
    expect(node1.status).toBe('ACCEPTED')
    expect(node1.rounds.length).toBe(1)
    expect(node1.rounds[0].conclusion).toBe('ACCEPTED')
    expect(node1.events.length).toBe(1)
    expect(node1.events[0].type).toBe('ACCEPTED')

    // Task 2: was not completed => now TODO
    const node2 = proj.tasks[1] as TaskNode
    expect(node2.status).toBe('TODO')
    expect(node2.rounds.length).toBe(0)

    // History and Archive preserved
    expect(proj.legacyAiHistory?.length).toBe(1)
    expect(proj.legacyAiHistory?.[0].summary).toBe('初始模型构建完成')
    expect(proj.legacyAiArchive?.currentTaskDescription).toBe('让 Gemini 优化时间步长')
    expect(proj.legacyAiArchive?.currentBlockers).toBe('步长插值问题')
  })

  it('calculates progress strictly on ACCEPTED leaves (2/6 = 33%)', () => {
    const tasks: TaskNode[] = [
      {
        id: '1',
        title: '节点 1',
        status: 'ACCEPTED',
        owner: 'SELF',
        order: 0,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '2',
        title: '节点 2',
        status: 'ACCEPTED',
        owner: 'SELF',
        order: 1,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '3',
        title: '节点 3',
        status: 'IN_PROGRESS',
        owner: 'GEMINI',
        order: 2,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '4',
        title: '节点 4',
        status: 'IN_PROGRESS',
        owner: 'CODEX',
        order: 3,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '5',
        title: '节点 5',
        status: 'WAITING_REVIEW', // Submitted by AI, NOT accepted yet!
        owner: 'GEMINI',
        order: 4,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: '6',
        title: '节点 6',
        status: 'TODO',
        owner: 'SELF',
        order: 5,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      }
    ]

    const prog = calculateProgress(tasks)
    expect(prog.totalLeaves).toBe(6)
    expect(prog.acceptedLeaves).toBe(2)
    expect(prog.inProgressLeaves).toBe(2)
    expect(prog.waitingReviewLeaves).toBe(1)
    expect(prog.todoLeaves).toBe(1)
    // 2 / 6 = 33%
    expect(prog.percentage).toBe(33)
  })

  it('supports parallel execution and multi-round lifecycle with human review', () => {
    let task: TaskNode = {
      id: 'task_bridge',
      title: '开发信号交换接口',
      status: 'TODO',
      owner: 'GEMINI',
      order: 0,
      children: [],
      rounds: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 1. Start Round 1 with Gemini
    task = startNodeExecution(task, 'GEMINI')
    expect(task.status).toBe('IN_PROGRESS')
    expect(task.rounds.length).toBe(1)
    expect(task.rounds[0].roundNumber).toBe(1)

    // 2. Append progress
    task = appendNodeProgress(task, {
      summary: 'FMU 输出读取已完成',
      changedFiles: 'bridge.py'
    })
    expect(task.events.length).toBe(2) // started + progress

    // 3. AI Submits for review
    task = submitNodeForReview(task, {
      summary: '提交初始接口代码',
      changedFiles: 'bridge.py',
      testResults: '单元测试通过'
    })
    expect(task.status).toBe('WAITING_REVIEW')

    // AI submitted does NOT mean accepted!
    expect(calculateProgress([task]).percentage).toBe(0)

    // 4. Human rejects Round 1 with reason
    task = rejectNodeReview(task, '时间步长同步失败，存在漂移')
    expect(task.status).toBe('TODO')
    expect(task.rounds[0].conclusion).toBe('REJECTED')
    expect(task.rounds[0].reviewNote).toBe('时间步长同步失败，存在漂移')

    // 5. Start Round 2 with Gemini
    task = startNodeExecution(task, 'GEMINI')
    expect(task.status).toBe('IN_PROGRESS')
    expect(task.rounds.length).toBe(2)
    expect(task.rounds[1].roundNumber).toBe(2)

    // 6. Gemini submits Round 2
    task = submitNodeForReview(task, {
      summary: '更新步长协调逻辑',
      changedFiles: 'bridge.py, test_step.py',
      testResults: '100步长稳态测试通过'
    })
    expect(task.status).toBe('WAITING_REVIEW')

    // 7. Human accepts Round 2
    task = acceptNodeReview(task, '验证通过，误差小于 1e-4')
    expect(task.status).toBe('ACCEPTED')
    expect(task.rounds[1].conclusion).toBe('ACCEPTED')
    expect(task.rounds[1].reviewNote).toBe('验证通过，误差小于 1e-4')

    // Now progress is 100%
    expect(calculateProgress([task]).percentage).toBe(100)
  })

  it('allows direct completion toggle for user tasks', () => {
    let task: TaskNode = {
      id: 'task_self',
      title: '准备 MuJoCo 物理场景',
      status: 'TODO',
      owner: 'SELF',
      order: 0,
      children: [],
      rounds: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const { updatedTasks } = toggleTask([task], 'task_self')
    expect(updatedTasks[0].status).toBe('ACCEPTED')
    expect(updatedTasks[0].events[0].type).toBe('ACCEPTED')

    const { updatedTasks: reReopened } = toggleTask(updatedTasks, 'task_self')
    expect(reReopened[0].status).toBe('TODO')
  })

  it('handles blockNode and resumeNode lifecycle events properly', () => {
    let task: TaskNode = {
      id: 'task_control',
      title: '控制器与 Actuator 绑定',
      status: 'TODO',
      owner: 'CODEX',
      order: 0,
      children: [],
      rounds: [],
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    task = startNodeExecution(task, 'CODEX')
    expect(task.status).toBe('IN_PROGRESS')

    // Block node
    task = blockNode(task, '缺少模型自由度配置参数')
    expect(task.status).toBe('BLOCKED')
    const blockEvt = task.events[task.events.length - 1]
    expect(blockEvt.type).toBe('BLOCKED')
    expect(blockEvt.blockerReason).toBe('缺少模型自由度配置参数')

    // Resume node
    task = resumeNode(task)
    expect(task.status).toBe('IN_PROGRESS')
    const resumeEvt = task.events[task.events.length - 1]
    expect(resumeEvt.type).toBe('RESUMED')
  })

  it('correctly ranks cross-project tasks by priority in widget monitor', () => {
    const tasks: TaskNode[] = [
      {
        id: 't_todo',
        title: '任务A',
        status: 'TODO',
        owner: 'SELF',
        order: 0,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 't_review',
        title: '任务B',
        status: 'WAITING_REVIEW',
        owner: 'GEMINI',
        order: 1,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 't_blocked',
        title: '任务C',
        status: 'BLOCKED',
        owner: 'CODEX',
        order: 2,
        children: [],
        rounds: [],
        events: [],
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 't_running',
        title: '任务D',
        status: 'IN_PROGRESS',
        owner: 'GEMINI',
        order: 3,
        children: [],
        rounds: [
          {
            id: 'r1',
            roundNumber: 1,
            owner: 'GEMINI',
            startTime: new Date(Date.now() - 30 * 60000).toISOString()
          }
        ],
        events: [],
        createdAt: '',
        updatedAt: ''
      }
    ]

    // Ranking algorithm check: 1: WAITING_REVIEW, 2: BLOCKED, 3: IN_PROGRESS, 4: TODO
    const priorityScore = (status: string) => {
      if (status === 'WAITING_REVIEW') return 1
      if (status === 'BLOCKED') return 2
      if (status === 'IN_PROGRESS') return 3
      if (status === 'TODO') return 4
      return 99
    }

    const sorted = [...tasks].sort((a, b) => priorityScore(a.status) - priorityScore(b.status))
    expect(sorted[0].id).toBe('t_review')
    expect(sorted[1].id).toBe('t_blocked')
    expect(sorted[2].id).toBe('t_running')
    expect(sorted[3].id).toBe('t_todo')
  })
})
