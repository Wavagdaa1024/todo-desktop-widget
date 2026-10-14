import React, { useState } from 'react'
import type { TaskNode, Project, TaskNodeStatus } from '../../domain/types'
import {
  ChevronRight,
  ChevronDown,
  Layers,
  Plus,
  Trash2,
  Check,
  X,
  FileText,
  ShieldCheck,
  Terminal,
  Copy
} from 'lucide-react'

interface NodeAdvancedDisclosureProps {
  project: Project
  node: TaskNode
  onUpdateNode: (updatedNode: TaskNode) => void
  onDeleteNode: (nodeId: string) => void
  onSelectNode?: (node: TaskNode) => void
}

export const NodeAdvancedDisclosure: React.FC<NodeAdvancedDisclosureProps> = ({
  project,
  node,
  onUpdateNode,
  onDeleteNode,
  onSelectNode
}) => {
  const [isOpen, setIsOpen] = useState(false)

  // Acceptance Criteria
  const [isEditingAcceptance, setIsEditingAcceptance] = useState(false)
  const [acceptanceDraft, setAcceptanceDraft] = useState(node.acceptanceCriteria || '')

  // Notes
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(node.notes || '')

  // Subtasks
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [showAddSubtask, setShowAddSubtask] = useState(false)

  // Copy prompt
  const [copiedPrompt, setCopiedPrompt] = useState(false)

  const subtasks = (node.children || []) as TaskNode[]
  const acceptedSubtasks = subtasks.filter(
    (s) => s.status === 'ACCEPTED' || Boolean(s.completed)
  ).length

  const handleSaveAcceptance = () => {
    const trimmed = acceptanceDraft.trim()
    onUpdateNode({
      ...node,
      acceptanceCriteria: trimmed || undefined,
      updatedAt: new Date().toISOString()
    })
    setIsEditingAcceptance(false)
  }

  const handleSaveNotes = () => {
    const trimmed = notesDraft.trim()
    onUpdateNode({
      ...node,
      notes: trimmed || undefined,
      updatedAt: new Date().toISOString()
    })
    setIsEditingNotes(false)
  }

  const handleAddSubtask = () => {
    const trimmed = newSubtaskTitle.trim()
    if (!trimmed) return
    const now = new Date().toISOString()
    const newChild: TaskNode = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: trimmed,
      status: 'TODO',
      owner: 'SELF',
      order: subtasks.length,
      parentId: node.id,
      parents: [node.id],
      children: [],
      rounds: [],
      events: [
        {
          id: `evt_${Date.now()}`,
          roundId: `round_${Date.now()}`,
          timestamp: now,
          source: 'SELF',
          type: 'ASSIGNED',
          summary: `作为「${node.title}」的子任务创建`
        }
      ],
      createdAt: now,
      updatedAt: now,
      completed: false
    }

    onUpdateNode({
      ...node,
      children: [...subtasks, newChild],
      updatedAt: now
    })
    setNewSubtaskTitle('')
    setShowAddSubtask(false)
  }

  const handleToggleSubtask = (subId: string) => {
    const now = new Date().toISOString()
    const nextChildren = subtasks.map((s) => {
      if (s.id !== subId) return s
      const isDone = s.status === 'ACCEPTED' || Boolean(s.completed)
      return {
        ...s,
        completed: !isDone,
        status: (!isDone ? 'ACCEPTED' : 'TODO') as TaskNodeStatus,
        completedAt: !isDone ? now : undefined,
        updatedAt: now
      }
    })
    onUpdateNode({
      ...node,
      children: nextChildren,
      updatedAt: now
    })
  }

  const handleDeleteSubtask = (subId: string) => {
    onUpdateNode({
      ...node,
      children: subtasks.filter((s) => s.id !== subId),
      updatedAt: new Date().toISOString()
    })
  }

  const handleCopyPrompt = async () => {
    const prompt = `# 任务指令：${node.title}
- 所属项目：${project.title}
- 负责人/执行者：${node.owner || 'SELF'}
- 状态：${node.status || 'TODO'}
- 验收标准：${node.acceptanceCriteria || '按目标完成自测并验证'}
- 说明与背景：${node.notes || '无'}
- 前置依赖：${(node.parents || []).join(', ') || '无'}
`
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(prompt)
      } else if ((window as any).electronAPI?.system?.copyText) {
        await (window as any).electronAPI.system.copyText(prompt)
      }
    } catch {}

    setCopiedPrompt(true)
    setTimeout(() => setCopiedPrompt(false), 2000)
  }

  return (
    <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-left text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors select-none"
      >
        <div className="flex items-center gap-1.5">
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>更多：子任务 / 验收标准 / 备注 / 高级设置</span>
        </div>
        <span className="text-[10px] text-slate-400 font-normal">
          {isOpen ? '点击收起' : '按需展开'}
        </span>
      </button>

      {isOpen && (
        <div className="p-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 space-y-4">
          {/* 1. Subtasks List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>子任务清单</span>
                {subtasks.length > 0 && (
                  <span className="text-[10px] font-normal text-slate-400">
                    ({acceptedSubtasks}/{subtasks.length})
                  </span>
                )}
              </div>
              {!showAddSubtask && (
                <button
                  type="button"
                  onClick={() => setShowAddSubtask(true)}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  <span>添加子任务</span>
                </button>
              )}
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1.5">
                {subtasks.map((sub) => {
                  const isSubDone = sub.status === 'ACCEPTED' || Boolean(sub.completed)
                  return (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 group hover:border-slate-300 transition-colors text-xs"
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
                          title={isSubDone ? '恢复为未完成' : '标记子任务完成'}
                        >
                          {isSubDone && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                        </button>
                        <span
                          onClick={() => onSelectNode && onSelectNode(sub)}
                          className={`truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex-1 ${
                            isSubDone
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                          title="点击查看子任务"
                        >
                          {sub.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                          {sub.owner === 'GEMINI' ? 'Gemini' : sub.owner === 'CODEX' ? 'Codex' : '自己'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSubtask(sub.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-opacity"
                          title="删除子任务"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {showAddSubtask && (
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  placeholder="输入子任务名称，回车添加..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubtask()
                    if (e.key === 'Escape') {
                      setNewSubtaskTitle('')
                      setShowAddSubtask(false)
                    }
                  }}
                  autoFocus
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  添加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewSubtaskTitle('')
                    setShowAddSubtask(false)
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* 2. Acceptance Criteria */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>验收标准</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isEditingAcceptance) handleSaveAcceptance()
                  else setIsEditingAcceptance(true)
                }}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {isEditingAcceptance ? '保存' : '编辑'}
              </button>
            </div>
            {isEditingAcceptance ? (
              <textarea
                rows={2}
                value={acceptanceDraft}
                onChange={(e) => setAcceptanceDraft(e.target.value)}
                placeholder="例如：单元测试覆盖率 > 90%，接口自测通过"
                className="w-full p-2 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg text-xs outline-none resize-none"
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditingAcceptance(true)}
                className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs cursor-pointer hover:border-slate-300"
              >
                {node.acceptanceCriteria || (
                  <span className="text-slate-400 italic">点击添加验收标准...</span>
                )}
              </div>
            )}
          </div>

          {/* 3. Notes & Background */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>补充说明与背景</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (isEditingNotes) handleSaveNotes()
                  else setIsEditingNotes(true)
                }}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
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
                className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-xs cursor-pointer hover:border-slate-300"
              >
                {node.notes || (
                  <span className="text-slate-400 italic">点击添加任务背景说明...</span>
                )}
              </div>
            )}
          </div>

          {/* 4. Agent Context Prompt */}
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
              <Terminal className="w-3 h-3" />
              <span>当前任务 Prompt 指令</span>
            </span>
            <button
              type="button"
              onClick={handleCopyPrompt}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                copiedPrompt
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Copy className="w-3 h-3" />
              <span>{copiedPrompt ? '已复制！' : '复制 Prompt'}</span>
            </button>
          </div>

          {/* 5. Delete Task Action */}
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">危险操作</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`确定删除任务「${node.title}」？此操作不可撤销。`)) {
                  onDeleteNode(node.id)
                }
              }}
              className="flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>删除此方块</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
