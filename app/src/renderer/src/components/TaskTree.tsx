import React, { useState, useRef, useEffect } from 'react'
import { TaskItem, TaskNode, TaskNodeStatus, OwnerType } from '../domain/types'
import { isLeaf, getNodeCheckState, calculateProgress } from '../domain/calculator'
import { formatDueDateBadge } from '../domain/date'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Circle
} from 'lucide-react'

interface TaskTreeProps {
  tasks: TaskItem[]
  onToggleTask: (taskId: string) => void
  onAddSubtask: (parentId: string, title: string, dueDate?: string) => void
  onUpdateTask: (taskId: string, updates: Partial<Pick<TaskItem, 'title' | 'notes' | 'dueDate'>>) => void
  onDeleteTask: (taskId: string) => void
  onOpenNodeDrawer?: (node: TaskNode) => void
}

export const TaskTree: React.FC<TaskTreeProps> = ({
  tasks,
  onToggleTask,
  onAddSubtask,
  onUpdateTask,
  onDeleteTask,
  onOpenNodeDrawer
}) => {
  return (
    <div className="relative space-y-1.5 py-1">
      {tasks.map((task, index) => (
        <TaskRow
          key={task.id}
          task={task}
          depth={0}
          isLastSibling={index === tasks.length - 1}
          onToggleTask={onToggleTask}
          onAddSubtask={onAddSubtask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
          onOpenNodeDrawer={onOpenNodeDrawer}
        />
      ))}
    </div>
  )
}

interface TaskRowProps {
  task: TaskItem
  depth: number
  isLastSibling?: boolean
  onToggleTask: (taskId: string) => void
  onAddSubtask: (parentId: string, title: string, dueDate?: string) => void
  onUpdateTask: (taskId: string, updates: Partial<Pick<TaskItem, 'title' | 'notes' | 'dueDate'>>) => void
  onDeleteTask: (taskId: string) => void
  onOpenNodeDrawer?: (node: TaskNode) => void
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  depth,
  isLastSibling,
  onToggleTask,
  onAddSubtask,
  onUpdateTask,
  onDeleteTask,
  onOpenNodeDrawer
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDueDate, setEditDueDate] = useState(task.dueDate || '')
  const [editNotes, setEditNotes] = useState(task.notes || '')
  const [showAddSubtask, setShowAddSubtask] = useState(false)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [isComposing, setIsComposing] = useState(false)

  const checkboxRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const isLeafNode = isLeaf(task)
  const checkState = getNodeCheckState(task)
  const progress = !isLeafNode ? calculateProgress(task.children) : null

  // Update HTML indeterminate property
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = checkState === 'indeterminate'
    }
  }, [checkState])

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    if (showAddSubtask && addInputRef.current) {
      addInputRef.current.focus()
    }
  }, [showAddSubtask])

  const handleSaveEdit = () => {
    const trimmed = editTitle.trim()
    if (trimmed) {
      onUpdateTask(task.id, {
        title: trimmed,
        dueDate: editDueDate || undefined,
        notes: editNotes.trim() || undefined
      })
    }
    setIsEditing(false)
  }

  const handleKeyDownEdit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      setEditTitle(task.title)
      setEditDueDate(task.dueDate || '')
      setEditNotes(task.notes || '')
      setIsEditing(false)
    }
  }

  const handleSaveSubtask = () => {
    const trimmed = subtaskTitle.trim()
    if (trimmed) {
      onAddSubtask(task.id, trimmed)
      setSubtaskTitle('')
      setShowAddSubtask(false)
      setCollapsed(false)
    }
  }

  const handleKeyDownSubtask = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveSubtask()
    } else if (e.key === 'Escape') {
      setSubtaskTitle('')
      setShowAddSubtask(false)
    }
  }

  const dateBadge = formatDueDateBadge(task.dueDate, isLeafNode ? checkState === 'checked' : checkState === 'checked')

  // Extract task status and owner
  const nodeStatus: TaskNodeStatus = task.status || (task.completed ? 'ACCEPTED' : 'TODO')
  const nodeOwner: OwnerType = task.owner || 'SELF'
  const isRework = task.events?.some((e) => e.type === 'REJECTED')

  // Status icon component
  const renderStatusIcon = () => {
    if (!isLeafNode) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setCollapsed(!collapsed)
          }}
          className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )
    }

    switch (nodeStatus) {
      case 'ACCEPTED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      case 'WAITING_REVIEW':
        return <Clock className="w-4 h-4 text-purple-500 animate-pulse shrink-0" />
      case 'BLOCKED':
        return <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
      case 'IN_PROGRESS':
        return <CircleDot className="w-4 h-4 text-blue-500 animate-pulse shrink-0" />
      case 'TODO':
      default:
        return isRework ? (
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        ) : (
          <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
        )
    }
  }

  // Owner badge style
  const getOwnerBadge = () => {
    switch (nodeOwner) {
      case 'GEMINI':
        return { label: 'Gemini', cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' }
      case 'CODEX':
        return { label: 'Codex', cls: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border-teal-200 dark:border-teal-800' }
      case 'SELF':
        return { label: '自己', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' }
      case 'OTHER':
      default:
        return { label: '其他', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' }
    }
  }

  // Status badge style
  const getStatusBadge = () => {
    switch (nodeStatus) {
      case 'ACCEPTED':
        return { label: '已验收', cls: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' }
      case 'WAITING_REVIEW':
        return { label: '待验收', cls: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 font-semibold' }
      case 'BLOCKED':
        return { label: '阻塞', cls: 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 font-medium' }
      case 'IN_PROGRESS':
        return { label: '执行中', cls: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' }
      case 'TODO':
      default:
        return {
          label: isRework ? '需返工' : '待开始',
          cls: isRework
            ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 font-medium'
            : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60'
        }
    }
  }

  const ownerBadge = getOwnerBadge()
  const statusBadge = getStatusBadge()

  // Compute 1-line latest activity snippet
  const getLatestSnippet = (): string | null => {
    if (task.events && task.events.length > 0) {
      const last = task.events[task.events.length - 1]
      if (nodeStatus === 'WAITING_REVIEW') return `待验收：${last.summary}`
      if (nodeStatus === 'BLOCKED') return `阻塞：${last.blockerReason || last.summary}`
      if (nodeStatus === 'IN_PROGRESS') return `最近：${last.summary}`
      if (last.type === 'REJECTED') return `退回修改：${last.summary}`
    }
    if (task.notes) return `说明：${task.notes}`
    return null
  }

  const latestSnippet = getLatestSnippet()

  return (
    <div className="group/row relative">
      {/* Railway timeline connector track */}
      {depth === 0 && !isLastSibling && (
        <div className="absolute left-[13px] top-6 bottom-0 w-[1.5px] bg-slate-200 dark:bg-slate-800/80 pointer-events-none -z-0" />
      )}

      {/* Main Row Container */}
      <div
        onClick={() => {
          if (!isEditing && onOpenNodeDrawer) {
            onOpenNodeDrawer(task as TaskNode)
          }
        }}
        className={`relative flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-slate-100/90 dark:hover:bg-slate-800/70 transition-colors text-xs cursor-pointer border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/60 ${
          nodeStatus === 'WAITING_REVIEW'
            ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200/40 dark:border-purple-800/40'
            : nodeStatus === 'BLOCKED'
            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/40 dark:border-rose-800/40'
            : ''
        }`}
        style={{ paddingLeft: `${Math.min(depth * 18, 120) + 6}px` }}
      >
        {/* Status Marker Icon / Expand Toggle */}
        <div className="pt-0.5 shrink-0 flex items-center justify-center">
          {renderStatusIcon()}
        </div>

        {/* Checkbox for quick completion toggle (User direct review/complete) */}
        <div
          className="pt-0.5 shrink-0 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={checkState === 'checked'}
            onChange={() => onToggleTask(task.id)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer transition-all dark:border-slate-600 dark:bg-slate-800"
            title="快捷标记完成/待开始"
          />
        </div>

        {/* Title & Metadata & Snippet (2-line layout) */}
        {isEditing ? (
          <div
            className="flex-1 flex flex-col gap-1.5 py-1 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1">
              <input
                ref={editInputRef}
                type="text"
                placeholder="任务名称..."
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={handleKeyDownEdit}
                className="flex-1 px-2 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs focus:outline-none"
              />
              <button
                onClick={handleSaveEdit}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                title="保存"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setEditTitle(task.title)
                  setEditDueDate(task.dueDate || '')
                  setEditNotes(task.notes || '')
                  setIsEditing(false)
                }}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                title="取消"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">截止:</span>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[11px]"
                />
              </div>
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  placeholder="备注说明..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[11px]"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0 space-y-0.5">
            {/* Line 1: Title + Owner Badge + Status Badge */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span
                className={`font-medium truncate leading-tight ${
                  checkState === 'checked'
                    ? 'text-slate-400 dark:text-slate-500 line-through'
                    : 'text-slate-800 dark:text-slate-100'
                }`}
              >
                {task.title}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Due date badge */}
                {dateBadge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                      dateBadge.status === 'OVERDUE'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-medium'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {dateBadge.text}
                  </span>
                )}

                {/* Owner Pill */}
                <span className={`text-[10px] px-1.5 py-0.2 rounded border font-medium ${ownerBadge.cls}`}>
                  {ownerBadge.label}
                </span>

                {/* Status Pill */}
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>

                {/* Parent subtask progress pill */}
                {progress && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                    {progress.doneLeaves}/{progress.totalLeaves}
                  </span>
                )}
              </div>
            </div>

            {/* Line 2: 1-line Activity Snippet (PRD 4.1 Specification) */}
            {latestSnippet && (
              <div className="text-[11px] truncate leading-tight text-slate-500 dark:text-slate-400 pl-0.5">
                {latestSnippet}
              </div>
            )}
          </div>
        )}

        {/* Hover Action Buttons */}
        {!isEditing && (
          <div
            className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity pt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAddSubtask(true)}
              className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700"
              title="添加子任务"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700"
              title="编辑任务"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (task.children && task.children.length > 0) {
                  if (!confirm(`该任务包含 ${task.children.length} 个子任务，确定要删除整棵子任务树吗？`)) {
                    return
                  }
                }
                onDeleteTask(task.id)
              }}
              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700"
              title="删除任务"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Subtask Input Field */}
      {showAddSubtask && (
        <div
          className="flex items-center gap-1.5 py-1 px-2 my-0.5"
          style={{ paddingLeft: `${Math.min((depth + 1) * 18, 120) + 6}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={addInputRef}
            type="text"
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={handleKeyDownSubtask}
            placeholder="输入子任务标题 (Enter 保存, Esc 取消)..."
            className="flex-1 px-2 py-1 text-xs bg-white dark:bg-slate-800 border border-blue-500 rounded focus:outline-none"
          />
          <button
            onClick={handleSaveSubtask}
            className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            添加
          </button>
          <button
            onClick={() => {
              setSubtaskTitle('')
              setShowAddSubtask(false)
            }}
            className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-xs hover:bg-slate-300"
          >
            取消
          </button>
        </div>
      )}

      {/* Recursive Children (Subtasks) */}
      {!isLeafNode && !collapsed && (
        <div className="space-y-1">
          {task.children.map((child, cIdx) => (
            <TaskRow
              key={child.id}
              task={child}
              depth={depth + 1}
              isLastSibling={cIdx === task.children.length - 1}
              onToggleTask={onToggleTask}
              onAddSubtask={onAddSubtask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onOpenNodeDrawer={onOpenNodeDrawer}
            />
          ))}
        </div>
      )}
    </div>
  )
}
