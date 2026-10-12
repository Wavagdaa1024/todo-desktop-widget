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
      {/* Top Bar: Title & Stats & Save status & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shadow-blue-500/20">
              ✓
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                AI Task Board
              </h1>
              <p className="text-xs text-slate-400 dark:text-slate-500">桌面任务工作台</p>
            </div>
          </div>

          {/* Save Status Indicator */}
          <div className="ml-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {saveStatus === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>已保存</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                <span>正在保存...</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">保存失败</span>
              </>
            )}
          </div>
        </div>

        {/* Overview Stats Badges */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => onFilterChange('ALL')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              currentFilter === 'ALL'
                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-medium border-transparent shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            全部 <span className="font-semibold ml-1">{totalCards}</span>
          </button>

          <button
            onClick={() => onFilterChange('TODO')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              currentFilter === 'TODO'
                ? 'bg-blue-600 text-white font-medium border-transparent shadow-sm shadow-blue-500/20'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            待开始 <span className="font-semibold ml-1">{todoCards}</span>
          </button>


          <button
            onClick={() => onFilterChange('AI_RUNNING')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              currentFilter === 'AI_RUNNING'
                ? 'bg-indigo-600 text-white font-medium border-transparent shadow-sm shadow-indigo-500/20'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100'
            }`}
          >
            AI 执行中 <span className="font-semibold ml-1">{aiRunningCards}</span>
          </button>

          <button
            onClick={() => onFilterChange('WAITING_ACCEPT')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              currentFilter === 'WAITING_ACCEPT'
                ? 'bg-amber-600 text-white font-medium border-transparent shadow-sm shadow-amber-500/20'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100'
            }`}
          >
            等待我验收 <span className="font-semibold ml-1">{waitingAcceptCards}</span>
          </button>

          <button
            onClick={() => onFilterChange('OVERDUE')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              currentFilter === 'OVERDUE'
                ? 'bg-rose-600 text-white font-medium border-transparent shadow-sm shadow-rose-500/20'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100'
            }`}
          >
            已逾期 <span className="font-semibold ml-1">{overdueCards}</span>
          </button>
        </div>

        {/* Main Action Buttons */}
        <div className="flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition-all active:scale-95"
            title="快捷键: Ctrl+N"
          >
            <Plus className="w-4 h-4" />
            <span>新增卡片</span>
            <kbd className="hidden sm:inline-block ml-1 px-1 py-0.5 text-[10px] bg-blue-700/60 rounded">Ctrl+N</kbd>
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

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {/* Search Box */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索卡片、任务、分类或进展摘要 (Ctrl+F)..."
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors text-slate-800 dark:text-slate-100 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-xs">
          {(
            [
              { key: 'ALL', label: '全部' },
              { key: 'TODO', label: '待开始' },
              { key: 'AI_RUNNING', label: 'AI 执行中' },
              { key: 'WAITING_ACCEPT', label: '等待我验收' },
              { key: 'BLOCKED', label: '阻塞' },
              { key: 'DONE', label: '已完成' },
              { key: 'OVERDUE', label: '已逾期' }
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => onFilterChange(item.key)}
              className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
                currentFilter === item.key
                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500/30'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>排序:</span>
          <select
            value={currentSort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
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
