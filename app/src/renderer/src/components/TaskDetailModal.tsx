import React, { useState } from 'react'
import { Card, OwnerType, ProgressLog } from '../domain/types'
import { calculateProgress } from '../domain/calculator'
import {
  Sparkles,
  History,
  Copy,
  Check,
  FileText,
  X
} from 'lucide-react'

interface TaskDetailModalProps {
  card: Card
  onClose: () => void
  onUpdateCard: (updates: Partial<Card>) => void
  onAddProgressLog: (log: Omit<ProgressLog, 'id' | 'timestamp'>) => void
  initialTab?: 'details' | 'ai' | 'history'
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  card,
  onClose,
  onUpdateCard,
  onAddProgressLog,
  initialTab = 'details'
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'ai' | 'history'>(initialTab)

  // Draft state for details
  const [titleDraft, setTitleDraft] = useState(card.title)
  const [dueDateDraft, setDueDateDraft] = useState(card.dueDate || '')
  const [categoryDraft, setCategoryDraft] = useState(card.category || '')
  const [descDraft, setDescDraft] = useState(card.description || '')

  // Draft state for AI Work fields
  const [currentTaskDraft, setCurrentTaskDraft] = useState(card.aiWork.currentTaskDescription || '')
  const [recentProgressDraft, setRecentProgressDraft] = useState(card.aiWork.recentProgress || '')
  const [blockersDraft, setBlockersDraft] = useState(card.aiWork.currentBlockers || '')
  const [nextActionDraft, setNextActionDraft] = useState(card.aiWork.nextAction || '')

  // State for new progress log
  const [logSource, setLogSource] = useState<OwnerType>(card.owner || 'GEMINI')
  const [logSummary, setLogSummary] = useState('')
  const [logChangedFiles, setLogChangedFiles] = useState('')
  const [logTestResults, setLogTestResults] = useState('')
  const [logBlockers, setLogBlockers] = useState('')
  const [logNextAction, setLogNextAction] = useState('')

  const [copied, setCopied] = useState(false)

