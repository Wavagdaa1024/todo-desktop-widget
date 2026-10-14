import React, { useState } from 'react'
import type { TaskEvent } from '../../domain/types'
import { ChevronRight, ChevronDown, FileCode, AlertTriangle } from 'lucide-react'

interface NodeHistoryDisclosureProps {
  events: TaskEvent[]
}

export const NodeHistoryDisclosure: React.FC<NodeHistoryDisclosureProps> = ({ events = [] }) => {
  const [isOpen, setIsOpen] = useState(false)

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'ACCEPTED':
        return { label: '验收通过', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' }
      case 'REJECTED':
        return { label: '退回修改', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' }
      case 'BLOCKED':
        return { label: '申报阻塞', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' }
      case 'SUBMITTED':
        return { label: '提交验收', bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300' }
      case 'ASSIGNED':
        return { label: '任务派发', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300' }
      case 'STARTED':
        return { label: '开启执行', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300' }
      case 'PROGRESS':
      default:
        return { label: '进展记录', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
    }
  }

  const getSourceLabel = (source?: string) => {
    switch (source) {
      case 'GEMINI':
        return 'Gemini'
      case 'CODEX':
        return 'Codex'
      case 'SELF':
        return '用户手动'
      default:
        return source || '用户'
    }
  }

  return (
    <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors select-none"
      >
        <div className="flex items-center gap-1.5">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>历史记录 ({events.length} 条)</span>
        </div>
        <span className="text-[10px] text-slate-400 font-normal">
          {isOpen ? '点击收起' : '按需展开'}
        </span>
      </button>

      {isOpen && (
        <div className="p-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/80 space-y-2 max-h-60 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-slate-400 text-center py-3 text-xs italic">
              暂无历史记录，写一条进展开始追踪
            </p>
          ) : (
            <div className="space-y-2">
              {[...events].reverse().map((evt) => {
                const badge = getEventBadge(evt.type)
                const timeStr = new Date(evt.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
                return (
                  <div
                    key={evt.id}
                    className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.2 rounded font-semibold ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <span className="text-slate-500 font-medium">
                          {getSourceLabel(evt.source)}
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono">{timeStr}</span>
                    </div>

                    <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                      {evt.summary}
                    </p>

                    {evt.changedFiles && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono truncate">
                        <FileCode className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">文件：{evt.changedFiles}</span>
                      </div>
                    )}

                    {evt.blockerReason && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>阻塞原因：{evt.blockerReason}</span>
                      </div>
                    )}

                    {evt.testResults && (
                      <div className="text-[10px] text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                        {evt.testResults}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
