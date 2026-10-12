import React, { useState, useEffect } from 'react'
import { Card, ProgressLog, OwnerType } from '../domain/types'
import { calculateProgress } from '../domain/calculator'
import { Clock, Copy, Check, History } from 'lucide-react'

interface AiWorkPanelProps {
  card: Card
  onUpdateCard: (updates: Partial<Card>) => void
  onAddProgressLog: (log: Omit<ProgressLog, 'id' | 'timestamp'>) => void
}

export const AiWorkPanel: React.FC<AiWorkPanelProps> = ({
  card,
  onUpdateCard,
  onAddProgressLog
}) => {
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const [copied, setCopied] = useState(false)
  const [showLogModal, setShowLogModal] = useState(false)

  // Track live elapsed minutes when AI_RUNNING
  useEffect(() => {
    if (card.status !== 'AI_RUNNING' || !card.aiWork.activeStartTime) {
      setElapsedMinutes(0)
      return
    }

    const calcElapsed = () => {
      const start = new Date(card.aiWork.activeStartTime!).getTime()
      const diffMs = Date.now() - start
      setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)))
    }

    calcElapsed()
    const timer = setInterval(calcElapsed, 30000) // update every 30s
    return () => clearInterval(timer)
  }, [card.status, card.aiWork.activeStartTime])

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

    const promptText = `【任务卡片】${card.title}
分类: ${card.category || '未分类'}
负责人: ${card.owner}
状态: ${card.status}
截止日期: ${card.dueDate || '无'}
完成进度: ${progress.doneLeaves}/${progress.totalLeaves} (${progress.percentage}%)

【当前工作概要】
正在处理: ${card.aiWork.currentTaskDescription || '未填写'}
最近进展: ${card.aiWork.recentProgress || '无'}
目前阻塞: ${card.aiWork.currentBlockers || '无'}
下一步行动: ${card.aiWork.nextAction || '未填写'}

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

  const handleRestartTimer = () => {
    onUpdateCard({
      aiWork: {
        ...card.aiWork,
        activeStartTime: new Date().toISOString()
      }
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
      {/* AI Running Timer Badge */}
      {card.status === 'AI_RUNNING' && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-medium">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>AI 执行中：已等待 {elapsedMinutes} 分钟</span>
          </div>
          <button
            onClick={handleRestartTimer}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200 underline"
          >
            重启计时
          </button>
        </div>
      )}

      {/* Inputs: Current Task Focus */}
      <div className="space-y-1.5 text-xs">
        <label className="text-slate-500 dark:text-slate-400 font-medium">
          正在处理什么:
        </label>
        <input
          type="text"
          value={card.aiWork.currentTaskDescription || ''}
          onChange={(e) =>
            onUpdateCard({
              aiWork: { ...card.aiWork, currentTaskDescription: e.target.value }
            })
          }
          placeholder="例如：让 Gemini 修复 fmu_bridge.py 时间步长同步..."
          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Grid of Recent Progress, Blockers, Next Action */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">
            最近进展:
          </label>
          <input
            type="text"
            value={card.aiWork.recentProgress || ''}
            onChange={(e) =>
              onUpdateCard({
                aiWork: { ...card.aiWork, recentProgress: e.target.value }
              })
            }
            placeholder="已完成的功能..."
            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">
            目前阻塞:
          </label>
          <input
            type="text"
            value={card.aiWork.currentBlockers || ''}
            onChange={(e) =>
              onUpdateCard({
                aiWork: { ...card.aiWork, currentBlockers: e.target.value }
              })
            }
            placeholder="遇到的错误或问题..."
            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        <div>
          <label className="text-slate-500 dark:text-slate-400 font-medium block mb-1">
            下一步行动:
          </label>
          <input
            type="text"
            value={card.aiWork.nextAction || ''}
            onChange={(e) =>
              onUpdateCard({
                aiWork: { ...card.aiWork, nextAction: e.target.value }
              })
            }
            placeholder="后续计划..."
            className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Footer Buttons: Log Progress & Copy Prompt & History */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            <span>登记进展与历史 ({card.aiWork.history.length})</span>
          </button>
        </div>

        <button
          onClick={handleCopyPrompt}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
            copied
              ? 'bg-emerald-600 text-white font-medium'
              : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800'
          }`}
          title="复制结构化任务说明，可直接粘贴给 Gemini / Codex"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? '已复制说明！' : '复制任务说明'}</span>
        </button>
      </div>

      {/* Progress History Modal */}
      {showLogModal && (
        <ProgressLogModal
          history={card.aiWork.history}
          onClose={() => setShowLogModal(false)}
          onAddLog={(newLog) => {
            onAddProgressLog(newLog)
          }}
        />
      )}
    </div>
  )
}