  const handleCopyPrompt = async () => {
    const progress = calculateProgress(card.tasks)
    let taskTreeText = ''

    function formatTasks(list: typeof card.tasks, indent = ''): void {
      for (const t of list) {
        taskTreeText += `${indent}- [${t.completed ? 'x' : ' '}] ${t.title}\n`
        if (t.children && t.children.length > 0) {
          formatTasks(t.children, indent + '  ')
        }
      }
    }
    formatTasks(card.tasks)

    const promptText = `【任务卡片】${titleDraft}
分类: ${categoryDraft || '未分类'}
负责人: ${card.owner}
状态: ${card.status}
截止日期: ${dueDateDraft || '无'}
完成进度: ${progress.doneLeaves}/${progress.totalLeaves} (${progress.percentage}%)

【当前工作概要】
正在处理: ${currentTaskDraft || '未填写'}
最近进展: ${recentProgressDraft || '无'}
目前阻塞: ${blockersDraft || '无'}
下一步行动: ${nextActionDraft || '未填写'}

【项目背景与描述】
${descDraft || '无'}

【子任务清单】
${taskTreeText || '(暂无子任务)'}
`

    if (window.electronAPI?.system?.copyText) {
      await window.electronAPI.system.copyText(promptText)
    } else {
      await navigator.clipboard.writeText(promptText)
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveAll = () => {
    onUpdateCard({
      title: titleDraft.trim() || card.title,
      dueDate: dueDateDraft || undefined,
      category: categoryDraft.trim() || undefined,
      description: descDraft.trim() || undefined,
      aiWork: {
        ...card.aiWork,
        currentTaskDescription: currentTaskDraft.trim() || undefined,
        recentProgress: recentProgressDraft.trim() || undefined,
        currentBlockers: blockersDraft.trim() || undefined,
        nextAction: nextActionDraft.trim() || undefined
      }
    })
    onClose()
  }

  const handleAddLogSubmit = () => {
    if (!logSummary.trim()) return
    onAddProgressLog({
      source: logSource,
      summary: logSummary.trim(),
      changedFiles: logChangedFiles.trim() || undefined,
      testResults: logTestResults.trim() || undefined,
      blockers: logBlockers.trim() || undefined,
      nextAction: logNextAction.trim() || undefined
    })
    // Auto sync to current AI draft fields
    setRecentProgressDraft(logSummary.trim())
    if (logBlockers.trim()) setBlockersDraft(logBlockers.trim())
    if (logNextAction.trim()) setNextActionDraft(logNextAction.trim())

    setLogSummary('')
    setLogChangedFiles('')
    setLogTestResults('')
    setLogBlockers('')
    setLogNextAction('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-0 shadow-2xl max-w-xl w-full text-xs flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight">
                任务详情与 AI 进展设置
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-xs">
                {card.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyPrompt}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all ${
                copied
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 border border-blue-200 dark:border-blue-800/80'
              }`}
              title="复制结构化 Prompt，可直接发给 AI"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '已复制 Prompt' : '复制 Prompt'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium text-xs transition-colors ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>基本信息与截止日</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium text-xs transition-colors ${
              activeTab === 'ai'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI 协同工作状态</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium text-xs transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>进展记录与历史 ({card.aiWork.history.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'details' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  任务卡片标题
                </label>
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    截止日期 (YYYY-MM-DD)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={dueDateDraft}
                      onChange={(e) => setDueDateDraft(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs"
                    />
                    {dueDateDraft && (
                      <button
                        onClick={() => setDueDateDraft('')}
                        className="px-2 py-1 text-slate-400 hover:text-slate-600 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    项目分类 / 标签
                  </label>
                  <input
                    type="text"
                    placeholder="如: 控制调试、仿真测试、技术文档..."
                    value={categoryDraft}
                    onChange={(e) => setCategoryDraft(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  任务描述 / 交付目标
                </label>
                <textarea
                  rows={4}
                  placeholder="简述该任务卡片的背景、核心交付目标与完成标准..."
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs resize-none"
                />
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  当前正在处理什么
                </label>
                <input
                  type="text"
                  placeholder="如: 让 Gemini 修复 fmu_bridge.py 时间步长同步..."
                  value={currentTaskDraft}
                  onChange={(e) => setCurrentTaskDraft(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">此内容将在卡片正面及悬浮小窗重点卡片单行展示</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  下一步行动
                </label>
                <input
                  type="text"
                  placeholder="如: 运行 test_step.py 验证动力学收敛..."
                  value={nextActionDraft}
                  onChange={(e) => setNextActionDraft(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">此内容将在卡片正面及悬浮小窗重点展示</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    最近进展
                  </label>
                  <textarea
                    rows={3}
                    placeholder="已完成的功能或改动记录..."
                    value={recentProgressDraft}
                    onChange={(e) => setRecentProgressDraft(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    当前遗留 / 阻塞问题
                  </label>
                  <textarea
                    rows={3}
                    placeholder="遇到的错误、卡点或依赖..."
                    value={blockersDraft}
                    onChange={(e) => setBlockersDraft(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 text-xs resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Add Progress Record Subform */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                    追加新进展记录
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px]">执行方:</span>
                    <select
                      value={logSource}
                      onChange={(e) => setLogSource(e.target.value as OwnerType)}
                      className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
                    >
                      <option value="GEMINI">Gemini</option>
                      <option value="CODEX">Codex</option>
                      <option value="SELF">自己</option>
                      <option value="OTHER">其他</option>
                    </select>
                  </div>
                </div>

                <div>
                  <input
                    type="text"
                    value={logSummary}
                    onChange={(e) => setLogSummary(e.target.value)}
                    placeholder="工作进展摘要 (必填)..."
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={logChangedFiles}
                    onChange={(e) => setLogChangedFiles(e.target.value)}
                    placeholder="改动文件 (纯文本，如: src/bridge.py)..."
                    className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    value={logTestResults}
                    onChange={(e) => setLogTestResults(e.target.value)}
                    placeholder="测试结果说明..."
                    className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={logBlockers}
                    onChange={(e) => setLogBlockers(e.target.value)}
                    placeholder="遗留问题 / 阻塞..."
                    className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    value={logNextAction}
                    onChange={(e) => setLogNextAction(e.target.value)}
                    placeholder="下一步行动..."
                    className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleAddLogSubmit}
                    disabled={!logSummary.trim()}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
                  >
                    追加记录
                  </button>
                </div>
              </div>

              {/* Historical Logs List */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                  历史记录清单 ({card.aiWork.history.length})
                </div>
                {card.aiWork.history.length === 0 ? (
                  <p className="text-slate-400 py-4 text-center">暂无历史进展记录</p>
                ) : (
                  <div className="space-y-2">
                    {[...card.aiWork.history].reverse().map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            【{item.source}】{item.summary}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {item.changedFiles && (
                          <div className="text-slate-500 text-[11px]">改动文件: {item.changedFiles}</div>
                        )}
                        {item.testResults && (
                          <div className="text-slate-500 text-[11px]">测试结果: {item.testResults}</div>
                        )}
                        {item.blockers && (
                          <div className="text-rose-500 text-[11px]">阻塞问题: {item.blockers}</div>
                        )}
                        {item.nextAction && (
                          <div className="text-blue-500 text-[11px]">下一步: {item.nextAction}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/60 dark:bg-slate-900/60">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSaveAll}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm shadow-blue-500/20"
          >
            保存所有设置
          </button>
        </div>
      </div>
    </div>
  )
}
