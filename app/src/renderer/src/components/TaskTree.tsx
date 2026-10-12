import React, { useState, useRef, useEffect } from 'react'
import { TaskItem } from '../domain/types'
import { isLeaf, getNodeCheckState, calculateProgress } from '../domain/calculator'
import { formatDueDateBadge } from '../domain/date'
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit2,
  Check,
  X
} from 'lucide-react'

interface TaskTreeProps {
  tasks: TaskItem[]
  onToggleTask: (taskId: string) => void
  onAddSubtask: (parentId: string, title: string, dueDate?: string) => void
  onUpdateTask: (taskId: string, updates: Partial<Pick<TaskItem, 'title' | 'notes' | 'dueDate'>>) => void
  onDeleteTask: (taskId: string) => void
}

export const TaskTree: React.FC<TaskTreeProps> = ({
  tasks,
  onToggleTask,
  onAddSubtask,
  onUpdateTask,
  onDeleteTask
}) => {
  return (
    <div className="space-y-1 py-1">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          depth={0}
          onToggleTask={onToggleTask}
          onAddSubtask={onAddSubtask}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
        />
      ))}
    </div>
  )
}

interface TaskRowProps {
  task: TaskItem
  depth: number
  onToggleTask: (taskId: string) => void
  onAddSubtask: (parentId: string, title: string, dueDate?: string) => void
  onUpdateTask: (taskId: string, updates: Partial<Pick<TaskItem, 'title' | 'notes' | 'dueDate'>>) => void
  onDeleteTask: (taskId: string) => void
}

const TaskRow: React.FC<TaskRowProps> = ({
  task,
  depth,
  onToggleTask,
  onAddSubtask,
  onUpdateTask,
  onDeleteTask
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

  const dateBadge = formatDueDateBadge(task.dueDate, isLeafNode ? task.completed : checkState === 'checked')

  return (
    <div className="group/row">
      <div
        className="flex items-center gap-1.5 py-1 px-1.5 rounded-md hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors text-xs"
        style={{ paddingLeft: `${Math.min(depth * 18, 120) + 6}px` }}
      >
        {/* Expand / Collapse toggle for parent */}
        {!isLeafNode ? (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <div className="w-4 h-4 flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>
        )}

        {/* Checkbox with three-state representation */}
        <div className="relative flex items-center justify-center">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={checkState === 'checked'}
            onChange={() => onToggleTask(task.id)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer transition-all dark:border-slate-600 dark:bg-slate-800"
          />
        </div>

        {/* Title / Inline Edit */}
        {isEditing ? (
          <div className="flex-1 flex flex-col gap-1.5 py-1 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-blue-400">
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
                {editDueDate && (
                  <button
                    onClick={() => setEditDueDate('')}
                    className="text-slate-400 hover:text-slate-600 text-[10px]"
                  >
                    清除
                  </button>
                )}
              </div>
              <div className="flex-1 flex items-center gap-1">
                <input
                  type="text"
                  placeholder="备注说明..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  className="w-full px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-[11px]"
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            onDoubleClick={() => setIsEditing(true)}
            className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
          >
            <span
              className={`truncate font-normal ${
                checkState === 'checked'
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {task.title}
            </span>

            {/* Subtask notes preview */}
            {task.notes && (
              <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 italic truncate max-w-[120px]">
                ({task.notes})
              </span>
            )}

            {/* Parent subtask progress pill */}
            {progress && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                {progress.doneLeaves}/{progress.totalLeaves}
              </span>
            )}

            {/* Due date badge */}
            {dateBadge && (
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  dateBadge.status === 'OVERDUE'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-medium'
                    : dateBadge.status === 'TODAY'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {dateBadge.text}
              </span>
            )}
          </div>
        )}

        {/* Action icons on hover */}
        {!isEditing && (
          <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 transition-opacity">
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

      {/* Recursive Children */}
      {!isLeafNode && !collapsed && (
        <div className="space-y-0.5">
          {task.children.map((child) => (
            <TaskRow
              key={child.id}
              task={child}
              depth={depth + 1}
              onToggleTask={onToggleTask}
              onAddSubtask={onAddSubtask}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
            />
          ))}
        </div>
      )}
    </div>
  )
}