interface ProgressLogModalProps {
  history: ProgressLog[]
  onClose: () => void
  onAddLog: (log: Omit<ProgressLog, 'id' | 'timestamp'>) => void
}

const ProgressLogModal: React.FC<ProgressLogModalProps> = ({ history, onClose, onAddLog }) => {
  const [source, setSource] = useState<OwnerType>('GEMINI')
  const [summary, setSummary] = useState('')
  const [changedFiles, setChangedFiles] = useState('')
  const [testResults, setTestResults] = useState('')
  const [blockers, setBlockers] = useState('')
  const [nextAction, setNextAction] = useState('')

  const handleSave = () => {
    if (!summary.trim()) return
    onAddLog({
      source,
      summary: summary.trim(),
      changedFiles: changedFiles.trim() || undefined,
      testResults: testResults.trim() || undefined,
      blockers: blockers.trim() || undefined,
      nextAction: nextAction.trim() || undefined
    })
    setSummary('')
    setChangedFiles('')
    setTestResults('')
    setBlockers('')
    setNextAction('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden text-xs">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            <span>登记工作进展与历史记录</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* New Log Input Form */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="font-medium text-slate-700 dark:text-slate-200">追加新进展记录</div>
            <div className="flex items-center gap-3">
              <span className="text-slate-500">记录来源:</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as OwnerType)}
                className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
              >
                <option value="GEMINI">Gemini</option>
                <option value="CODEX">Codex</option>
                <option value="SELF">自己</option>
                <option value="OTHER">其他</option>
              </select>
            </div>

            <div>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="工作进展摘要 (必填)..."
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={changedFiles}
                onChange={(e) => setChangedFiles(e.target.value)}
                placeholder="改动文件 (纯文本，如: src/bridge.py)..."
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
              />
              <input
                type="text"
                value={testResults}
                onChange={(e) => setTestResults(e.target.value)}
                placeholder="测试结果说明..."
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="遗留问题 / 阻塞..."
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
              />
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="下一步计划..."
                className="w-full px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={handleSave}
                disabled={!summary.trim()}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                追加记录
              </button>
            </div>
          </div>

          {/* Historical Logs List */}
          <div className="space-y-2">
            <div className="font-medium text-slate-700 dark:text-slate-200">
              历史进展记录 ({history.length})
            </div>
            {history.length === 0 ? (
              <p className="text-slate-400 py-4 text-center">暂无历史进展记录</p>
            ) : (
              <div className="space-y-2">
                {[...history].reverse().map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        【{item.source}】{item.summary}
                      </span>
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    {item.changedFiles && (
                      <div className="text-slate-500">修改文件: {item.changedFiles}</div>
                    )}
                    {item.testResults && (
                      <div className="text-slate-500">测试结果: {item.testResults}</div>
                    )}
                    {item.blockers && (
                      <div className="text-rose-500">阻塞问题: {item.blockers}</div>
                    )}
                    {item.nextAction && (
                      <div className="text-blue-500">下一步: {item.nextAction}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
