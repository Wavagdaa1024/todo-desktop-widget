import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, TaskNode, TaskNodeStatus, OwnerType } from '../domain/types'
import {
  Pin,
  X,
  ArrowRight,
  CheckCircle2
} from 'lucide-react'

interface PriorityTaskItem {
  projectId: string
  projectTitle: string
  node: TaskNode
  status: TaskNodeStatus
  owner: OwnerType
  priorityScore: number
  latestSnippet: string
  elapsedMinutes: number
}

export const WidgetView: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([])
  const [isPinned, setIsPinned] = useState(false)

  const loadLatestData = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.storage.getInitialData().then((res) => {
        if (res?.data?.cards) {
          setCards(res.data.cards)
        }
      })
    }
  }, [])

  // Fetch initial data
  useEffect(() => {
    loadLatestData()
  }, [loadLatestData])

  // Listen for real-time storage updates (event-driven IPC, zero polling)
  useEffect(() => {
    if (!window.electronAPI?.storage?.onDataUpdated) return
    const unsubscribe = window.electronAPI.storage.onDataUpdated((updatedData) => {
      setCards(updatedData.cards || updatedData.projects || [])
    })
    return () => unsubscribe()
  }, [])

  // Listen for window refresh IPC event (sent when widget is toggled or focused)
  useEffect(() => {
    if (!window.electronAPI?.window?.onWidgetRefresh) return
    const unsubscribe = window.electronAPI.window.onWidgetRefresh(() => {
      loadLatestData()
    })
    return () => unsubscribe()
  }, [loadLatestData])

  // Refresh on window focus and visibility change
  useEffect(() => {
    const handleFocus = () => loadLatestData()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadLatestData()
      }
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadLatestData])

  // Esc key closes widget
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.electronAPI?.window?.closeWidget()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleTogglePin = () => {
    const nextPin = !isPinned
    setIsPinned(nextPin)
    window.electronAPI?.window?.setWidgetPin(nextPin)
  }

  const handleClose = () => {
    window.electronAPI?.window?.closeWidget()
  }

  const handleOpenMain = (target?: { projectId?: string; nodeId?: string }) => {
    window.electronAPI?.window?.openMainBoard(target)
  }

  // Cross-project Priority Task Extraction & Ranking (PRD Section 7.1)
  const { priorityTasks, counts } = useMemo(() => {
    const allActiveNodes: PriorityTaskItem[] = []
    let waitingReviewCount = 0
    let blockedCount = 0
    let inProgressCount = 0

    function traverseTasks(tasks: TaskNode[], projectId: string, projectTitle: string) {
      if (!Array.isArray(tasks)) return
      for (const t of tasks) {
        if (!t.children || t.children.length === 0) {
          // Leaf task
          const status: TaskNodeStatus = t.status || (t.completed ? 'ACCEPTED' : 'TODO')
          const owner: OwnerType = t.owner || 'SELF'

          if (status === 'WAITING_REVIEW') waitingReviewCount++
          if (status === 'BLOCKED') blockedCount++
          if (status === 'IN_PROGRESS') inProgressCount++

          // Priority score: 1: WAITING_REVIEW -> 2: BLOCKED -> 3: IN_PROGRESS -> 4: TODO
          let priorityScore = 99
          if (status === 'WAITING_REVIEW') priorityScore = 1
          else if (status === 'BLOCKED') priorityScore = 2
          else if (status === 'IN_PROGRESS') priorityScore = 3
          else if (status === 'TODO') priorityScore = 4

          // Calculate elapsed minutes if IN_PROGRESS
          let elapsed = 0
          if (status === 'IN_PROGRESS') {
            const currentRound = t.rounds?.[t.rounds.length - 1]
            if (currentRound?.startTime) {
              const startMs = new Date(currentRound.startTime).getTime()
              elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 60000))
            }
          }

          // Extract latest snippet
          let snippet = ''
          if (t.events && t.events.length > 0) {
            const last = t.events[t.events.length - 1]
            if (status === 'WAITING_REVIEW') snippet = last.summary ? `已提交：${last.summary}` : '已提交待用户验收'
            else if (status === 'BLOCKED') snippet = last.blockerReason ? `阻塞：${last.blockerReason}` : last.summary
            else if (status === 'IN_PROGRESS') {
              snippet = elapsed > 0 ? `${elapsed} 分钟` : last.summary || '执行中'
            } else if (last.type === 'REJECTED') {
              snippet = `需返工：${last.summary}`
            }
          } else if (t.notes) {
            snippet = t.notes
          }

          // Don't show already accepted tasks in the widget priority monitor unless all completed
          if (status !== 'ACCEPTED') {
            allActiveNodes.push({
              projectId,
              projectTitle,
              node: t,
              status,
              owner,
              priorityScore,
              latestSnippet: snippet,
              elapsedMinutes: elapsed
            })
          }
        } else {
          traverseTasks(t.children, projectId, projectTitle)
        }
      }
    }

    for (const card of cards) {
      traverseTasks((card.tasks || []) as TaskNode[], card.id, card.title)
    }

    // Sort by priorityScore: WAITING_REVIEW -> BLOCKED -> IN_PROGRESS (longest elapsed first) -> TODO
    allActiveNodes.sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) {
        return a.priorityScore - b.priorityScore
      }
      if (a.priorityScore === 3) {
        return b.elapsedMinutes - a.elapsedMinutes
      }
      return 0
    })

    return {
      priorityTasks: allActiveNodes.slice(0, 4),
      counts: {
        waitingReview: waitingReviewCount,
        blocked: blockedCount,
        inProgress: inProgressCount
      }
    }
  }, [cards])

  // Dynamically adapt widget height (Zero white space, perfectly compact)
  useEffect(() => {
    let targetHeight = 175
    if (priorityTasks.length === 1) {
      targetHeight = 230
    } else if (priorityTasks.length === 2) {
      targetHeight = 295
    } else if (priorityTasks.length === 3) {
      targetHeight = 360
    } else if (priorityTasks.length >= 4) {
      targetHeight = 425
    }

    if (window.electronAPI?.window?.setWidgetHeight) {
      window.electronAPI.window.setWidgetHeight(targetHeight)
    }
  }, [priorityTasks.length])

  const renderStatusBadge = (status: TaskNodeStatus) => {
    switch (status) {
      case 'WAITING_REVIEW':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/25 text-purple-300 border border-purple-500/40 shrink-0">
            待验收
          </span>
        )
      case 'BLOCKED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 shrink-0">
            阻塞
          </span>
        )
      case 'IN_PROGRESS':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600/80 text-white shrink-0">
            执行中
          </span>
        )
      case 'TODO':
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
            待开始
          </span>
        )
    }
  }

  const renderOwnerBadge = (owner: OwnerType) => {
    switch (owner) {
      case 'GEMINI':
        return <span className="text-indigo-400 font-medium">Gemini</span>
      case 'CODEX':
        return <span className="text-teal-400 font-medium">Codex</span>
      case 'SELF':
        return <span className="text-slate-300 font-medium">自己</span>
      case 'OTHER':
      default:
        return <span className="text-amber-400 font-medium">其他</span>
    }
  }

  return (
    <div className="w-full h-full bg-[#0f172a] border border-white/15 rounded-2xl p-3 flex flex-col justify-between text-white shadow-2xl ring-1 ring-black/40 select-none overflow-hidden font-sans">
      {/* 1. Header Bar: Title, Pin, Close */}
      <div className="pb-2 border-b border-white/10 select-none space-y-1">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-2 flex-1 cursor-move"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold pointer-events-none">
              ✓
            </div>
            <span className="font-bold text-xs tracking-wide text-slate-100 pointer-events-none">
              AI Task Board
            </span>
          </div>

          <div
            className="flex items-center gap-1 shrink-0"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <button
              type="button"
              onClick={handleTogglePin}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className={`p-1 rounded transition-colors cursor-pointer ${
                isPinned
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
              title={isPinned ? '取消固定' : '固定置顶'}
            >
              <Pin className="w-3.5 h-3.5 pointer-events-none" />
            </button>
            <button
              type="button"
              onClick={handleClose}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
              title="隐藏小窗"
            >
              <X className="w-3.5 h-3.5 pointer-events-none" />
            </button>
          </div>
        </div>

        {/* Counter Summary Pill (PRD Section 7.2) */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono pt-0.5">
          <span className={counts.waitingReview > 0 ? 'text-purple-300 font-semibold' : ''}>
            待验收 {counts.waitingReview}
          </span>
          <span className="text-slate-600">·</span>
          <span className={counts.blocked > 0 ? 'text-rose-300 font-semibold' : ''}>
            阻塞 {counts.blocked}
          </span>
          <span className="text-slate-600">·</span>
          <span className={counts.inProgress > 0 ? 'text-blue-300 font-semibold' : ''}>
            执行中 {counts.inProgress}
          </span>
        </div>
      </div>

      {/* 2. Priority Task Nodes List */}
      <div className="flex-1 space-y-1.5 overflow-hidden my-2">
        {priorityTasks.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="font-medium text-slate-300">全部任务已完成或暂无待办</p>
            <p className="text-[11px] text-slate-500">点击下方按钮可在主工作台创建新任务</p>
          </div>
        ) : (
          priorityTasks.map((item) => (
            <div
              key={item.node.id}
              onClick={() => handleOpenMain({ projectId: item.projectId, nodeId: item.node.id })}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                item.status === 'WAITING_REVIEW'
                  ? 'bg-purple-950/30 border-purple-800/50 hover:bg-purple-950/50 hover:border-purple-600'
                  : item.status === 'BLOCKED'
                  ? 'bg-rose-950/30 border-rose-800/50 hover:bg-rose-950/50 hover:border-rose-600'
                  : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              {/* Row Line 1: Title + Status Badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100 truncate group-hover:text-blue-300 transition-colors">
                  {item.node.title}
                </span>
                {renderStatusBadge(item.status)}
              </div>

              {/* Row Line 2: Project + Owner + Snippet / Timer */}
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 truncate">
                <span className="text-slate-300 font-medium truncate max-w-[110px]">
                  {item.projectTitle}
                </span>
                <span>·</span>
                {renderOwnerBadge(item.owner)}
                {item.latestSnippet && (
                  <>
                    <span>·</span>
                    <span className="truncate text-slate-400 text-[10px]">
                      {item.latestSnippet}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. Bottom Action Bar: Open Main Board */}
      <div
        className="pt-1.5 border-t border-white/10"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => handleOpenMain()}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="w-full py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/5 hover:border-white/10"
        >
          <span>打开完整工作台</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  )
}
