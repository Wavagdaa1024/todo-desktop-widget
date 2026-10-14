import React, { useState, useMemo } from 'react'
import type { TaskNode, OwnerType, Project } from '../../domain/types'
import { Copy, Check, GitBranch, ArrowRight, CornerDownRight, X } from 'lucide-react'

interface AgentHandoffInlineProps {
  project: Project
  node: TaskNode
  onHandoff: (
    targetAgent: OwnerType,
    mode: 'handoff' | 'parallel',
    newTitle: string,
    prompt: string
  ) => void
  onCancel: () => void
}

export const AgentHandoffInline: React.FC<AgentHandoffInlineProps> = ({
  project,
  node,
  onHandoff,
  onCancel
}) => {
  // Default target: alternate between GEMINI and CODEX
  const defaultTarget: OwnerType =
    node.owner === 'GEMINI' ? 'CODEX' : node.owner === 'CODEX' ? 'GEMINI' : 'GEMINI'

  const [targetAgent, setTargetAgent] = useState<OwnerType>(defaultTarget)
  const [mode, setMode] = useState<'handoff' | 'parallel'>('handoff')
  const [newTitle, setNewTitle] = useState(node.title)
  const [copied, setCopied] = useState(false)

  // Auto-compose default prompt context from node status, latest progress, and blockers
  const defaultPrompt = useMemo(() => {
    const latestEvent =
      node.events && node.events.length > 0
        ? node.events[node.events.length - 1]
        : null

    const blockers = (node.events || [])
      .filter((e) => e.type === 'BLOCKED' || Boolean(e.blockerReason))
      .map((e) => e.blockerReason || e.summary)

    let prompt = `# 协同任务指令：${newTitle || node.title}\n`
    prompt += `- 所属项目：${project.title}\n`
    prompt += `- 来源节点：${node.title}（原负责人：${node.owner || 'SELF'}）\n`
    prompt += `- 派发给：${targetAgent}\n`
    prompt += `- 任务模式：${mode === 'handoff' ? '后续移交（向下延伸）' : '并行分支（独立推进）'}\n`

    if (latestEvent) {
      prompt += `- 当前最新进展：${latestEvent.summary}\n`
    }
    if (blockers.length > 0) {
      prompt += `- 待解决阻碍：${blockers[blockers.length - 1]}\n`
    }
    if (node.acceptanceCriteria) {
      prompt += `- 验收标准：${node.acceptanceCriteria}\n`
    }
    if (node.notes) {
      prompt += `- 补充说明：${node.notes}\n`
    }
    prompt += `\n请以此为上下文继续开展工作。完成后输出自测与修改摘要。`
    return prompt
  }, [project.title, node, targetAgent, mode, newTitle])

  const [promptText, setPromptText] = useState(defaultPrompt)

  const handleCopyAndSubmit = async () => {
    const finalTitle = newTitle.trim() || node.title
    const finalPrompt = promptText.trim()

    // 1. Copy to clipboard
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(finalPrompt)
      } else if ((window as any).electronAPI?.system?.copyText) {
        await (window as any).electronAPI.system.copyText(finalPrompt)
      }
    } catch {
      // Fallback
    }

    setCopied(true)

    // 2. Commit handoff to create node in DAG
    setTimeout(() => {
      onHandoff(targetAgent, mode, finalTitle, finalPrompt)
    }, 300)
  }

  return (
    <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 space-y-3 animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
          <CornerDownRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>交给其他 AI（创建带上下文新方块）</span>
        </div>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
          title="取消交接"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Target Agent & Mode Row */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            交给哪个 Agent
          </label>
          <select
            value={targetAgent}
            onChange={(e) => setTargetAgent(e.target.value as OwnerType)}
            className="w-full px-2 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold outline-none text-xs"
          >
            <option value="GEMINI">Gemini</option>
            <option value="CODEX">Codex</option>
            <option value="SELF">自己</option>
            <option value="OTHER">其他</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            协同方式
          </label>
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-indigo-200 dark:border-indigo-800 p-0.5">
            <button
              type="button"
              onClick={() => setMode('handoff')}
              className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                mode === 'handoff'
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600'
              }`}
            >
              <ArrowRight className="w-3 h-3" />
              <span>移交</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('parallel')}
              className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                mode === 'parallel'
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600'
              }`}
            >
              <GitBranch className="w-3 h-3" />
              <span>并行</span>
            </button>
          </div>
        </div>
      </div>

      {/* Target Title */}
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          新方块目标名称
        </label>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="输入新方块目标名称..."
          className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs outline-none focus:border-indigo-500"
        />
      </div>

      {/* Editable Context Prompt */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span>生成的交接 Prompt（自动汇总，可直接修改）</span>
        </div>
        <textarea
          rows={4}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          className="w-full p-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono text-[11px] leading-relaxed outline-none resize-none focus:border-indigo-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          取消
        </button>

        <button
          type="button"
          onClick={handleCopyAndSubmit}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold text-xs shadow-xs transition-all ${
            copied
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white'
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '已复制 Prompt 并派发！' : '保存交接并复制 Prompt'}</span>
        </button>
      </div>
    </div>
  )
}
