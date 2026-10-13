import React, { useState, useEffect } from 'react'
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
  Send,
  Check,
  Ban,
  Clock,
  Copy,
  FileText,
  Plus,
  Trash2,
  ChevronRight
} from 'lucide-react'

interface TaskNodeDrawerProps {
  project: Project
  node: TaskNode
  isOpen: boolean
  onClose: () => void
  onUpdateNode: (updatedNode: TaskNode) => void
  onDeleteNode: (nodeId: string) => void
}

export const TaskNodeDrawer: React.FC<TaskNodeDrawerProps> = ({
  project,
  node,
  isOpen,
  onClose,
  onUpdateNode,
  onDeleteNode
}) => {
  const [currentNode, setCurrentNode] = useState<TaskNode>(node)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(node.title)
  const [acceptanceDraft, setAcceptanceDraft] = useState(node.acceptanceCriteria || '')
  const [isEditingAcceptance, setIsEditingAcceptance] = useState(false)
  const [notesDraft, setNotesDraft] = useState(node.notes || '')
  const [isEditingNotes, setIsEditingNotes] = useState(false)

  // Modals for actions
  const [actionModal, setActionModal] = useState<
    'NONE' | 'START' | 'PROGRESS' | 'BLOCK' | 'SUBMIT' | 'ACCEPT' | 'REJECT'
  >('NONE')
  const [modalSummary, setModalSummary] = useState('')
  const [modalChangedFiles, setModalChangedFiles] = useState('')
  const [modalTestResults, setModalTestResults] = useState('')
  const [modalBlockerReason, setModalBlockerReason] = useState('')
  const [modalNextAction, setModalNextAction] = useState('')
  const [modalReviewNote, setModalReviewNote] = useState('')
  const [modalRejectionReason, setModalRejectionReason] = useState('')
  const [modalOwner, setModalOwner] = useState<OwnerType>(node.owner || 'SELF')
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)

  // Keep local state synced when node changes
  useEffect(() => {
    setCurrentNode(node)
    setTitleDraft(node.title)
    setAcceptanceDraft(node.acceptanceCriteria || '')
    setNotesDraft(node.notes || '')
    setModalOwner(node.owner || 'SELF')
  }, [node])

  // Track live elapsed minutes when IN_PROGRESS
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

  // Save updated node both locally and notify parent
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

  // Action: Start Round
  const handleConfirmStart = () => {
    const updated = startNodeExecution(currentNode, modalOwner)
    commitUpdate(updated)
    setActionModal('NONE')
  }

  // Action: Log Progress
  const handleConfirmProgress = () => {
    const trimmed = modalSummary.trim()
    if (!trimmed) return
    const updated = appendNodeProgress(currentNode, {
      summary: trimmed,
      changedFiles: modalChangedFiles.trim() || undefined,
      testResults: modalTestResults.trim() || undefined,
      nextAction: modalNextAction.trim() || undefined,
      source: currentNode.owner
    })
    commitUpdate(updated)
    setModalSummary('')
    setModalChangedFiles('')
    setModalTestResults('')
    setModalNextAction('')
    setActionModal('NONE')
  }

  // Action: Block Node
  const handleConfirmBlock = () => {
    const trimmed = modalBlockerReason.trim()
    if (!trimmed) return
    const updated = blockNode(currentNode, trimmed, currentNode.owner)
    commitUpdate(updated)
    setModalBlockerReason('')
    setActionModal('NONE')
  }

  // Action: Resume Node
  const handleResume = () => {
    const updated = resumeNode(currentNode, currentNode.owner)
    commitUpdate(updated)
  }

  // Action: Submit for Review
  const handleConfirmSubmit = () => {
    const trimmed = modalSummary.trim()
    if (!trimmed) return
    const updated = submitNodeForReview(currentNode, {
      summary: trimmed,
      changedFiles: modalChangedFiles.trim() || undefined,
      testResults: modalTestResults.trim() || undefined,
      nextAction: modalNextAction.trim() || undefined,
      source: currentNode.owner
    })
    commitUpdate(updated)
    setModalSummary('')
    setModalChangedFiles('')
    setModalTestResults('')
    setModalNextAction('')
    setActionModal('NONE')
  }

  // Action: Accept Review (Only human review marks leaf ACCEPTED!)
  const handleConfirmAccept = () => {
    const updated = acceptNodeReview(currentNode, modalReviewNote.trim() || undefined)
    commitUpdate(updated)
    setModalReviewNote('')
    setActionModal('NONE')
  }

  // Action: Direct Complete (for SELF)
  const handleDirectComplete = () => {
    const updated = acceptNodeReview(currentNode, '人工直接确认完成')
    commitUpdate(updated)
  }

  // Action: Reject Review (Must provide reason)
  const handleConfirmReject = () => {
    const trimmed = modalRejectionReason.trim()
    if (!trimmed) return
    const updated = rejectNodeReview(currentNode, trimmed)
    commitUpdate(updated)
    setModalRejectionReason('')
    setActionModal('NONE')
  }

  // Action: Reopen Task
  const handleReopen = () => {
    const now = new Date().toISOString()
    const updated: TaskNode = {
      ...currentNode,
      status: 'TODO',
      completed: false,
      events: [
        ...(currentNode.events || []),
        {
          id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          roundId: currentNode.rounds?.[currentNode.rounds.length - 1]?.id || `round_${Date.now()}`,
          timestamp: now,
          source: 'SELF',
          type: 'STARTED',
          summary: '重新打开任务'
        }
      ],
      updatedAt: now
    }
    commitUpdate(updated)
  }

  // Copy Task Prompt for AI
  const handleCopyPrompt = async () => {
    const latestEvents = (currentNode.events || []).slice(-3)
    const latestSummary = latestEvents.map((e) => `- [${e.source}] ${e.summary}`).join('\n')

    const promptText = `## 任务目标
${currentNode.title}

## 所属项目
${project.title}

## 负责执行者
${currentNode.owner}

## 验收标准
${currentNode.acceptanceCriteria || '尚未明确特定验收标准'}

## 任务背景与说明
${currentNode.notes || '无额外背景说明'}

## 最近进展记录
${latestSummary || '尚无历史进展'}
`
    try {
      await navigator.clipboard.writeText(promptText)
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    } catch (e) {
      console.error('Failed to copy prompt:', e)
    }
  }

  const getOwnerBadge = (owner: OwnerType) => {
    switch (owner) {
      case 'GEMINI':
        return { label: 'Gemini', bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' }
      case 'CODEX':
        return { label: 'Codex', bg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' }
      case 'SELF':
        return { label: '自己', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' }
      case 'OTHER':
      default:
        return { label: '其他', bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' }
    }
  }

  const getStatusBadge = (status: TaskNodeStatus) => {
    switch (status) {
      case 'TODO':
        const isRework = currentNode.events?.some((e) => e.type === 'REJECTED')
        return {
          label: isRework ? '待开始 (需返工)' : '待开始',
          bg: isRework ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        }
      case 'IN_PROGRESS':
        return {
          label: '执行中',
          bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 animate-pulse'
        }
      case 'WAITING_REVIEW':
        return {
          label: '待验收',
          bg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 font-semibold'
        }
      case 'BLOCKED':
        return {
          label: '阻塞',
          bg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
        }
      case 'ACCEPTED':
        return {
          label: '已验收',
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-semibold'
        }
    }
  }

  const ownerBadge = getOwnerBadge(currentNode.owner)
  const statusBadge = getStatusBadge(currentNode.status)
  const rounds = currentNode.rounds || []
  const events = currentNode.events || []
  const currentRound = rounds[rounds.length - 1]

  // Find latest submission event for WAITING_REVIEW card
  const latestSubmission = events.filter((e) => e.type === 'SUBMITTED').slice(-1)[0]
  // Find latest blocked event for BLOCKED banner
  const latestBlocked = events.filter((e) => e.type === 'BLOCKED').slice(-1)[0]

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl h-full flex flex-col z-10 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                {project.title}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>任务节点详情</span>
            </div>

            {/* Editable Title */}
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
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
                  className="flex-1 text-base font-bold px-2 py-1 border border-blue-500 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h2
                onClick={() => setIsEditingTitle(true)}
                className="text-lg font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-2 group leading-snug"
                title="点击修改任务名称"
              >
                <span>{currentNode.title}</span>
                <span className="text-xs font-normal text-slate-400 opacity-0 group-hover:opacity-100">
                  编辑
                </span>
              </h2>
            )}

            {/* Status & Owner Pills */}
            <div className="flex items-center gap-2 pt-1">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg}`}>
                {statusBadge.label}
              </span>

              {/* Owner Selector Dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400">执行者:</span>
                <select
                  value={currentNode.owner}
                  onChange={(e) => handleChangeOwner(e.target.value as OwnerType)}
                  className={`px-2 py-0.5 rounded text-xs border font-medium bg-transparent cursor-pointer outline-none ${ownerBadge.bg}`}
                >
                  <option value="SELF">自己</option>
                  <option value="GEMINI">Gemini</option>
                  <option value="CODEX">Codex</option>
                  <option value="OTHER">其他</option>
                </select>
              </div>

              {/* Active Timer Pill if IN_PROGRESS */}
              {currentNode.status === 'IN_PROGRESS' && (
                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-mono ml-auto">
                  <Clock className="w-3.5 h-3.5" />
                  <span>已执行 {elapsedMinutes} 分钟</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Toolbar Based on Current Status */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                节点流转操作
              </span>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedPrompt ? '已复制 Prompt!' : '复制任务 Prompt'}</span>
              </button>
            </div>

            {/* TODO State Controls */}
            {currentNode.status === 'TODO' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActionModal('START')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>开始执行 (开启新轮次)</span>
                </button>
                {currentNode.owner === 'SELF' && (
                  <button
                    onClick={handleDirectComplete}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>直接确认完成</span>
                  </button>
                )}
              </div>
            )}

            {/* IN_PROGRESS State Controls */}
            {currentNode.status === 'IN_PROGRESS' && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setActionModal('PROGRESS')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>登记进展</span>
                </button>
                <button
                  onClick={() => setActionModal('BLOCK')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>标记阻塞</span>
                </button>
                <button
                  onClick={() => setActionModal('SUBMIT')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors ml-auto shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>提交验收 (进入待验收)</span>
                </button>
              </div>
            )}

            {/* BLOCKED State Banner & Resume */}
            {currentNode.status === 'BLOCKED' && (
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">阻塞原因：</span>
                    <span>{latestBlocked?.blockerReason || '未指定原因'}</span>
                  </div>
                </div>
                <button
                  onClick={handleResume}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>解除阻塞并恢复执行</span>
                </button>
              </div>
            )}

            {/* WAITING_REVIEW State Prominent Review Card */}
            {currentNode.status === 'WAITING_REVIEW' && (
              <div className="p-4 bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-300 dark:border-purple-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-bold text-xs">
                  <Clock className="w-4 h-4 text-purple-600" />
                  <span>本轮成果待用户验收（AI 提交不等于完成，需人工确认）</span>
                </div>

                {latestSubmission && (
                  <div className="text-xs space-y-1.5 bg-white/70 dark:bg-slate-900/60 p-3 rounded-lg border border-purple-200 dark:border-purple-900">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      交付摘要：{latestSubmission.summary}
                    </p>
                    {latestSubmission.changedFiles && (
                      <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        改动文件：{latestSubmission.changedFiles}
                      </p>
                    )}
                    {latestSubmission.testResults && (
                      <p className="text-slate-600 dark:text-slate-400">
                        测试结果：{latestSubmission.testResults}
                      </p>
                    )}
                    {latestSubmission.nextAction && (
                      <p className="text-slate-600 dark:text-slate-400">
                        建议下一步：{latestSubmission.nextAction}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={() => setActionModal('ACCEPT')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✓ 验收通过 (计入完成进度)</span>
                  </button>
                  <button
                    onClick={() => setActionModal('REJECT')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors shadow-md"
                  >
                    <X className="w-4 h-4" />
                    <span>✕ 退回修改 (保留记录并返工)</span>
                  </button>
                </div>
              </div>
            )}

            {/* ACCEPTED State Banner */}
            {currentNode.status === 'ACCEPTED' && (
              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">此任务已验收通过，已计入项目总完成率。</span>
                </div>
                <button
                  onClick={handleReopen}
                  className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
                >
                  重新打开任务
                </button>
              </div>
            )}
          </div>

          {/* Section: Acceptance Criteria (验收标准) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span>验收标准 (Acceptance Criteria)</span>
              </span>
              {!isEditingAcceptance && (
                <button
                  onClick={() => setIsEditingAcceptance(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {currentNode.acceptanceCriteria ? '编辑' : '＋ 添加标准'}
                </button>
              )}
            </div>

            {isEditingAcceptance ? (
              <div className="space-y-2">
                <textarea
                  value={acceptanceDraft}
                  onChange={(e) => setAcceptanceDraft(e.target.value)}
                  placeholder="具体达到什么条件算作本任务完成？例如：接口单元测试 100% 通过、生成对照波形曲线图..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-blue-400 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setAcceptanceDraft(currentNode.acceptanceCriteria || '')
                      setIsEditingAcceptance(false)
                    }}
                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveAcceptance}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 font-medium"
                  >
                    保存标准
                  </button>
                </div>
              </div>
            ) : currentNode.acceptanceCriteria ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {currentNode.acceptanceCriteria}
              </div>
            ) : (
              <div className="p-3 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-400 text-center">
                尚未填写验收标准。明确的验收标准有助于 Agent 准确交付并在最后验收时进行核对。
              </div>
            )}
          </div>

          {/* Section: Task Notes / Objective */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                任务目标与背景说明
              </span>
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {currentNode.notes ? '编辑' : '＋ 添加说明'}
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="任务背景、技术文档链接、注意事项..."
                  rows={3}
                  className="w-full text-xs p-2.5 border border-blue-400 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setNotesDraft(currentNode.notes || '')
                      setIsEditingNotes(false)
                    }}
                    className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 font-medium"
                  >
                    保存说明
                  </button>
                </div>
              </div>
            ) : currentNode.notes ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {currentNode.notes}
              </div>
            ) : null}
          </div>

          {/* Section: Execution History (Multi-Round Timeline) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                执行历史与事件流 (共 {rounds.length} 轮执行)
              </span>
            </div>

            {events.length === 0 ? (
              <div className="p-6 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xs text-slate-400">
                暂无执行记录。点击上方「开始执行」即可记录第 1 轮推进。
              </div>
            ) : (
              <div className="space-y-4">
                {/* Group events by rounds or render chronologically */}
                {rounds.map((round) => {
                  const roundEvents = events.filter((e) => e.roundId === round.id)
                  const isCurrent = round.id === currentRound?.id
                  return (
                    <div
                      key={round.id}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950/20"
                    >
                      <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            第 {round.roundNumber} 轮执行
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {round.owner}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[10px] rounded font-semibold">
                              当前轮次
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 font-mono text-[11px]">
                          {new Date(round.startTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {round.conclusion && (
                            <span className="ml-2 font-semibold">
                              [
                              {round.conclusion === 'ACCEPTED'
                                ? '验收通过'
                                : round.conclusion === 'REJECTED'
                                  ? '退回重做'
                                  : round.conclusion}
                              ]
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Event items in this round */}
                      <div className="p-3 space-y-2.5 text-xs">
                        {roundEvents.map((evt) => (
                          <div
                            key={evt.id}
                            className="flex items-start gap-2.5 pl-2 border-l-2 border-slate-200 dark:border-slate-800"
                          >
                            <span className="text-[11px] font-mono text-slate-400 mt-0.5 shrink-0">
                              {new Date(evt.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {evt.summary}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded">
                                  {evt.source}
                                </span>
                              </div>
                              {evt.changedFiles && (
                                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  改动：{evt.changedFiles}
                                </p>
                              )}
                              {evt.testResults && (
                                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                  测试：{evt.testResults}
                                </p>
                              )}
                              {evt.blockerReason && (
                                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                                  阻塞原因：{evt.blockerReason}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer: Delete Task */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
          <button
            onClick={() => {
              if (confirm(`确定删除任务「${currentNode.title}」？`)) {
                onDeleteNode(currentNode.id)
                onClose()
              }
            }}
            className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除此任务</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs rounded-lg transition-colors"
          >
            关闭详情
          </button>
        </div>
      </div>

      {/* Action Modals */}
      {/* 1. Start Execution Modal */}
      {actionModal === 'START' && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              开启执行轮次 #{rounds.length + 1}
            </h3>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500">指定本轮执行者：</label>
              <select
                value={modalOwner}
                onChange={(e) => setModalOwner(e.target.value as OwnerType)}
                className="w-full text-xs p-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="SELF">自己</option>
                <option value="GEMINI">Gemini</option>
                <option value="CODEX">Codex</option>
                <option value="OTHER">其他</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal('NONE')}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleConfirmStart}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
              >
                确认开始
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Log Progress Modal */}
      {actionModal === 'PROGRESS' && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-3 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">登记进展</h3>
            <div className="space-y-1">
              <label className="text-slate-500 font-medium">本次进展摘要 *：</label>
              <input
                type="text"
                value={modalSummary}
                onChange={(e) => setModalSummary(e.target.value)}
                placeholder="例如：完成 FMU 输出信号映射"
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-500">改动文件（可选）：</label>
              <input
                type="text"
                value={modalChangedFiles}
                onChange={(e) => setModalChangedFiles(e.target.value)}
                placeholder="例如：fmu_bridge.py, test_bridge.py"
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-500">测试结果（可选）：</label>
              <input
                type="text"
                value={modalTestResults}
                onChange={(e) => setModalTestResults(e.target.value)}
                placeholder="例如：单元测试全部通过"
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal('NONE')}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleConfirmProgress}
                disabled={!modalSummary.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium"
              >
                保存进展
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Block Modal */}
      {actionModal === 'BLOCK' && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-rose-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>标记任务为阻塞</span>
            </h3>
            <div className="space-y-1">
              <label className="text-slate-500 font-medium">阻塞原因说明 *：</label>
              <textarea
                value={modalBlockerReason}
                onChange={(e) => setModalBlockerReason(e.target.value)}
                placeholder="请详细描述阻塞问题，如：缺少 MuJoCo 模型几何文件、步长同步报错..."
                rows={3}
                className="w-full p-2 border border-rose-300 dark:border-rose-800 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal('NONE')}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleConfirmBlock}
                disabled={!modalBlockerReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded font-medium"
              >
                确认阻塞
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Submit for Review Modal */}
      {actionModal === 'SUBMIT' && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full space-y-3 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-purple-600 flex items-center gap-1.5">
              <Send className="w-4 h-4" />
              <span>提交任务交付成果 (进入待验收)</span>
            </h3>
            <div className="space-y-1">
              <label className="text-slate-500 font-medium">交付摘要说明 *：</label>
              <input
                type="text"
                value={modalSummary}
                onChange={(e) => setModalSummary(e.target.value)}
                placeholder="例如：接口代码开发完成，提供对照测试脚本"
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-500">修改交付文件：</label>
              <input
                type="text"
                value={modalChangedFiles}
                onChange={(e) => setModalChangedFiles(e.target.value)}
                placeholder="例如：bridge/fmu_sync.py, tests/verify.py"
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-[11px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-500">测试结果自述：</label>
              <input
                type="text"
                value={modalTestResults}
                onChange={(e) => setModalTestResults(e.target.value)}
                placeholder="例如：运行通过 5 个步长测试用例"
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal('NONE')}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={!modalSummary.trim()}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded font-medium"
              >
                确认提交验收
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Accept Review Modal */}
      {actionModal === 'ACCEPT' && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>人工验收通过</span>
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              确认当前交付成果已达到验收标准。验收通过后，该节点将被标记为「已验收」并立即计入项目总完成率。
            </p>
            <div className="space-y-1">
              <label className="text-slate-500">验收备注（可选）：</label>
              <input
                type="text"
                value={modalReviewNote}
                onChange={(e) => setModalReviewNote(e.target.value)}
                placeholder="例如：实机运行通过，精度符合预期"
                className="w-full p-2 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal('NONE')}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleConfirmAccept}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium"
              >
                确认通过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Reject Review Modal */}
      {actionModal === 'REJECT' && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full space-y-3 shadow-2xl text-xs">
            <h3 className="text-sm font-bold text-rose-600 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4" />
              <span>退回修改 (返工)</span>
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              交付成果未达到要求。本轮记录将完整保留，任务将退回为「待开始 (需返工)」，等待开启新轮次。
            </p>
            <div className="space-y-1">
              <label className="text-slate-500 font-medium">退回原因 / 修改要求 *：</label>
              <textarea
                value={modalRejectionReason}
                onChange={(e) => setModalRejectionReason(e.target.value)}
                placeholder="请详细说明退回原因，例如：时间步长同步在 0.01s 时出现发散，需补充插值处理..."
                rows={3}
                className="w-full p-2 border border-rose-300 dark:border-rose-800 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal('NONE')}
                className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
              >
                取消
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!modalRejectionReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded font-medium"
              >
                确认退回修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
