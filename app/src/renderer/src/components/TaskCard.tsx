import React, { useState, useRef, useEffect } from 'react'
import { Card, CardStatus, OwnerType, TaskItem, ProgressLog } from '../domain/types'
import {
  calculateProgress,
  addTaskToParent,
  deleteTaskItem,
  updateTaskItem,
  toggleTask,
  reconcileCardStatus
} from '../domain/calculator'
import { formatDueDateBadge, isCardOverdue } from '../domain/date'
import { TaskTree } from './TaskTree'
import { AiWorkPanel } from './AiWorkPanel'
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
  Calendar
} from 'lucide-react'


interface TaskCardProps {
  card: Card
  onUpdateCard: (updates: Partial<Card>) => void
  onDeleteCard: (cardId: string) => void
  onDuplicateCard: (card: Card) => void
  onMoveOrder: (direction: 'up' | 'down') => void
  isFirst: boolean
  isLast: boolean
  onNotifyUndo?: (message: string, undoAction: () => void) => void
}

export const TaskCard: React.FC<TaskCardProps> = ({
  card,
  onUpdateCard,
  onDeleteCard,
  onDuplicateCard,
  onMoveOrder,
  isFirst,
  isLast,
  onNotifyUndo
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(card.title)
  const [isComposing, setIsComposing] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [newTaskInput, setNewTaskInput] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDoneConfirm, setShowDoneConfirm] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [cardDueDateDraft, setCardDueDateDraft] = useState(card.dueDate || '')
  const [cardCategoryDraft, setCardCategoryDraft] = useState(card.category || '')
  const [cardDescDraft, setCardDescDraft] = useState(card.description || '')

  const titleInputRef = useRef<HTMLInputElement>(null)
  const progress = calculateProgress(card.tasks)
  const isOverdue = isCardOverdue(card)
  const dateBadge = formatDueDateBadge(card.dueDate, card.status === 'DONE')

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

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

  const handleStatusChange = (newStatus: CardStatus) => {
    if (newStatus === 'DONE') {
      // Check if there are uncompleted leaves
      if (progress.totalLeaves > 0 && progress.doneLeaves < progress.totalLeaves) {
        setShowDoneConfirm(true)
        return
      }
    }

    if (newStatus === 'AI_RUNNING') {
      onUpdateCard({
        status: newStatus,
        aiWork: {
          ...card.aiWork,
          activeStartTime: new Date().toISOString()
        }
      })
    } else {
      onUpdateCard({ status: newStatus })
    }
  }

  const handleConfirmBatchDone = () => {
    // Complete all leaves
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
    onUpdateCard({ tasks: reconciled.tasks, status: reconciled.status })
  }

  const handleAddTopTask = () => {
    const trimmed = newTaskInput.trim()
    if (!trimmed) return
    const updated = addTaskToParent(card.tasks, null, trimmed)
    const reconciled = reconcileCardStatus(card, updated)
    onUpdateCard({ tasks: reconciled.tasks, status: reconciled.status })
    setNewTaskInput('')
  }

  const handleAddSubtask = (parentId: string, title: string, dueDate?: string) => {
    const updated = addTaskToParent(card.tasks, parentId, title, { dueDate })
    const reconciled = reconcileCardStatus(card, updated)
    onUpdateCard({ tasks: reconciled.tasks, status: reconciled.status })
  }

  const handleUpdateTask = (
    taskId: string,
    updates: Partial<Pick<TaskItem, 'title' | 'notes' | 'dueDate'>>
  ) => {
    const updated = updateTaskItem(card.tasks, taskId, updates)
    const reconciled = reconcileCardStatus(card, updated)
    onUpdateCard({ tasks: reconciled.tasks, status: reconciled.status })
  }

  const handleDeleteTask = (taskId: string) => {
    const previousTasks = [...card.tasks]
    const previousStatus = card.status
    const { updatedTasks } = deleteTaskItem(card.tasks, taskId)
    const reconciled = reconcileCardStatus(card, updatedTasks)
    onUpdateCard({ tasks: reconciled.tasks, status: reconciled.status })

    if (onNotifyUndo) {
      onNotifyUndo('已删除任务', () => {
        onUpdateCard({ tasks: previousTasks, status: previousStatus })
      })
    }
  }

  const handleSaveCardDetails = () => {
    onUpdateCard({
      dueDate: cardDueDateDraft || undefined,
      category: cardCategoryDraft.trim() || undefined,
      description: cardDescDraft.trim() || undefined
    })
    setShowDetailModal(false)
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

  return (
    <div
      className={`group relative flex flex-col bg-white dark:bg-slate-900 border rounded-xl shadow-sm transition-all hover:shadow-md ${
        isOverdue
          ? 'border-rose-300 dark:border-rose-800/80 ring-1 ring-rose-400/20'
          : card.status === 'WAITING_ACCEPT'
          ? 'border-amber-300 dark:border-amber-800/80 ring-1 ring-amber-400/20'
          : card.status === 'AI_RUNNING'
          ? 'border-indigo-300 dark:border-indigo-800/80 ring-1 ring-indigo-400/20'
          : card.status === 'DONE'
          ? 'border-emerald-200 dark:border-emerald-800/40 opacity-90'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Header Row */}
      <div className="p-3.5 pb-2">
        <div className="flex items-start justify-between gap-2">
          {/* Left: Reorder handle & Expand button & Title */}
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            {/* Reorder Buttons & Grip Handle (P2-05) */}
            <div className="flex items-center -mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-0.5 self-center" />
              <div className="flex flex-col">
                <button
                  disabled={isFirst}
                  onClick={() => onMoveOrder('up')}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
                  title="向上移动"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  disabled={isLast}
                  onClick={() => onMoveOrder('down')}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20"
                  title="向下移动"
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
              <div className="absolute right-0 top-6 z-20 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 text-xs">
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
                    setCardDueDateDraft(card.dueDate || '')
                    setCardCategoryDraft(card.category || '')
                    setCardDescDraft(card.description || '')
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


        {/* Status & Owner & Progress Meta Row (Visible even when folded) */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Status selector */}
          <div className="flex items-center gap-2">
            <select
              value={card.status}
              onChange={(e) => handleStatusChange(e.target.value as CardStatus)}
              className={`px-2 py-0.5 rounded font-medium text-xs border focus:outline-none ${
                card.status === 'TODO'
                  ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  : card.status === 'AI_RUNNING'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                  : card.status === 'WAITING_ACCEPT'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                  : card.status === 'BLOCKED'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
              }`}
            >
              <option value="TODO">待开始</option>
              <option value="AI_RUNNING">AI 执行中</option>
              <option value="WAITING_ACCEPT">等待我验收</option>
              <option value="BLOCKED">阻塞</option>
              <option value="DONE">已完成</option>
            </select>

            {/* Owner badge */}
            <select
              value={card.owner}
              onChange={(e) => onUpdateCard({ owner: e.target.value as OwnerType })}
              className="px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 bg-transparent border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
            >
              <option value="SELF">自己</option>
              <option value="GEMINI">Gemini</option>
              <option value="CODEX">Codex</option>
              <option value="OTHER">其他</option>
            </select>
          </div>

          {/* Due date badge (clickable to edit) */}
          {dateBadge && (
            <button
              onClick={() => {
                setCardDueDateDraft(card.dueDate || '')
                setCardCategoryDraft(card.category || '')
                setCardDescDraft(card.description || '')
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

        {/* Progress bar (Visible even when folded) */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-mono">
            <span>
              {progress.doneLeaves}/{progress.totalLeaves}
            </span>
            <span className="font-semibold">{progress.percentage}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progress.percentage === 100
                  ? 'bg-emerald-500'
                  : card.status === 'AI_RUNNING'
                  ? 'bg-indigo-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Body: Tasks & AI Info */}
      {!card.collapsed && (
        <div className="px-3.5 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {/* Optional Card Description */}
          {card.description && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 py-1 italic">
              {card.description}
            </div>
          )}

          {/* Quick Add Top-level Task with IME Composition Guard (P2-01) */}
          <div className="flex items-center gap-1.5 py-1.5 mb-1">
            <input
              type="text"
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isComposing && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleAddTopTask()
                }
              }}
              placeholder="+ 添加新任务 (按 Enter 保存)..."
              className="flex-1 px-2.5 py-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
            />
            {newTaskInput.trim() && (
              <button
                onClick={handleAddTopTask}
                className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700 font-medium"
              >
                添加
              </button>
            )}
          </div>


          {/* Task Tree */}
          {card.tasks.length > 0 ? (
            <TaskTree
              tasks={card.tasks}
              onToggleTask={handleToggleTask}
              onAddSubtask={handleAddSubtask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
            />
          ) : (
            <p className="text-[11px] text-slate-400 py-2 text-center">
              暂无子任务，在上方输入可直接添加
            </p>
          )}

          {/* AI Work & Progress History Panel */}
          <AiWorkPanel
            card={card}
            onUpdateCard={onUpdateCard}
            onAddProgressLog={handleAddProgressLog}
          />
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

      {/* Card Detail Edit Modal (P1-03) */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xl max-w-sm w-full text-xs space-y-4">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>编辑卡片详情与截止日期</span>
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  截止日期 (本地日历 YYYY-MM-DD)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={cardDueDateDraft}
                    onChange={(e) => setCardDueDateDraft(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                  />
                  {cardDueDateDraft && (
                    <button
                      onClick={() => setCardDueDateDraft('')}
                      className="px-2 py-1 text-slate-500 hover:text-slate-700 text-xs border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  项目分类
                </label>
                <input
                  type="text"
                  placeholder="如：控制调试、联合仿真、技术文档..."
                  value={cardCategoryDraft}
                  onChange={(e) => setCardCategoryDraft(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  项目描述 / 背景目标
                </label>
                <textarea
                  rows={3}
                  placeholder="简述该项目的主要任务目标与交付范围..."
                  value={cardDescDraft}
                  onChange={(e) => setCardDescDraft(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                取消
              </button>
              <button
                onClick={handleSaveCardDetails}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                保存详情
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

