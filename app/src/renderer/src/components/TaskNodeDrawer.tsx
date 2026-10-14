import React, { useState, useEffect, useMemo, useRef } from 'react'
import type {
  Project,
  TaskNode,
  OwnerType,
  TaskNodeStatus,
  TaskEvent
} from '../domain/types'
import {
  startNodeExecution,
  resumeNode,
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
  ShieldCheck,
  CornerDownRight,
  ChevronRight
} from 'lucide-react'
import { QuickLogInput } from './node-inspector/QuickLogInput'
import { AgentHandoffInline } from './node-inspector/AgentHandoffInline'
import { NodeHistoryDisclosure } from './node-inspector/NodeHistoryDisclosure'
import { NodeAdvancedDisclosure } from './node-inspector/NodeAdvancedDisclosure'

interface TaskNodeDrawerProps {
  project: Project
  node: TaskNode
  isOpen: boolean
  onClose: () => void
  onUpdateNode: (updatedNode: TaskNode) => void
  onDeleteNode: (nodeId: string) => void
  onSelectNode?: (node: TaskNode) => void
  onHandoffTask?: (
    sourceNode: TaskNode,
    targetAgent: OwnerType,
    mode: 'handoff' | 'parallel',
    newTitle: string,
    prompt: string
  ) => void
}

