import { Card, CardStatus } from '../domain/types'
import { isCardOverdue } from '../domain/date'
import { Plus, Search, Settings as SettingsIcon, X, CheckCircle2, RefreshCw, AlertCircle, Sparkles } from 'lucide-react'

export type FilterStatus = 'ALL' | CardStatus | 'OVERDUE'
export type SortOption = 'MANUAL' | 'UPDATED' | 'DUE_DATE'

interface HeaderProps {
  cards: Card[]
  searchQuery: string
  onSearchChange: (query: string) => void
  currentFilter: FilterStatus
  onFilterChange: (filter: FilterStatus) => void
  currentSort: SortOption
  onSortChange: (sort: SortOption) => void
  onAddCard: () => void
  onOpenSettings: () => void
  saveStatus: 'saved' | 'saving' | 'error'
  onAddSampleProject?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  cards,
  searchQuery,
  onSearchChange,
  currentFilter,
  onFilterChange,
  currentSort,
  onSortChange,
  onAddCard,
  onOpenSettings,
  saveStatus,
  onAddSampleProject
}) => {
  // Compute overall stats
  const totalCards = cards.length
  const todoCards = cards.filter((c) => c.status === 'TODO').length
  const aiRunningCards = cards.filter((c) => c.status === 'AI_RUNNING').length
  const waitingAcceptCards = cards.filter((c) => c.status === 'WAITING_ACCEPT').length
  const overdueCards = cards.filter((c) => isCardOverdue(c)).length

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 py-3 transition-colors">
      {/* Row 1: Brand & Concise Summary & Quiet Save Status & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shadow-blue-500/20 text-sm">
              ✓
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-snug">
                AI Task Board
              </h1>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-none">桌面任务工作台</p>
            </div>
          </div>

          {/* Concise Text Summary (Replaces redundant top filter buttons) */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pl-3 border-l border-slate-200 dark:border-slate-800">
            <span>{totalCards} 个任务</span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className={waitingAcceptCards > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
              {waitingAcceptCards} 个待验收
            </span>
            {aiRunningCards > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">{aiRunningCards} 个执行中</span>
              </>
            )}
            {overdueCards > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-rose-600 dark:text-rose-400 font-medium">{overdueCards} 个已逾期</span>
              </>
            )}
          </div>
        </div>

        {/* Right Actions: Save Status + Sample + Add Card + Settings */}
        <div className="flex items-center gap-2.5">
          {/* Quiet Save Status Indicator */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 mr-1" title="本地数据持久化状态">
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-slate-500 dark:text-slate-400">已保存</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span className="text-blue-500">正在保存...</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-rose-600 dark:text-rose-400 font-medium">保存失败</span>
              </>
            )}
          </div>

          {onAddSampleProject && totalCards === 0 && (
            <button
              onClick={onAddSampleProject}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>载入示例项目</span>
            </button>
          )}

          <button
            onClick={onAddCard}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-lg shadow-sm shadow-blue-500/20 transition-all"
            title="快捷键: Ctrl+N"
          >
            <Plus className="w-4 h-4" />
            <span>+ 新建卡片</span>
            <kbd className="hidden md:inline-block ml-1 px-1 py-0.5 text-[10px] bg-blue-700/60 rounded font-normal">Ctrl+N</kbd>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="系统设置"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Search + Single Unified Filter Group + Sort Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {/* Search Box */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索任务或内容 (Ctrl+F)..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* The Single Unified Status Filter Group */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 text-xs">
          {(
            [
              { key: 'ALL', label: '全部', count: totalCards },
              { key: 'TODO', label: '待开始', count: todoCards },
              { key: 'AI_RUNNING', label: 'AI 执行中', count: aiRunningCards },
              { key: 'WAITING_ACCEPT', label: '待验收', count: waitingAcceptCards },
              { key: 'BLOCKED', label: '阻塞', count: cards.filter((c) => c.status === 'BLOCKED').length },
              { key: 'DONE', label: '已完成', count: cards.filter((c) => c.status === 'DONE').length },
              { key: 'OVERDUE', label: '已逾期', count: overdueCards }
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => onFilterChange(item.key)}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap text-xs ${
                currentFilter === item.key
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500/30'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>{item.label}</span>
              {item.count > 0 && (
                <span className={`ml-1 text-[11px] ${currentFilter === item.key ? 'font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>排序:</span>
          <select
            value={currentSort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
          >
            <option value="MANUAL">手动排序</option>
            <option value="UPDATED">最近更新</option>
            <option value="DUE_DATE">截止日期</option>
          </select>
        </div>
      </div>
    </header>
  )
}
