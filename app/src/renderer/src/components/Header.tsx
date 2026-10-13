import React, { useState, useRef, useEffect } from 'react'
import { Card, TaskNode, CardStatus } from '../domain/types'
import {
  Plus,
  Settings as SettingsIcon,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ListFilter,
  Trash2,
  Copy,
  X
} from 'lucide-react'

export type FilterStatus = 'ALL' | CardStatus | 'OVERDUE'
export type SortOption = 'MANUAL' | 'UPDATED' | 'DUE_DATE'

export interface HeaderProps {
  cards: Card[]
  activeProjectId: string | null
  onSelectProject: (id: string) => void
  onAddProject: () => void
  onDeleteProject?: (id: string) => void
  onDuplicateProject?: (card: Card) => void
  onOpenSettings: () => void
  saveStatus: 'saved' | 'saving' | 'error'
  onAddSampleProject?: () => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export const Header: React.FC<HeaderProps> = ({
  cards,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onDeleteProject,
  onDuplicateProject,
  onOpenSettings,
  saveStatus,
  onAddSampleProject
}) => {
  const [showOverviewPopover, setShowOverviewPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close popover when clicking outside
  useEffect(() => {
    if (!showOverviewPopover) return
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowOverviewPopover(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showOverviewPopover])

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs shadow-blue-500/20 text-xs">
            ✓
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-snug">
              AI Task Board
            </h1>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-none">
              个人任务线工作台
            </p>
          </div>
        </div>

        {/* Center: Clean Segmented Project Tabs */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto mx-3 scrollbar-none py-0.5">
          {cards.map((proj) => {
            const isActive = proj.id === activeProjectId
            const leafTasks = (proj.tasks || []) as TaskNode[]
            const waitCount = leafTasks.filter((t) => t.status === 'WAITING_REVIEW').length
            const runningCount = leafTasks.filter((t) => t.status === 'IN_PROGRESS').length

            return (
              <button
                key={proj.id}
                onClick={() => onSelectProject(proj.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                    : 'bg-transparent border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                }`}
                title={proj.title}
              >
                <span className="truncate max-w-[150px]">{proj.title}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                  {leafTasks.length}
                </span>
                {waitCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold">
                    {waitCount} 待验收
                  </span>
                )}
                {runningCount > 0 && waitCount === 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
                    {runningCount} 执行中
                  </span>
                )}
              </button>
            )
          })}

          {/* Add Project Tab Button */}
          <button
            onClick={onAddProject}
            className="w-7 h-7 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 text-slate-400 flex items-center justify-center shrink-0 transition-colors"
            title="新建任务线"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Actions: Compact Overview Popover + Save Status + Settings */}
        <div className="flex items-center gap-2.5 shrink-0 relative">
          {/* Popover Trigger: Compact Project Overview */}
          <button
            onClick={() => setShowOverviewPopover((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showOverviewPopover
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="查看所有项目列表与进度概览"
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>紧凑项目总览</span>
          </button>

          {/* Floating Compact Project Overview Popover */}
          {showOverviewPopover && (
            <div
              ref={popoverRef}
              className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  项目任务线总览 ({cards.length})
                </span>
                <button
                  onClick={() => setShowOverviewPopover(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {cards.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">暂无任何项目</div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
                  {cards.map((c) => {
                    const isActive = c.id === activeProjectId
                    const tasks = (c.tasks || []) as TaskNode[]
                    const doneCount = tasks.filter((t) => t.status === 'ACCEPTED').length
                    const waitCount = tasks.filter((t) => t.status === 'WAITING_REVIEW').length
                    const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0

                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          onSelectProject(c.id)
                          setShowOverviewPopover(false)
                        }}
                        className={`group p-2 rounded-lg cursor-pointer transition-colors border ${
                          isActive
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/80'
                            : 'bg-slate-50/50 dark:bg-slate-800/40 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={`font-semibold truncate max-w-[180px] ${
                              isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {c.title}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {waitCount > 0 && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
                                {waitCount} 待验收
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">{pct}%</span>
                            {onDuplicateProject && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDuplicateProject(c)
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-blue-500 rounded transition-opacity"
                                title="创建此项目副本"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                            {onDeleteProject && cards.length > 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (confirm(`确定删除项目「${c.title}」？`)) {
                                    onDeleteProject(c.id)
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 rounded transition-opacity"
                                title="删除此项目"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    onAddProject()
                    setShowOverviewPopover(false)
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  <Plus className="w-3 h-3" />
                  <span>新建任务线</span>
                </button>
                {onAddSampleProject && (
                  <button
                    onClick={() => {
                      onAddSampleProject()
                      setShowOverviewPopover(false)
                    }}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>演示项目</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quiet Persistence Status Indicator */}
          <div
            className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500"
            title="本地数据持久化状态"
          >
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-slate-500 dark:text-slate-400">已保存</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span className="text-blue-500">保存中...</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-rose-600 dark:text-rose-400 font-medium">失败</span>
              </>
            )}
          </div>

          {/* System Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="系统设置与数据备份"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