export const TaskNodeDrawer: React.FC<TaskNodeDrawerProps> = ({
  project,
  node,
  isOpen,
  onClose,
  onUpdateNode,
  onDeleteNode,
  onSelectNode,
  onHandoffTask
}) => {
  const [currentNode, setCurrentNode] = useState<TaskNode>(node)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(node.title)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const isTitleComposingRef = useRef(false)

  // Inline Handoff expansion state
  const [showHandoff, setShowHandoff] = useState(false)

  // Rejection in-place input state for WAITING_REVIEW
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  // Elapsed minutes when IN_PROGRESS
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  // Synchronize state when node prop changes
  useEffect(() => {
    setCurrentNode(node)
    setTitleDraft(node.title)
    setIsEditingTitle(false)
    setShowHandoff(false)
    setShowRejectForm(false)
    setRejectionReason('')
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

  if (!isOpen) return null

  const commitUpdate = (updated: TaskNode) => {
    setCurrentNode(updated)
    onUpdateNode(updated)
  }

  // Handle Title Save with IME safety
  const handleSaveTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== currentNode.title) {
      const updated = { ...currentNode, title: trimmed, updatedAt: new Date().toISOString() }
      commitUpdate(updated)
    }
    setIsEditingTitle(false)
  }

  // 1-Click quick complete/uncomplete checkbox toggle
  const isDone =
    currentNode.status === 'ACCEPTED' || (!currentNode.status && Boolean(currentNode.completed))
  const isWaitingReview = currentNode.status === 'WAITING_REVIEW'
  const isInProgress = currentNode.status === 'IN_PROGRESS'
  const isBlocked = currentNode.status === 'BLOCKED'
  const isTodo = !isDone && !isWaitingReview && !isInProgress && !isBlocked

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
          summary: nextDone ? '快捷勾选标记完成' : '取消完成标记，恢复待开始'
        }
      ],
      updatedAt: now
    }
    commitUpdate(updated)
  }

  // Quick Log Submit (PROGRESS or BLOCKED)
  const handleQuickLog = (summary: string, isIssue: boolean) => {
    const now = new Date().toISOString()
    const currentRoundId =
      currentNode.rounds && currentNode.rounds.length > 0
        ? currentNode.rounds[currentNode.rounds.length - 1].id
        : `round_${Date.now()}`

    const newEvent: TaskEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roundId: currentRoundId,
      timestamp: now,
      source: 'SELF', // Mark as manual user record, per PRD 3.2
      type: isIssue ? 'BLOCKED' : 'PROGRESS',
      summary,
      blockerReason: isIssue ? summary : undefined
    }

    const updatedEvents = [...(currentNode.events || []), newEvent]
    const updated: TaskNode = {
      ...currentNode,
      events: updatedEvents,
      status: isIssue ? 'BLOCKED' : currentNode.status || 'TODO',
      updatedAt: now
    }
    commitUpdate(updated)
  }

  // Start Execution
  const handleStartExecution = () => {
    const updated = startNodeExecution(currentNode, currentNode.owner || 'SELF')
    commitUpdate(updated)
  }

  // Resume Execution from Blocker
  const handleResume = () => {
    const updated = resumeNode(currentNode)
    commitUpdate(updated)
  }

  // Accept Review
  const handleAcceptReview = () => {
    const updated = acceptNodeReview(currentNode)
    commitUpdate(updated)
  }

  // Reject Review
  const handleRejectReview = () => {
    const reason = rejectionReason.trim()
    if (!reason) return
    const updated = rejectNodeReview(currentNode, reason)
    commitUpdate(updated)
    setShowRejectForm(false)
    setRejectionReason('')
  }

  // Handoff to another AI
  const handleHandoff = (
    targetAgent: OwnerType,
    mode: 'handoff' | 'parallel',
    newTitle: string,
    prompt: string
  ) => {
    if (onHandoffTask) {
      onHandoffTask(currentNode, targetAgent, mode, newTitle, prompt)
      setShowHandoff(false)
    } else {
      // Fallback: append handoff event to current node
      const now = new Date().toISOString()
      const handoffEvent: TaskEvent = {
        id: `evt_${Date.now()}`,
        roundId: `round_${Date.now()}`,
        timestamp: now,
        source: 'SELF',
        type: 'ASSIGNED',
        summary: `交接给 ${targetAgent}：${newTitle}`
      }
      commitUpdate({
        ...currentNode,
        events: [...(currentNode.events || []), handoffEvent],
        updatedAt: now
      })
      setShowHandoff(false)
    }
  }

  // Latest Progress snippet for Zone 3
  const latestEvent =
    currentNode.events && currentNode.events.length > 0
      ? currentNode.events[currentNode.events.length - 1]
      : null

  const getSourceDisplay = (source?: string) => {
    switch (source) {
      case 'GEMINI':
        return 'Gemini'
      case 'CODEX':
        return 'Codex'
      case 'SELF':
        return '自己'
      default:
        return source || '自己'
    }
  }

  const getOwnerLabel = (owner?: OwnerType) => {
    switch (owner) {
      case 'GEMINI':
        return 'Gemini'
      case 'CODEX':
        return 'Codex'
      case 'SELF':
        return '自己'
      default:
        return '其他'
    }
  }

  const getStatusLabel = () => {
    if (isDone) return '已验收'
    if (isWaitingReview) return '待验收'
    if (isInProgress) return '执行中'
    if (isBlocked) return '阻塞'
    return '待开始'
  }

  return (
    <aside className="w-[360px] shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full z-10 shadow-sm animate-in slide-in-from-right duration-150 select-none">
      {/* ========================================================
          ZONE 1: Header (Breadcrumb + Checkbox + Title + Close)
         ======================================================== */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mb-1">
            <span className="truncate max-w-[140px] font-medium text-slate-600 dark:text-slate-300">
              {project.title}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span>方块 #{(currentNode.order || 0) + 1}</span>
          </div>

          {/* Checkbox + Title */}
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
                  ref={titleInputRef}
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onCompositionStart={() => {
                    isTitleComposingRef.current = true
                  }}
                  onCompositionEnd={() => {
                    isTitleComposingRef.current = false
                  }}
                  onKeyDown={(e) => {
                    if (isTitleComposingRef.current || e.nativeEvent.isComposing) return
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
                  title="确认保存"
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
                title="点击修改任务标题"
              >
                <span>{currentNode.title}</span>
                <span className="text-[10px] font-normal text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* ========================================================
          SCROLLABLE BODY
         ======================================================== */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
        {/* Parent Task Crumb if this node is a subtask */}
        {parentNode && (
          <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 text-blue-700 dark:text-blue-300">
              <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
              <span className="opacity-75 shrink-0">所属父任务：</span>
              <span className="font-bold truncate">「{parentNode.title}」</span>
            </div>
            {onSelectNode && (
              <button
                type="button"
                onClick={() => onSelectNode(parentNode)}
                className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0 ml-1.5"
              >
                查看父任务 →
              </button>
            )}
          </div>
        )}

        {/* ========================================================
            ZONE 2: Meta Pill (Agent · Status · Time)
           ======================================================== */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                currentNode.owner === 'GEMINI'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                  : currentNode.owner === 'CODEX'
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {getOwnerLabel(currentNode.owner)}
            </span>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                isDone
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : isWaitingReview
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : isInProgress
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  : isBlocked
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {getStatusLabel()}
            </span>
          </div>

          {isInProgress ? (
            <div className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-mono">
              <Clock className="w-3 h-3" />
              <span>{elapsedMinutes} 分钟</span>
            </div>
          ) : isDone && currentNode.completedAt ? (
            <span className="text-[10px] text-slate-400 font-mono">
              {new Date(currentNode.completedAt).toLocaleDateString([], {
                month: 'numeric',
                day: 'numeric'
              })}
            </span>
          ) : null}
        </div>

        {/* ========================================================
            ZONE 3: Latest Progress ("最近进展")
           ======================================================== */}
        <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>最近进展</span>
            {latestEvent && (
              <span className="font-normal font-mono lowercase">
                {new Date(latestEvent.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })}{' '}
                · {getSourceDisplay(latestEvent.source)}
              </span>
            )}
          </div>
          <p
            className={`text-xs leading-relaxed ${
              latestEvent
                ? 'text-slate-800 dark:text-slate-200 font-medium'
                : 'text-slate-400 italic'
            }`}
          >
            {latestEvent ? latestEvent.summary : '暂无进展，写一条开始记录'}
          </p>
        </div>

        {/* ========================================================
            ZONE 4 & 5: Quick Log Input + Primary Action Buttons
           ======================================================== */}
        {isWaitingReview ? (
          /* WAITING_REVIEW: Dedicated Accept / Reject Controls */
          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2.5">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>AI 已交付成果，等待人工验收</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAcceptReview}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-semibold text-xs shadow-xs transition-all"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>验收通过</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRejectForm(!showRejectForm)}
                className="py-2 px-3 border border-amber-300 dark:border-amber-700 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>退回修改</span>
              </button>
            </div>

            {/* Inline Reject Reason Form */}
            {showRejectForm && (
              <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-2">
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="输入退回修改的原因和具体要求..."
                  className="w-full p-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-xs outline-none resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="px-2.5 py-1 text-slate-500 text-xs"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectReview}
                    disabled={!rejectionReason.trim()}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
                  >
                    确认退回
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : isBlocked ? (
          /* BLOCKED: Resume action */
          <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-2">
            <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>任务处于阻塞状态</span>
            </div>
            <button
              type="button"
              onClick={handleResume}
              className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>解除阻塞并恢复执行</span>
            </button>
          </div>
        ) : isDone ? (
          /* ACCEPTED: Banner & Reopen */
          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>方块已验收归档</span>
            </div>
            <button
              type="button"
              onClick={handleToggleComplete}
              className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
            >
              恢复未完成
            </button>
          </div>
        ) : (
          /* Standard IN_PROGRESS or TODO: Quick Log + Start / Handoff */
          <div className="space-y-2">
            {isTodo && (
              <button
                type="button"
                onClick={handleStartExecution}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/80 rounded-xl font-semibold text-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>开启执行流程</span>
              </button>
            )}

            <QuickLogInput
              nodeId={currentNode.id}
              onSubmitLog={handleQuickLog}
              onOpenHandoff={() => setShowHandoff(!showHandoff)}
              showHandoff={showHandoff}
            />

            {/* Inline Agent Handoff expansion */}
            {showHandoff && (
              <AgentHandoffInline
                project={project}
                node={currentNode}
                onHandoff={handleHandoff}
                onCancel={() => setShowHandoff(false)}
              />
            )}
          </div>
        )}

        {/* ========================================================
            ZONE 6: Collapsible Disclosures (历史记录 & 更多)
           ======================================================== */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* History Disclosure */}
          <NodeHistoryDisclosure events={currentNode.events || []} />

          {/* Advanced / More Disclosure */}
          <NodeAdvancedDisclosure
            project={project}
            node={currentNode}
            onUpdateNode={commitUpdate}
            onDeleteNode={onDeleteNode}
            onSelectNode={onSelectNode}
          />
        </div>
      </div>
    </aside>
  )
}
