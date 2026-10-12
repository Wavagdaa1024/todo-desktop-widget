import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardStatus } from '../domain/types'
import { calculateProgress } from '../domain/calculator'
import {
  Sparkles,
  Pin,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus
} from 'lucide-react'

export const WidgetView: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([])
  const [isPinned, setIsPinned] = useState(false)
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  // Fetch initial data
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.storage.getInitialData().then((res) => {
        setCards(res.data.cards)
      })
    }
  }, [])

  // Listen for real-time storage updates (event-driven IPC, zero polling)
  useEffect(() => {
    if (!window.electronAPI?.storage?.onDataUpdated) return
    const unsubscribe = window.electronAPI.storage.onDataUpdated((updatedData) => {
      setCards(updatedData.cards)
    })
    return () => unsubscribe()
  }, [])

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

  const handleOpenMain = () => {
    window.electronAPI?.window?.openMainBoard()
  }

  const handleCreateInMain = () => {
    window.electronAPI?.window?.openMainBoard()
  }

  // Determine Hero Card & Secondary Cards
  // Default priority: WAITING_ACCEPT > BLOCKED > AI_RUNNING > TODO > DONE
  const { heroCard, secondaryCards } = useMemo(() => {
    if (cards.length === 0) {
      return { heroCard: null, secondaryCards: [] }
    }

    let hero: Card | undefined = undefined

    // If user clicked a specific card to be hero
    if (selectedHeroId) {
      hero = cards.find((c) => c.id === selectedHeroId)
    }

    if (!hero) {
      hero =
        cards.find((c) => c.status === 'WAITING_ACCEPT') ||
        cards.find((c) => c.status === 'BLOCKED') ||
        cards.find((c) => c.status === 'AI_RUNNING') ||
        cards.find((c) => c.status === 'TODO') ||
        cards[0]
    }

    const others = cards.filter((c) => c.id !== hero?.id).slice(0, 3)
    return { heroCard: hero, secondaryCards: others }
  }, [cards, selectedHeroId])

  const heroProgress = heroCard ? calculateProgress(heroCard.tasks) : null

  // Live timer for Hero card if AI_RUNNING
  useEffect(() => {
    if (!heroCard || heroCard.status !== 'AI_RUNNING' || !heroCard.aiWork?.activeStartTime) {
      setElapsedMinutes(0)
      return
    }

    const calcElapsed = () => {
      const start = new Date(heroCard.aiWork.activeStartTime!).getTime()
      const diffMs = Date.now() - start
      setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)))
    }

    calcElapsed()
    const timer = setInterval(calcElapsed, 30000)
    return () => clearInterval(timer)
  }, [heroCard?.id, heroCard?.status, heroCard?.aiWork?.activeStartTime])

  // Dynamically adapt widget height:
  // 0 cards: ~205px
  // 1 card: ~310px
  // 2 cards: ~365px
  // 3+ cards: ~420px
  useEffect(() => {
    let targetHeight = 205
    if (cards.length === 1) {
      targetHeight = 310
    } else if (cards.length === 2) {
      targetHeight = 365
    } else if (cards.length >= 3) {
      targetHeight = 425
    }

    if (window.electronAPI?.window?.setWidgetHeight) {
      window.electronAPI.window.setWidgetHeight(targetHeight)
    }
  }, [cards.length, secondaryCards.length])

  // Helper for status badge presentation
  const renderStatusBadge = (status: CardStatus) => {
    switch (status) {
      case 'AI_RUNNING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-600 text-white shadow-sm shadow-blue-500/40">
            AI 执行中
          </span>
        )
      case 'WAITING_ACCEPT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/25 text-amber-300 border border-amber-500/40">
            待验收
          </span>
        )
      case 'BLOCKED':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/25 text-rose-300 border border-rose-500/40">
            阻塞
          </span>
        )
      case 'DONE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            已完成
          </span>
        )
      case 'TODO':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50">
            待开始
          </span>
        )
    }
  }

  return (
    <div className="w-full h-full bg-[#0f172a]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-3.5 flex flex-col justify-between text-white shadow-2xl ring-1 ring-black/40 select-none overflow-hidden font-sans">
      {/* 1. Top Header Bar (Single compact line, drag region) */}
      <div
        className="flex items-center justify-between pb-2 cursor-move select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm shadow-blue-500/40">
            ✓
          </div>
          <span className="font-bold text-xs tracking-wide text-slate-100">
            AI Task Board
          </span>
        </div>

        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={handleTogglePin}
            className={`p-1.5 rounded-lg transition-colors ${
              isPinned
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
            }`}
            title={isPinned ? '取消固定' : '固定置顶'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
            title="隐藏小窗"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Body: Hero Card + Secondary Cards OR Clean Empty State */}
      <div className="flex-1 space-y-2.5 overflow-hidden my-0.5">
        {heroCard ? (
          <>
            {/* 2.1 Hero Focused Task Card */}
            <div className="bg-[#182640] border border-blue-400/25 rounded-xl p-3 space-y-2 shadow-lg shadow-black/30">
              {/* Title row */}
              <div className="flex items-start justify-between gap-2">
                <h3
                  className="font-bold text-sm text-white line-clamp-2 leading-snug flex-1"
                  title={heroCard.title}
                >
                  {heroCard.title}
                </h3>
              </div>

              {/* Agent & Status line */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-blue-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-blue-400" />
                    <span>{heroCard.owner}</span>
                  </span>
                  {renderStatusBadge(heroCard.status)}
                </div>

                {heroCard.status === 'AI_RUNNING' && elapsedMinutes > 0 && (
                  <span className="text-[10px] text-blue-300/90 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-400 animate-pulse" />
                    <span>已等待 {elapsedMinutes}m</span>
                  </span>
                )}
              </div>

              {/* Progress bar line */}
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                  <span>
                    {heroProgress?.doneLeaves}/{heroProgress?.totalLeaves} 完成
                  </span>
                  <span className="font-bold text-white">{heroProgress?.percentage || 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-700/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      heroProgress?.percentage === 100
                        ? 'bg-emerald-500'
                        : heroCard.status === 'WAITING_ACCEPT'
                        ? 'bg-amber-500'
                        : heroCard.status === 'BLOCKED'
                        ? 'bg-rose-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${heroProgress?.percentage || 0}%` }}
                  />
                </div>
              </div>

              {/* Single-line Current task & Next Action summaries */}
              {(heroCard.aiWork?.currentTaskDescription || heroCard.aiWork?.nextAction) && (
                <div className="pt-1.5 border-t border-white/10 space-y-0.5 text-xs">
                  {heroCard.aiWork.currentTaskDescription && (
                    <div className="truncate flex items-center gap-1.5 text-slate-300">
                      <span className="text-slate-400 shrink-0 font-medium text-[11px]">当前:</span>
                      <span className="truncate text-slate-200">{heroCard.aiWork.currentTaskDescription}</span>
                    </div>
                  )}
                  {heroCard.aiWork.nextAction && (
                    <div className="truncate flex items-center gap-1.5 text-slate-300">
                      <span className="text-slate-400 shrink-0 font-medium text-[11px]">下一步:</span>
                      <span className="truncate text-slate-200">{heroCard.aiWork.nextAction}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2.2 Secondary Task Items (Max 2~3 rows, click to switch hero) */}
            {secondaryCards.length > 0 && (
              <div className="space-y-1.5">
                {secondaryCards.map((item) => {
                  const prog = calculateProgress(item.tasks)
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedHeroId(item.id)}
                      className="bg-[#142036]/80 hover:bg-[#1a2b48] border border-white/10 hover:border-blue-400/30 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs transition-all cursor-pointer group"
                      title="点击将此任务切换为重点展示"
                    >
                      {/* Left: Icon / Title */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
                        {item.status === 'DONE' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : item.status === 'BLOCKED' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 ml-1" />
                        )}
                        <span className="text-slate-200 font-medium truncate text-xs">
                          {item.title}
                        </span>
                      </div>

                      {/* Right: Percent + Status Pill */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-slate-400 font-mono text-[11px]">
                          {prog.percentage}%
                        </span>
                        {renderStatusBadge(item.status)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* Clean, Compact Empty State (~200px total window height) */
          <div className="py-5 text-center flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner">
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-white text-xs">还没有任务</p>
              <p className="text-[11px] text-slate-400 max-w-[240px]">
                创建任务后，这里会显示 AI 的工作状态
              </p>
            </div>
            <button
              onClick={handleCreateInMain}
              className="mt-1 flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shadow-sm shadow-blue-500/30 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>创建第一个任务</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Bottom Action Bar: "查看全部 →" */}
      <div className="pt-2 border-t border-white/10 flex items-center gap-2">
        <button
          onClick={handleOpenMain}
          className="flex-1 bg-[#1a273f]/90 hover:bg-[#233556] border border-white/15 hover:border-blue-400/40 rounded-xl py-1.5 px-3 flex items-center justify-center gap-1.5 text-xs text-slate-200 font-medium transition-all active:scale-[0.98]"
        >
          <span>查看全部</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          onClick={handleCreateInMain}
          className="p-1.5 bg-blue-600/80 hover:bg-blue-600 border border-blue-500/50 rounded-xl text-white transition-colors"
          title="打开主窗口创建新卡片"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
