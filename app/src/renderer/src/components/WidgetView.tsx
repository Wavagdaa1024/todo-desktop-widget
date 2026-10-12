import React, { useState, useEffect, useMemo } from 'react'
import { Card } from '../domain/types'
import { calculateProgress } from '../domain/calculator'
import {
  Sparkles,
  Pin,
  X,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  PauseCircle,
  List,
  ChevronRight,
  Clock
} from 'lucide-react'

export const WidgetView: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([])
  const [isPinned, setIsPinned] = useState(false)
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null)
  const [heroExpanded, setHeroExpanded] = useState(true)

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

  // Determine Hero Card & Secondary Cards
  const { heroCard, secondaryCards } = useMemo(() => {
    if (cards.length === 0) {
      return { heroCard: null, secondaryCards: [] }
    }

    // If user clicked a specific card to be hero
    let hero = cards.find((c) => c.id === selectedHeroId)

    if (!hero) {
      // Prioritize: AI_RUNNING -> WAITING_ACCEPT -> BLOCKED -> first
      hero =
        cards.find((c) => c.status === 'AI_RUNNING') ||
        cards.find((c) => c.status === 'WAITING_ACCEPT') ||
        cards.find((c) => c.status === 'BLOCKED') ||
        cards[0]
    }

    const others = cards.filter((c) => c.id !== hero?.id).slice(0, 3)
    return { heroCard: hero, secondaryCards: others }
  }, [cards, selectedHeroId])

  const heroProgress = heroCard ? calculateProgress(heroCard.tasks) : null

  return (
    <div className="w-full h-screen bg-[#111c2e]/92 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 flex flex-col justify-between text-white shadow-2xl ring-1 ring-white/10 select-none overflow-hidden">
      {/* 1. Top Bar */}
      <div
        className="flex items-center justify-between pb-3 cursor-move select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-sm shadow-blue-500/30">
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
          </div>
          <span className="font-semibold text-xs tracking-wide text-slate-100">
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
                ? 'bg-blue-600/40 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
            title={isPinned ? '取消固定' : '固定悬浮窗'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            title="隐藏小窗"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main Body Area */}
      <div className="flex-1 space-y-3 overflow-y-auto pr-0.5 my-1">
        {heroCard ? (
          <>
            {/* 2.1 Hero Focused Task Card (图1 重点卡片) */}
            <div className="bg-[#182844]/80 border border-blue-400/20 rounded-xl p-3.5 space-y-2.5 backdrop-blur-md shadow-lg shadow-black/20 transition-all hover:border-blue-400/35">
              {/* Header row: Status ring + Title + Chevron */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {/* Status Ring / Icon */}
                  <div className="relative w-6 h-6 shrink-0 flex items-center justify-center">
                    <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        className="stroke-slate-700/60"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        fill="none"
                        className="stroke-blue-500 transition-all duration-500"
                        strokeWidth="3"
                        strokeDasharray={94.2}
                        strokeDashoffset={
                          94.2 - (94.2 * (heroProgress?.percentage || 0)) / 100
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-blue-300">
                      •
                    </div>
                  </div>

                  <h3 className="font-bold text-sm text-white truncate leading-tight">
                    {heroCard.title}
                  </h3>
                </div>

                <button
                  onClick={() => setHeroExpanded(!heroExpanded)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  {heroExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Sub-line: Agent & Status Badge */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="flex items-center gap-1 text-xs text-blue-300 font-medium">
                  <Sparkles className="w-3 h-3 text-blue-400" />
                  <span>{heroCard.owner}</span>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    heroCard.status === 'AI_RUNNING'
                      ? 'bg-blue-600/90 text-white shadow-sm shadow-blue-500/40'
                      : heroCard.status === 'WAITING_ACCEPT'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : heroCard.status === 'BLOCKED'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {heroCard.status === 'AI_RUNNING'
                    ? 'AI执行中'
                    : heroCard.status === 'WAITING_ACCEPT'
                    ? '待验收'
                    : heroCard.status === 'BLOCKED'
                    ? '阻塞'
                    : heroCard.status === 'DONE'
                    ? '已完成'
                    : '待开始'}
                </span>
              </div>

              {/* Progress bar line */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-sm shadow-blue-500/50"
                    style={{ width: `${heroProgress?.percentage || 0}%` }}
                  />
                </div>
                <span className="text-xs text-slate-300 font-mono font-medium">
                  {heroProgress?.percentage || 0}%
                </span>
              </div>

              {/* Next Action Footer line */}
              {heroExpanded && (
                <div className="pt-1 text-xs text-slate-400 truncate flex items-center gap-1.5 border-t border-white/5">
                  <span className="text-slate-500">下一步:</span>
                  <span className="text-slate-300 truncate">
                    {heroCard.aiWork.nextAction ||
                      heroCard.aiWork.currentTaskDescription ||
                      '暂无明确下一步行动'}
                  </span>
                </div>
              )}
            </div>

            {/* 2.2 Secondary Task Items (图1 下方 2~3 个简化条目) */}
            <div className="space-y-2">
              {secondaryCards.map((item) => {
                const prog = calculateProgress(item.tasks)
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedHeroId(item.id)}
                    className="bg-[#142136]/60 hover:bg-[#192a46]/80 border border-white/5 hover:border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between text-xs transition-all cursor-pointer group"
                  >
                    {/* Left: Icon + Title */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                      {item.status === 'DONE' || item.status === 'WAITING_ACCEPT' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : item.status === 'BLOCKED' ? (
                        <PauseCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      <span className="text-slate-200 font-medium truncate">
                        {item.title}
                      </span>
                    </div>

                    {/* Right: Percent + Status Pill + Chevron */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400 font-mono text-[11px]">
                        {prog.percentage}%
                      </span>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          item.status === 'WAITING_ACCEPT'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : item.status === 'BLOCKED'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : item.status === 'DONE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {item.status === 'WAITING_ACCEPT'
                          ? '待验收'
                          : item.status === 'BLOCKED'
                          ? '阻塞'
                          : item.status === 'DONE'
                          ? '已完成'
                          : '进行中'}
                      </span>

                      <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          /* Empty state in Widget */
          <div className="py-12 text-center text-xs text-slate-400 space-y-2">
            <p>暂无任务卡片</p>
            <button
              onClick={handleOpenMain}
              className="text-blue-400 hover:underline"
            >
              打开完整工作台创建任务
            </button>
          </div>
        )}
      </div>

      {/* 3. Bottom Action Bar: "查看全部 >" */}
      <div className="pt-2">
        <button
          onClick={handleOpenMain}
          className="w-full bg-[#1c2c48]/70 hover:bg-[#23385c]/80 border border-white/10 rounded-xl py-2 px-3 flex items-center justify-center gap-1.5 text-xs text-slate-200 font-medium transition-all active:scale-[0.98] shadow-sm shadow-black/10 hover:border-blue-400/30"
        >
          <List className="w-3.5 h-3.5 text-slate-400" />
          <span>查看全部</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  )
}
