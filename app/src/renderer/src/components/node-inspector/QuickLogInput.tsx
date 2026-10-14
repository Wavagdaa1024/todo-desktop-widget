import React, { useState, useRef, useEffect } from 'react'
import { AlertCircle, CornerDownLeft, ArrowRight } from 'lucide-react'

interface QuickLogInputProps {
  nodeId: string
  onSubmitLog: (summary: string, isIssue: boolean) => void
  onOpenHandoff?: () => void
  showHandoff?: boolean
  disabled?: boolean
}

// Global draft cache across node switches so uncommitted text is never silently lost
const draftsByNodeId: Record<string, { text: string; isIssue: boolean }> = {}

export const QuickLogInput: React.FC<QuickLogInputProps> = ({
  nodeId,
  onSubmitLog,
  onOpenHandoff,
  showHandoff = false,
  disabled = false
}) => {
  const [logText, setLogText] = useState('')
  const [isIssue, setIsIssue] = useState(false)
  const isComposingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load draft when nodeId changes; save draft on unmount or switch
  useEffect(() => {
    const existing = draftsByNodeId[nodeId]
    if (existing) {
      setLogText(existing.text)
      setIsIssue(existing.isIssue)
    } else {
      setLogText('')
      setIsIssue(false)
    }
  }, [nodeId])

  // Keep draft cache updated in real time
  const handleTextChange = (val: string) => {
    setLogText(val)
    if (val.trim()) {
      draftsByNodeId[nodeId] = { text: val, isIssue }
    } else {
      delete draftsByNodeId[nodeId]
    }
  }

  const handleIssueToggle = (val: boolean) => {
    setIsIssue(val)
    if (logText.trim()) {
      draftsByNodeId[nodeId] = { text: logText, isIssue: val }
    }
  }

  const handleCommit = () => {
    const trimmed = logText.trim()
    if (!trimmed || disabled) return
    onSubmitLog(trimmed, isIssue)
    setLogText('')
    delete draftsByNodeId[nodeId]
    // Keep focus in textarea for rapid continuous logging
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // PRD Section 3.1 & 8: IME composition check — never submit while user is picking Chinese candidates!
    if (isComposingRef.current || e.nativeEvent.isComposing) {
      return
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCommit()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          随手记一条
        </label>
        {/* Type toggle: 进展 (default) vs 问题 */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60 text-[10px]">
          <button
            type="button"
            onClick={() => handleIssueToggle(false)}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              !isIssue
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            进展
          </button>
          <button
            type="button"
            onClick={() => handleIssueToggle(true)}
            className={`px-2 py-0.5 rounded font-medium transition-colors ${
              isIssue
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            问题 / 阻塞
          </button>
        </div>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          rows={2}
          value={logText}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            isComposingRef.current = true
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false
          }}
          placeholder={
            isIssue
              ? '遇到了什么问题？例如：缺少 MuJoCo 几何模型，采样步长不匹配...'
              : '做到哪了？例如：已完成信号映射，正在检查仿真步长...'
          }
          disabled={disabled}
          className={`w-full p-2.5 text-xs rounded-xl border bg-white dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all resize-none shadow-xs ${
            isIssue
              ? 'border-rose-300 dark:border-rose-800/80 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20'
              : 'border-slate-200 dark:border-slate-700/80 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20'
          }`}
        />
        <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1 text-[10px] text-slate-400 pointer-events-none select-none">
          <span>Enter 提交</span>
          <CornerDownLeft className="w-2.5 h-2.5 opacity-60" />
        </div>
      </div>

      {isIssue && (
        <div className="flex items-center gap-1.5 text-[10px] text-rose-600 dark:text-rose-400 bg-rose-50/70 dark:bg-rose-950/40 px-2 py-1 rounded-lg border border-rose-200/60 dark:border-rose-900/60">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>记录此问题将同时把节点标记为「阻塞」状态</span>
        </div>
      )}

      {/* Two Primary Action Buttons directly under quick input (PRD Section 2.3) */}
      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={handleCommit}
          disabled={!logText.trim() || disabled}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-semibold text-xs shadow-xs transition-all ${
            logText.trim()
              ? isIssue
                ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200/50 dark:border-slate-700/50'
          }`}
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
          <span>{isIssue ? '记录阻塞问题' : '记录进展'}</span>
        </button>

        {onOpenHandoff && (
          <button
            type="button"
            onClick={onOpenHandoff}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-semibold text-xs border transition-all ${
              showHandoff
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-700 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>交给其他 AI →</span>
          </button>
        )}
      </div>
    </div>
  )
}
