import React, { useState, useEffect, useMemo } from 'react'
import type {
  Project,
  TaskNode,
  OwnerType,
  TaskNodeStatus
} from '../domain/types'
import {
  startNodeExecution,
  appendNodeProgress,
  blockNode,
  resumeNode,
  submitNodeForReview,
  acceptNodeReview,
  rejectNodeReview
} from '../domain/calculator'
import {
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  Clock,
  Copy,
  Plus,
  Trash2,
  ChevronRight,
  ShieldCheck,
  Send,
  Terminal,
  CornerDownRight,
  Layers
} from 'lucide-react'

interface TaskNodeDrawerProps {
  project: Project
  node: TaskNode
  isOpen: boolean
  onClose: () => void
  onUpdateNode: (updatedNode: TaskNode) => void
  onDeleteNode: (nodeId: string) => void
  onSelectNode?: (node: TaskNode) => void
}

export const TaskNodeDrawer: React.FC<TaskNodeDrawerProps> = ({
  project,
  node,
  isOpen,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onSelectNode
}) => {
  const [currentNode, setCurrentNode] = useState<TaskNode>(node)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(node.title)
  const [acceptanceDraft, setAcceptanceDraft] = useState(node.acceptanceCriteria || '')
  const [isEditingAcceptance, setIsEditingAcceptance] = useState(false)
  const [notesDraft, setNotesDraft] = useState(node.notes || '')
  const [isEditingNotes, setIsEditingNotes] = useState(false)

  // Subtask management state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [showAddSubtaskInput, setShowAddSubtaskInput] = useState(false)

  // In-place inline action forms (NO nested modal popups!)
  const [inlineAction, setInlineAction] = useState<
    'NONE' | 'START' | 'PROGRESS' | 'BLOCK' | 'SUBMIT' | 'REJECT' | 'ACCEPT_NOTE'
  >('NONE')

  const [progressSummary, setProgressSummary] = useState('')
  const [progressFiles, setProgressFiles] = useState('')
  const [progressTests, setProgressTests] = useState('')
  const [blockerReason, setBlockerReason] = useState('')
  const [submitSummary, setSubmitSummary] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [reviewNoteDraft, setReviewNoteDraft] = useState('')
  const [selectedOwner, setSelectedOwner] = useState<OwnerType>(node.owner || 'SELF')
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  // Find parent task if this node is a subtask
  const parentNode = useMemo(() => {
    if (!currentNode.parentId) return null
    function findInTree(list: TaskNode[]): TaskNode | null {
      for (const item of list) {
        if (item.id === currentNode.parentId) return item
        if (item.children && item.children.length > 0) {
          const res = findInTree(item.children as TaskNode[])
          if (res) return res
        }
      }
      return null
    }
    return findInTree((project.tasks || []) as TaskNode[])
  }, [currentNode.parentId, project.tasks])

  const subtasks = (currentNode.children || []) as TaskNode[]
  const acceptedSubtaskCount = subtasks.filter(
    (s) => s.status === 'ACCEPTED' || Boolean(s.completed)
  ).length

  // Keep local state synced when node prop changes
  useEffect(() => {
    setCurrentNode(node)
    setTitleDraft(node.title)
    setAcceptanceDraft(node.acceptanceCriteria || '')
    setNotesDraft(node.notes || '')
    setSelectedOwner(node.owner || 'SELF')
    setInlineAction('NONE')
    setShowAddSubtaskInput(false)
    setNewSubtaskTitle('')
  }, [node])

  // Track elapsed minutes when IN_PROGRESS
  useEffect(() => {
    if (currentNode.status !== 'IN_PROGRESS') {
      setElapsedMinutes(0)
      return
    }

    const currentRound = currentNode.rounds?.[currentNode.rounds.length - 1]
    if (!currentRound?.startTime) {
      setElapsedMinutes(0)
      return
    }

    const calcElapsed = () => {
      const start = new Date(currentRound.startTime).getTime()
      const diffMs = Date.now() - start
      setElapsedMinutes(Math.max(0, Math.floor(diffMs / 60000)))
    }

    calcElapsed()
    const interval = setInterval(calcElapsed, 30000)
    return () => clearInterval(interval)
  }, [currentNode.status, currentNode.rounds])

  if (!isOpen) return null

  const commitUpdate = (updated: TaskNode) => {
    setCurrentNode(updated)
    onUpdateNode(updated)
  }

  // Handle Title Save
  const handleSaveTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== currentNode.title) {
      const updated = { ...currentNode, title: trimmed, updatedAt: new Date().toISOString() }
      commitUpdate(updated)
    }
    setIsEditingTitle(false)
  }

  // Handle Acceptance Criteria Save
  const handleSaveAcceptance = () => {
    const trimmed = acceptanceDraft.trim()
    const updated = {
      ...currentNode,
      acceptanceCriteria: trimmed || undefined,
      updatedAt: new Date().toISOString()
    }
    commitUpdate(updated)
    setIsEditingAcceptance(false)
  }

  // Handle Notes Save
  const handleSaveNotes = () => {
    const trimmed = notesDraft.trim()
    const updated = {
      ...currentNode,
      notes: trimmed || undefined,
      updatedAt: new Date().toISOString()
    }
    commitUpdate(updated)
    setIsEditingNotes(false)
  }

  // Handle Owner Change
  const handleChangeOwner = (newOwner: OwnerType) => {
    const updated = {
      ...currentNode,
      owner: newOwner,
      updatedAt: new Date().toISOString()
    }
    commitUpdate(updated)
  }

  // In-place Action Handlers
  const handleStartRound = () => {
    const updated = startNodeExecution(currentNode, selectedOwner)
    commitUpdate(updated)
    setInlineAction('NONE')
  }

  const handleConfirmProgress = () => {
    if (!progressSummary.trim()) return
    const updated = appendNodeProgress(currentNode, {
      summary: progressSummary.trim(),
      changedFiles: progressFiles.trim() || undefined,
      testResults: progressTests.trim() || undefined
    })
    commitUpdate(updated)
    setProgressSummary('')
    setProgressFiles('')
    setProgressTests('')
    setInlineAction('NONE')
  }

  const handleConfirmBlock = () => {
    if (!blockerReason.trim()) return
    const updated = blockNode(currentNode, blockerReason.trim())
    commitUpdate(updated)
    setBlockerReason('')
    setInlineAction('NONE')
  }

  const handleResumeExecution = () => {
    const updated = resumeNode(currentNode)
    commitUpdate(updated)
  }

  const handleSubmitReview = () => {
    if (!submitSummary.trim()) return
    const updated = submitNodeForReview(currentNode, {
      summary: submitSummary.trim()
    })
    commitUpdate(updated)
    setSubmitSummary('')
    setInlineAction('NONE')
  }

  const handleAcceptReview = () => {
    const updated = acceptNodeReview(currentNode, reviewNoteDraft.trim() || undefined)
    commitUpdate(updated)
    setReviewNoteDraft('')
    setInlineAction('NONE')
  }

  const handleRejectReview = () => {
    if (!rejectionReason.trim()) return
    const updated = rejectNodeReview(currentNode, rejectionReason.trim())
    commitUpdate(updated)
    setRejectionReason('')
    setInlineAction('NONE')
  }

  // 1-Click quick complete/uncomplete toggle ("卡片看板那种方框")
  const handleToggleComplete = () => {
    const nextDone = !isDone
    const now = new Date().toISOString()
    const nextChildren = (currentNode.children || []).map((c) => ({
      ...c,
      completed: nextDone,
      status: (nextDone ? 'ACCEPTED' : 'TODO') as TaskNodeStatus,
      completedAt: nextDone ? now : undefined,
      updatedAt: now
    }))
    const updated: TaskNode = {
      ...currentNode,
      children: nextChildren,
      completed: nextDone,
      status: nextDone ? 'ACCEPTED' : 'TODO',
      completedAt: nextDone ? now : undefined,
      events: [
        ...(currentNode.events || []),
        {
          id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          roundId: `round_manual_${Date.now()}`,
          timestamp: now,
          source: 'SELF',
          type: nextDone ? 'ACCEPTED' : 'RESUMED',
          summary:
            nextChildren.length > 0
              ? nextDone
                ? '快捷标记完成全部子任务'
                : '恢复全部子任务为待开始'
              : nextDone
              ? '快捷勾选标记完成'
              : '取消完成标记，恢复待开始'
        }
      ],
      updatedAt: now
    }
    commitUpdate(updated)
  }

  const handleSaveNewSubtask = () => {
    const trimmed = newSubtaskTitle.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    const newId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newChild: TaskNode = {
      id: newId,
      title: trimmed,
      status: 'TODO',
      owner: 'SELF',
      order: subtasks.length,
      parentId: currentNode.id,
      parents: [currentNode.id],
      children: [],
      rounds: [],
      events: [
        {
          id: `evt_${Date.now()}`,
          roundId: `round_${Date.now()}`,
          timestamp: now,
          source: 'SELF',
          type: 'ASSIGNED',
          summary: `作为「${currentNode.title}」的子任务创建`
        }
      ],
      createdAt: now,
      updatedAt: now,
      completed: false
    }

    const updatedCurrent: TaskNode = {
      ...currentNode,
      children: [...subtasks, newChild],
      updatedAt: now
    }
    commitUpdate(updatedCurrent)
    setNewSubtaskTitle('')
    setShowAddSubtaskInput(false)
  }

  const handleToggleSubtask = (subId: string) => {
    const nextChildren = subtasks.map((s) => {
      if (s.id !== subId) return s
      const isSubDone = s.status === 'ACCEPTED' || Boolean(s.completed)
      const now = new Date().toISOString()
      return {
        ...s,
        completed: !isSubDone,
        status: (!isSubDone ? 'ACCEPTED' : 'TODO') as TaskNodeStatus,
        completedAt: !isSubDone ? now : undefined,
        updatedAt: now
      }
    })
    const updatedCurrent: TaskNode = {
      ...currentNode,
      children: nextChildren,
      updatedAt: new Date().toISOString()
    }
    commitUpdate(updatedCurrent)
  }

  const handleDeleteSubtask = (subId: string) => {
    const nextChildren = subtasks.filter((s) => s.id !== subId)
    const updatedCurrent: TaskNode = {
      ...currentNode,
      children: nextChildren,
      updatedAt: new Date().toISOString()
    }
    commitUpdate(updatedCurrent)
  }

  // Copy Context Prompt for Agent
  const handleCopyPrompt = () => {
    const prompt = `# 任务指令：${currentNode.title}
- 所属项目：${project.title}
- 负责人/执行者：${currentNode.owner}
- 状态：${currentNode.status}
- 验收标准：${currentNode.acceptanceCriteria || '按目标完成自测并验证'}
- 说明与背景：${currentNode.notes || '无'}
- 前置依赖：${(currentNode.parents || []).join(', ') || '无'}
`
    navigator.clipboard.writeText(prompt)
    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2500)
  }

  const getOwnerBadge = (owner?: OwnerType) => {
    switch (owner) {
      case 'GEMINI':
        return { label: 'Gemini', bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' }
      case 'CODEX':
        return { label: 'Codex', bg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300' }
      case 'SELF':
        return { label: '自己', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' }
      case 'OTHER':
      default:
        return { label: '其他', bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' }
    }
  }

  const getStatusBadge = (status?: TaskNodeStatus) => {
    switch (status) {
      case 'IN_PROGRESS':
        return {
          label: '执行中',
          bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
        }
      case 'WAITING_REVIEW':
        return {
          label: '待验收',
          bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 font-bold'
        }
      case 'BLOCKED':
        return {
          label: '阻塞',
          bg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 font-bold'
        }
      case 'ACCEPTED':
        return {
          label: '已验收',
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-bold'
        }
      case 'TODO':
      default: {
        const isRework = currentNode.events?.some((e) => e.type === 'REJECTED')
        return {
          label: isRework ? '待开始 (需返工)' : '待开始',
          bg: isRework ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        }
      }
    }
  }

  const isDone = currentNode.status === 'ACCEPTED' || (!currentNode.status && Boolean(currentNode.completed))
  const isWaitingReview = currentNode.status === 'WAITING_REVIEW'
  const isInProgress = currentNode.status === 'IN_PROGRESS'
  const isBlocked = currentNode.status === 'BLOCKED'
  const isTodo = !isDone && !isWaitingReview && !isInProgress && !isBlocked

  const ownerBadge = getOwnerBadge(currentNode.owner)
  const statusBadge = getStatusBadge(
    isDone
      ? 'ACCEPTED'
      : isWaitingReview
      ? 'WAITING_REVIEW'
      : isInProgress
      ? 'IN_PROGRESS'
      : isBlocked
      ? 'BLOCKED'
      : 'TODO'
  )
  const rounds = currentNode.rounds || []
  const events = currentNode.events || []

  return (
    <aside className="w-[350px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full z-10 shadow-sm animate-in slide-in-from-right duration-150 select-none">
      {/* 1. Header: Breadcrumb + Title + Close Button */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2.5 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mb-1">
            <span className="truncate max-w-[140px] font-medium text-slate-600 dark:text-slate-300">
              {project.title}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
            <span>方块 #{(currentNode.order || 0) + 1}</span>
          </div>

          {/* Quick Checkbox + Editable Title */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleComplete}
              className={`w-4 h-4 rounded flex items-center justify-center transition-all shrink-0 cursor-pointer border ${
                isDone
                  ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                  : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:border-emerald-400'
              }`}
              title={isDone ? '点击恢复为未完成' : '点击快捷标记完成'}
            >
              {isDone && <Check className="w-3 h-3 text-white stroke-[3]" />}
            </button>

            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle()
                    if (e.key === 'Escape') {
                      setTitleDraft(currentNode.title)
                      setIsEditingTitle(false)
                    }
                  }}
                  autoFocus
                  className="flex-1 text-xs font-bold px-2 py-1 border border-blue-500 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <h2
                onClick={() => setIsEditingTitle(true)}
                className={`text-sm font-bold hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-1.5 group leading-snug flex-1 ${
                  isDone
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
                title="点击修改任务名称"
              >
                <span>{currentNode.title}</span>
                <span className="text-[10px] font-normal text-slate-400 opacity-0 group-hover:opacity-100">
                  编辑
                </span>
              </h2>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="关闭检查面板"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* If Subtask: Parent Task Breadcrumb Link */}
        {parentNode && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 text-blue-700 dark:text-blue-300">
              <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
              <span className="opacity-75 shrink-0">所属父任务：</span>
              <span className="font-bold truncate">「{parentNode.title}」</span>
            </div>
            {onSelectNode && (
              <button
                onClick={() => onSelectNode(parentNode)}
                className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0 ml-1.5"
              >
                查看父任务 →
              </button>
            )}
          </div>
        )}

        {/* Status & Owner Bar */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadge.bg}`}>
              {statusBadge.label}
            </span>
            <select
              value={currentNode.owner}
              onChange={(e) => handleChangeOwner(e.target.value as OwnerType)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border-0 bg-transparent cursor-pointer outline-none ${ownerBadge.bg}`}
            >
              <option value="GEMINI">Gemini</option>
              <option value="CODEX">Codex</option>
              <option value="SELF">自己</option>
              <option value="OTHER">其他</option>
            </select>
          </div>

          {isInProgress && (
            <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-mono">
              <Clock className="w-3 h-3" />
              <span>{elapsedMinutes} 分钟</span>
            </div>
          )}
        </div>

        {/* 3. In-Place Actions Section (Zero Popups!) */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            常用操作与流转
          </div>

          {/* WAITING_REVIEW: Accept or Reject in-place */}
          {isWaitingReview && (
            <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>AI 已交付，等待人工验收</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAcceptReview}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>验收通过</span>
                </button>
                <button
                  onClick={() => setInlineAction(inlineAction === 'REJECT' ? 'NONE' : 'REJECT')}
                  className="py-1.5 px-3 border border-amber-300 dark:border-amber-700 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-lg text-xs font-semibold"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>退回修改</span>
                </button>
              </div>

              {/* Inline Reject Form */}
              {inlineAction === 'REJECT' && (
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-2">
                  <textarea
                    rows={2}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="输入退回修改的原因与具体要求..."
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs outline-none resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setInlineAction('NONE')}
                      className="px-2.5 py-1 text-slate-500 text-xs"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleRejectReview}
                      disabled={!rejectionReason.trim()}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                    >
                      确认退回并重置
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TODO: In-place Start Execution */}
          {isTodo && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">指定执行者：</span>
                <select
                  value={selectedOwner}
                  onChange={(e) => setSelectedOwner(e.target.value as OwnerType)}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold"
                >
                  <option value="CODEX">Codex</option>
                  <option value="GEMINI">Gemini</option>
                  <option value="SELF">自己</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 pt-0.5">
                <button
                  onClick={handleStartRound}
                  className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>开启第 {rounds.length + 1} 轮执行</span>
                </button>
                <button
                  onClick={handleToggleComplete}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 rounded-lg font-semibold text-xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>直接标记已完成</span>
                </button>
              </div>
            </div>
          )}

          {/* IN_PROGRESS: In-place Progress, Blocker, Submit */}
          {isInProgress && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setInlineAction(inlineAction === 'PROGRESS' ? 'NONE' : 'PROGRESS')}
                  className={`py-1.5 px-2 rounded-lg font-semibold text-[11px] border flex items-center justify-center gap-1 transition-colors ${
                    inlineAction === 'PROGRESS'
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 text-blue-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>登记进展</span>
                </button>
                <button
                  onClick={() => setInlineAction(inlineAction === 'BLOCK' ? 'NONE' : 'BLOCK')}
                  className={`py-1.5 px-2 rounded-lg font-semibold text-[11px] border flex items-center justify-center gap-1 transition-colors ${
                    inlineAction === 'BLOCK'
                      ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 text-rose-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-rose-600'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>申报阻塞</span>
                </button>
                <button
                  onClick={() => setInlineAction(inlineAction === 'SUBMIT' ? 'NONE' : 'SUBMIT')}
                  className={`py-1.5 px-2 rounded-lg font-semibold text-[11px] border flex items-center justify-center gap-1 transition-colors ${
                    inlineAction === 'SUBMIT'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 text-amber-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-amber-600'
                  }`}
                >
                  <Send className="w-3 h-3" />
                  <span>提交验收</span>
                </button>
              </div>

              {/* Inline Progress Form */}
              {inlineAction === 'PROGRESS' && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      进展摘要 *
                    </label>
                    <input
                      type="text"
                      value={progressSummary}
                      onChange={(e) => setProgressSummary(e.target.value)}
                      placeholder="例如：完成 FMU 输出信号映射"
                      className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-500">改动文件（可选）</label>
                    <input
                      type="text"
                      value={progressFiles}
                      onChange={(e) => setProgressFiles(e.target.value)}
                      placeholder="例如：bridge.py, test.py"
                      className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-xs font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => setInlineAction('NONE')}
                      className="px-2.5 py-1 text-slate-500 text-xs"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmProgress}
                      disabled={!progressSummary.trim()}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                    >
                      保存进展记录
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Blocker Form */}
              {inlineAction === 'BLOCK' && (
                <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
                  <label className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                    阻塞原因说明 *
                  </label>
                  <textarea
                    rows={2}
                    value={blockerReason}
                    onChange={(e) => setBlockerReason(e.target.value)}
                    placeholder="说明阻塞原因（如缺少 MuJoCo 几何模型、依赖包版本冲突）..."
                    className="w-full p-1.5 bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-800 rounded-lg text-xs resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setInlineAction('NONE')}
                      className="px-2.5 py-1 text-slate-500 text-xs"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmBlock}
                      disabled={!blockerReason.trim()}
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                    >
                      确认标记为阻塞
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Submit Form */}
              {inlineAction === 'SUBMIT' && (
                <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                  <label className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    交付成果说明 *
                  </label>
                  <input
                    type="text"
                    value={submitSummary}
                    onChange={(e) => setSubmitSummary(e.target.value)}
                    placeholder="例如：已完成接口编写并通过单元测试，等待验收"
                    className="w-full p-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 rounded-lg text-xs"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => setInlineAction('NONE')}
                      className="px-2.5 py-1 text-slate-500 text-xs"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSubmitReview}
                      disabled={!submitSummary.trim()}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                    >
                      提交人工验收
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* BLOCKED: Resume action */}
          {isBlocked && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2">
              <div className="text-rose-700 dark:text-rose-300 font-semibold flex items-center gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>任务处于阻塞状态</span>
              </div>
              <button
                onClick={handleResumeExecution}
                className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-1"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>解除阻塞并恢复执行</span>
              </button>
            </div>
          )}

          {/* ACCEPTED: Status banner & Reopen */}
          {isDone && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>此方块已通过人工验收并归档。</span>
              </div>
              <button
                onClick={handleToggleComplete}
                className="w-full py-1.5 px-3 border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>恢复为未完成状态</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. One-Click Context Prompt for Agent */}
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Terminal className="w-3 h-3" />
              <span>Agent 上下文指令</span>
            </span>
            <button
              onClick={handleCopyPrompt}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                copiedPrompt
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100'
              }`}
            >
              <Copy className="w-3 h-3" />
              <span>{copiedPrompt ? '已复制！' : '一键复制'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-mono bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-100 dark:border-slate-800 break-words line-clamp-3">
            # 任务: {currentNode.title}
            <br />- 验收: {currentNode.acceptanceCriteria || '自测通过'}
          </p>
        </div>

        {/* 5. Acceptance Criteria & Notes */}
        <div className="space-y-3">
          {/* Acceptance Criteria */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                验收标准
              </span>
              <button
                onClick={() => {
                  if (isEditingAcceptance) handleSaveAcceptance()
                  else setIsEditingAcceptance(true)
                }}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isEditingAcceptance ? '保存' : '编辑'}
              </button>
            </div>
            {isEditingAcceptance ? (
              <textarea
                rows={2}
                value={acceptanceDraft}
                onChange={(e) => setAcceptanceDraft(e.target.value)}
                placeholder="例如：单元测试覆盖率 > 90%，误差 < 0.01"
                className="w-full p-2 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg text-xs outline-none resize-none"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingAcceptance(true)}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs cursor-pointer hover:border-slate-300"
              >
                {currentNode.acceptanceCriteria || (
                  <span className="text-slate-400 italic">点击添加验收标准...</span>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                说明与备注
              </span>
              <button
                onClick={() => {
                  if (isEditingNotes) handleSaveNotes()
                  else setIsEditingNotes(true)
                }}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isEditingNotes ? '保存' : '编辑'}
              </button>
            </div>
            {isEditingNotes ? (
              <textarea
                rows={2}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="补充背景、文件位置或注意事项..."
                className="w-full p-2 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg text-xs outline-none resize-none"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingNotes(true)}
                className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs cursor-pointer hover:border-slate-300"
              >
                {currentNode.notes || (
                  <span className="text-slate-400 italic">点击添加任务背景说明...</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Subtask Breakdown Section */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
              <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>子任务清单</span>
              {subtasks.length > 0 && (
                <span className="text-[10px] font-normal text-slate-400">
                  ({acceptedSubtaskCount}/{subtasks.length})
                </span>
              )}
            </div>
            {!showAddSubtaskInput && (
              <button
                onClick={() => setShowAddSubtaskInput(true)}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                <Plus className="w-3 h-3" />
                <span>添加子任务</span>
              </button>
            )}
          </div>

          {/* Subtasks List */}
          {subtasks.length > 0 && (
            <div className="space-y-1.5">
              {subtasks.map((sub) => {
                const isSubDone = sub.status === 'ACCEPTED' || Boolean(sub.completed)
                return (
                  <div
                    key={sub.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 group hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleSubtask(sub.id)}
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-all shrink-0 cursor-pointer border ${
                          isSubDone
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-emerald-500'
                        }`}
                        title={isSubDone ? '恢复为待开始' : '标记子任务完成'}
                      >
                        {isSubDone && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </button>
                      <span
                        onClick={() => onSelectNode && onSelectNode(sub)}
                        className={`text-xs truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex-1 ${
                          isSubDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'
                        }`}
                        title="点击检查此子任务"
                      >
                        {sub.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                        {sub.owner === 'GEMINI' ? 'Gemini' : sub.owner === 'CODEX' ? 'Codex' : '自己'}
                      </span>
                      <button
                        onClick={() => handleDeleteSubtask(sub.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-opacity"
                        title="删除此子任务"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Inline Add Subtask Input */}
          {showAddSubtaskInput && (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                placeholder="输入子任务名称，回车添加..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNewSubtask()
                  if (e.key === 'Escape') {
                    setNewSubtaskTitle('')
                    setShowAddSubtaskInput(false)
                  }
                }}
                autoFocus
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
              />
              <button
                onClick={handleSaveNewSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
              >
                添加
              </button>
              <button
                onClick={() => {
                  setNewSubtaskTitle('')
                  setShowAddSubtaskInput(false)
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 6. Execution Rounds & Timeline */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            执行时间线 ({events.length} 条记录)
          </span>

          {events.length === 0 ? (
            <p className="text-slate-400 italic py-2 text-center text-[11px]">暂无执行记录</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {[...events].reverse().map((evt) => (
                <div
                  key={evt.id}
                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-[11px] space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-400 font-mono text-[10px]">
                    <span>{evt.source} · {evt.type}</span>
                    <span>{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-200">{evt.summary}</p>
                  {evt.changedFiles && (
                    <p className="text-slate-500 font-mono text-[10px] truncate">
                      文件：{evt.changedFiles}
                    </p>
                  )}
                  {evt.blockerReason && (
                    <p className="text-rose-600 dark:text-rose-400 font-medium">
                      阻塞：{evt.blockerReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7. Footer: Delete Task & Close Button */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <button
          onClick={() => {
            if (confirm(`确定删除任务「${currentNode.title}」？`)) {
              onDeleteNode(currentNode.id)
            }
          }}
          className="flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>删除此方块</span>
        </button>

        <button
          onClick={onClose}
          className="px-3 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg transition-colors"
        >
          关闭面板
        </button>
      </div>
    </aside>
  )
}
