import React, { useState, useRef, useEffect } from 'react'
import { Card, TaskItem, TaskNode, ProgressLog } from '../domain/types'
import {
  calculateProgress,
  addTaskToParent,
  deleteTaskItem,
  restoreTaskItem,
  updateTaskItem,
  toggleTask,
  reconcileCardStatus
} from '../domain/calculator'
import { formatDueDateBadge, isCardOverdue } from '../domain/date'
import { TaskTree } from './TaskTree'
import { TaskDetailModal } from './TaskDetailModal'
import {
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Copy,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Calendar,
  Plus,
  Clock,
  FileText,
  Check
} from 'lucide-react'

interface TaskCardProps {
  card: Card
  currentSort?: string
  onUpdateCard: (updates: Partial<Card>) => void
  onDeleteCard: (cardId: string) => void
  onDuplicateCard: (card: Card) => void
  onMoveOrder: (direction: 'up' | 'down') => void
  onDropOrder?: (sourceId: string, targetId: string) => void
  isFirst: boolean
  isLast: boolean
  onNotifyUndo?: (message: string, undoAction: () => void) => void
  onOpenNodeDrawer?: (node: TaskNode) => void
}

export const TaskCard: React.FC<TaskCardProps> = ({
  card,
  currentSort,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
  onMoveOrder,
  onDropOrder,
  isFirst,
  isLast,
  onNotifyUndo,
  onOpenNodeDrawer
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(card.title)
  const [isComposing, setIsComposing] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showAddTaskInput, setShowAddTaskInput] = useState(false)
  const [newTaskInput, setNewTaskInput] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDoneConfirm, setShowDoneConfirm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [detailModalTab, setDetailModalTab] = useState<'details' | 'ai' | 'history'>('details')
  const [isDragOver, setIsDragOver] = useState(false)
  const [copied, setCopied] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  const isManualSort = !currentSort || currentSort === 'MANUAL'
  const titleInputRef = useRef<HTMLInputElement>(null)
  const addTaskInputRef = useRef<HTMLInputElement>(null)
  const progress = calculateProgress(card.tasks)
  const isOverdue = isCardOverdue(card)
  const dateBadge = formatDueDateBadge(card.dueDate, card.status === 'DONE')

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

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
    const timer = setInterval(calcElapsed, 30000)
    return () => clearInterval(timer)
  }, [card.status, card.aiWork.activeStartTime])

  const handleSaveTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== card.title) {
      onUpdateCard({ title: trimmed })
    }
    setIsEditingTitle(false)
  }

  const handleKeyDownTitle = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveTitle()
    } else if (e.key === 'Escape') {
      setTitleDraft(card.title)
      setIsEditingTitle(false)
    }
  }



  const handleConfirmBatchDone = () => {
    function completeAll(tasks: TaskItem[]): TaskItem[] {
      return tasks.map((t) => ({
        ...t,
        completed: true,
        children: completeAll(t.children)
      }))
    }
    const updatedTasks = completeAll(card.tasks)
    onUpdateCard({
      tasks: updatedTasks,
      status: 'DONE'
    })
    setShowDoneConfirm(false)
  }

  // Task tree operations
  const handleToggleTask = (taskId: string) => {
    const { updatedTasks } = toggleTask(card.tasks, taskId)
    const reconciled = reconcileCardStatus(card, updatedTasks)
    onUpdateCard({
      tasks: reconciled.tasks,
      status: reconciled.status
    })
  }

  const handleAddTopTask = () => {
    const trimmed = newTaskInput.trim()
    if (!trimmed) return
    const nextTasks = addTaskToParent(card.tasks, null, trimmed)
    const reconciled = reconcileCardStatus(card, nextTasks)
    onUpdateCard({ tasks: reconciled.tasks, status: reconciled.status })
    setNewTaskInput('')
    setShowAddTaskInput(false)
  }

  const handleAddSubtask = (parentId: string, title: string) => {
    const updatedTasks = addTaskToParent(card.tasks, parentId, title.trim())
    const reconciled = reconcileCardStatus(card, updatedTasks)
    onUpdateCard({ tasks: reconciled.tasks, status: reconciled.status })
  }

  const handleUpdateTask = (
    taskId: string,
    updates: Partial<Pick<TaskItem, 'title' | 'dueDate' | 'notes'>>
  ) => {
    const updatedTasks = updateTaskItem(card.tasks, taskId, updates)
    onUpdateCard({ tasks: updatedTasks })
  }

  const handleDeleteTask = (taskId: string) => {
    const { updatedTasks, deletedTask, parentId, originalIndex } = deleteTaskItem(card.tasks, taskId)
    if (!deletedTask) return
    const reconciled = reconcileCardStatus(card, updatedTasks)
    onUpdateCard({ tasks: reconciled.tasks, status: reconciled.status })

    if (onNotifyUndo) {
      onNotifyUndo(`已删除任务「${deletedTask.title}」`, () => {
        onUpdateCard({
          tasks: restoreTaskItem(card.tasks, deletedTask, parentId, originalIndex)
        })
      })
    }
  }

  const handleAddProgressLog = (log: Omit<ProgressLog, 'id' | 'timestamp'>) => {
    const newLogItem: ProgressLog = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      ...log
    }
    onUpdateCard({
      aiWork: {
        ...card.aiWork,
        recentProgress: log.summary,
        currentBlockers: log.blockers || card.aiWork.currentBlockers,
        nextAction: log.nextAction || card.aiWork.nextAction,
        history: [...card.aiWork.history, newLogItem]
      }
    })
  }

  const handleRestartTimer = () => {
    onUpdateCard({
      aiWork: {
        ...card.aiWork,
        activeStartTime: new Date().toISOString()
      }
    })
  }

  const handleCopyPrompt = async () => {
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

【项目背景与描述】
${card.description || '无'}

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

  return (
    <div
      onDragOver={(e) => {
        if (isManualSort) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setIsDragOver(true)
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (!isManualSort) return
        e.preventDefault()
        setIsDragOver(false)
        const sourceId = e.dataTransfer.getData('text/plain')
        if (sourceId && sourceId !== card.id && onDropOrder) {
          onDropOrder(sourceId, card.id)
        }
      }}
      id={`project-${card.id}`}
      className={`group relative flex flex-col bg-white dark:bg-slate-900 border rounded-xl shadow-sm transition-all hover:shadow-md w-full max-w-[420px] ${
        isDragOver ? 'ring-2 ring-blue-500 shadow-lg scale-[1.01]' : ''
      } ${
        isOverdue
          ? 'border-rose-300 dark:border-rose-800/80 ring-1 ring-rose-400/20'
          : progress.waitingReviewLeaves > 0
          ? 'border-purple-300 dark:border-purple-800/80 ring-1 ring-purple-400/20'
          : progress.blockedLeaves > 0
          ? 'border-rose-300 dark:border-rose-800/80 ring-1 ring-rose-400/20'
          : progress.percentage === 100
          ? 'border-emerald-200 dark:border-emerald-800/40 opacity-90'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Header Row */}
      <div className="p-3.5 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Reorder handle & Expand button & Title */}
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            {/* Reorder Buttons & Grip Handle */}
            <div
              draggable={isManualSort}
              onDragStart={(e) => {
                if (!isManualSort) return
                e.dataTransfer.setData('text/plain', card.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              className={`flex items-center -mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity ${
                isManualSort ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
              }`}
              title={
                isManualSort
                  ? '按住拖动卡片重排，或点击上下箭头移动'
                  : '当前为自动排序模式（按更新/截止日期）。切换为“手动排序”后可自由拖动'
              }
            >
              <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-0.5 self-center" />
              <div className="flex flex-col">
                <button
                  disabled={isFirst || !isManualSort}
                  onClick={() => onMoveOrder('up')}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
                  title={isManualSort ? '向上移动' : '仅在手动排序模式下可移动'}
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  disabled={isLast || !isManualSort}
                  onClick={() => onMoveOrder('down')}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
                  title={isManualSort ? '向下移动' : '仅在手动排序模式下可移动'}
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Collapse / Expand toggle */}
            <button
              onClick={() => onUpdateCard({ collapsed: !card.collapsed })}
              className="p-1 -ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
              title={card.collapsed ? '展开卡片' : '折叠卡片'}
            >
              {card.collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {/* Title / Edit inline */}
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onKeyDown={handleKeyDownTitle}
                  onBlur={handleSaveTitle}
                  className="w-full px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-blue-500 rounded text-sm font-semibold focus:outline-none"
                />
              ) : (
                <div
                  onDoubleClick={() => setIsEditingTitle(true)}
                  className="flex items-center gap-1.5 cursor-pointer"
                  title="双击重命名卡片"
                >
                  <h3
                    className={`font-semibold text-sm leading-snug truncate ${
                      card.status === 'DONE'
                        ? 'text-slate-500 dark:text-slate-400 line-through'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {card.title}
                  </h3>
                  {card.category && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {card.category}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: Menu & Actions */}
          <div className="relative flex items-center gap-1">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-6 z-20 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 text-xs">
                <button
                  onClick={() => {
                    setDetailModalTab('details')
                    setShowDetailModal(true)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>编辑详情/截止日</span>
                </button>
                <button
                  onClick={() => {
                    setDetailModalTab('history')
                    setShowDetailModal(true)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>登记工作进展/历史</span>
                </button>
                <button
                  onClick={() => {
                    handleCopyPrompt()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-emerald-500" />
                  <span>复制任务 Prompt</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                <button
                  onClick={() => {
                    setIsEditingTitle(true)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  重命名卡片
                </button>
                <button
                  onClick={() => {
                    onDuplicateCard(card)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制卡片</span>
                </button>
                <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>删除卡片...</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Project Aggregate Metrics & Due Date Row */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
            <span>
              已验收 {progress.acceptedLeaves}/{progress.totalLeaves}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className={progress.inProgressLeaves > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}>
              执行中 {progress.inProgressLeaves}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span className={progress.waitingReviewLeaves > 0 ? 'text-purple-600 dark:text-purple-400 font-semibold' : ''}>
              待验收 {progress.waitingReviewLeaves}
            </span>
            {progress.blockedLeaves > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                  阻塞 {progress.blockedLeaves}
                </span>
              </>
            )}
          </div>

          {/* Due date badge (clickable to edit) */}
          {dateBadge && (
            <button
              onClick={() => {
                setDetailModalTab('details')
                setShowDetailModal(true)
              }}
              title="点击修改卡片截止日期与详情"
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono hover:opacity-80 transition-opacity ${
                dateBadge.status === 'OVERDUE'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold'
                  : dateBadge.status === 'TODAY'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {dateBadge.text}
            </button>
          )}
        </div>

        {/* Progress bar line */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-mono">
            <span>完成率</span>
            <span className="font-semibold">{progress.percentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progress.percentage === 100
                  ? 'bg-emerald-500'
                  : progress.blockedLeaves > 0
                  ? 'bg-rose-500'
                  : progress.waitingReviewLeaves > 0
                  ? 'bg-purple-500'
                  : progress.inProgressLeaves > 0
                  ? 'bg-blue-500'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Body: Tasks & Operations */}
      {!card.collapsed && (
        <div className="px-3.5 pb-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          {/* Optional Card Description */}
          {card.description && (
            <div className="text-xs text-slate-500 dark:text-slate-400 pb-1 italic">
              {card.description}
            </div>
          )}

          {/* Task Tree (Parallel Task Line) */}
          {card.tasks.length > 0 ? (
            <TaskTree
              tasks={card.tasks}
              onToggleTask={handleToggleTask}
              onAddSubtask={handleAddSubtask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onOpenNodeDrawer={onOpenNodeDrawer}
            />
          ) : (
            <p className="text-[11px] text-slate-400 py-2 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              暂无子任务，点击下方「＋ 添加任务」开始创建
            </p>
          )}

          {/* Quick Add Top-level Task Button or Input */}
          {showAddTaskInput ? (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                ref={addTaskInputRef}
                type="text"
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isComposing && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    handleAddTopTask()
                  } else if (e.key === 'Escape') {
                    setShowAddTaskInput(false)
                    setNewTaskInput('')
                  }
                }}
                onBlur={() => {
                  if (!newTaskInput.trim()) {
                    setShowAddTaskInput(false)
                  }
                }}
                placeholder="输入新任务内容 (按 Enter 保存，Esc 取消)..."
                className="flex-1 px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={handleAddTopTask}
                className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 font-medium"
              >
                添加
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setShowAddTaskInput(true)
                setTimeout(() => addTaskInputRef.current?.focus(), 50)
              }}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 py-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ 添加任务</span>
            </button>
          )}

          {/* AI Timer if AI_RUNNING */}
          {card.status === 'AI_RUNNING' && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 text-xs">
              <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300 font-medium">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
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

          {/* Action Bar at bottom of card */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                setDetailModalTab('details')
                setShowDetailModal(true)
              }}
              className="flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors py-0.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>详情与进展...</span>
            </button>

            <button
              onClick={handleCopyPrompt}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all text-[11px] ${
                copied
                  ? 'text-emerald-600 font-medium'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
              title="复制任务 Prompt"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? '已复制 Prompt' : '复制 Prompt'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Delete Card Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xl max-w-sm w-full text-xs space-y-3">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>确认删除卡片？</span>
            </h4>
            <p className="text-slate-600 dark:text-slate-400">
              删除卡片「<span className="font-semibold text-slate-800 dark:text-slate-200">{card.title}</span>」将同时彻底移除其所有子任务树和历史工作记录。
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                取消
              </button>
              <button
                onClick={() => {
                  onDeleteCard(card.id)
                  setShowDeleteConfirm(false)
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Done Confirmation Modal */}
      {showDoneConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xl max-w-sm w-full text-xs space-y-3">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>完成全部任务？</span>
            </h4>
            <p className="text-slate-600 dark:text-slate-400">
              当前仍有{' '}
              <span className="font-bold text-blue-600">
                {progress.totalLeaves - progress.doneLeaves}
              </span>{' '}
              个子任务未勾选完成。将卡片标记为已完成将同时把所有子任务置为完成状态。
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDoneConfirm(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                取消
              </button>
              <button
                onClick={handleConfirmBatchDone}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                批量全部完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Card Detail Edit Modal */}
      {showDetailModal && (
        <TaskDetailModal
          card={card}
          initialTab={detailModalTab}
          onClose={() => setShowDetailModal(false)}
          onUpdateCard={onUpdateCard}
          onAddProgressLog={handleAddProgressLog}
        />
      )}
    </div>
  )
}
