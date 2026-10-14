import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Project, TaskNode, OwnerType } from '../domain/types'
import { makeTasklineGraph, TasklineGraph, isNodeCompleted } from '../domain/taskline'
import { reconcileHierarchy, getNodeCheckState, toggleTask } from '../domain/calculator'
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  GitMerge,
  ArrowRight,
  X,
  Check,
  CornerDownRight,
  Layers,
  Minus
} from 'lucide-react'

interface TaskLineCanvasProps {
  project: Project
  onUpdateProject: (updates: Partial<Project>) => void
  onUpdateTaskNode?: (updatedNode: TaskNode) => void
  onOpenNodeDrawer?: (node: TaskNode) => void
  selectedNodeId?: string | null
}

export const TaskLineCanvas: React.FC<TaskLineCanvasProps> = ({
  project,
  onUpdateProject,
  onUpdateTaskNode,
  onOpenNodeDrawer,
  selectedNodeId
}) => {
  // Collapse state: defaults to project.tasklineHistoryCollapsed (or true)
  const isHistoryCollapsed = project.tasklineHistoryCollapsed !== false
  const [zoom, setZoom] = useState<number>(1)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)

  // Creation modal state
  const [createMode, setCreateMode] = useState<'next' | 'parallel' | 'merge' | null>(null)
  const [createSourceId, setCreateSourceId] = useState<string | null>(null)
  const [nodeTitleDraft, setNodeTitleDraft] = useState('')
  const [nodeDescDraft, setNodeDescDraft] = useState('')
  const [nodeOwnerDraft, setNodeOwnerDraft] = useState<OwnerType>('GEMINI')
  const [mergeOtherId, setMergeOtherId] = useState<string>('')

  // In-place double-click title editing on canvas card
  const [editingCanvasNodeId, setEditingCanvasNodeId] = useState<string | null>(null)
  const [editingCanvasTitle, setEditingCanvasTitle] = useState('')
  const isCanvasTitleComposing = useRef(false)

  const viewportRef = useRef<HTMLDivElement>(null)

  // Keep internal selected id in sync with prop
  useEffect(() => {
    if (selectedNodeId !== undefined) {
      setInternalSelectedId(selectedNodeId)
    }
  }, [selectedNodeId])

  // Extract all task nodes with reconciled hierarchy
  const flattenedNodes = useMemo(() => {
    const list: TaskNode[] = []
    const healedTasks = reconcileHierarchy((project.tasks || []) as TaskNode[])

    function traverse(nodes: TaskNode[], parent?: TaskNode) {
      if (!Array.isArray(nodes)) return
      nodes.forEach((n) => {
        const item: TaskNode = {
          ...n,
          parentId: n.parentId || parent?.id,
          parents:
            parent && (!n.parents || n.parents.length === 0)
              ? [parent.id]
              : n.parents
        }
        list.push(item)
        if (n.children && n.children.length > 0) {
          traverse(n.children as TaskNode[], n)
        }
      })
    }
    traverse(healedTasks)
    return list
  }, [project.tasks])

  // Build DAG taskline graph
  const graph: TasklineGraph = useMemo(() => {
    return makeTasklineGraph(flattenedNodes, {
      nodeWidth: 236,
      nodeHeight: 124,
      colGap: 70,
      rowGap: 28,
      paddingTop: 56,
      paddingLeft: 36,
      collapseHistory: isHistoryCollapsed
    })
  }, [flattenedNodes, isHistoryCollapsed])

  // Auto fit zoom on initial load and when viewport resizes (e.g. inspector docks/undocks)
  useEffect(() => {
    if (!viewportRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const vw = entry.contentRect.width - 48
        if (vw > 0 && graph.width > 0) {
          if (graph.width > vw) {
            const autoZoom = Math.max(0.6, Math.min(1, Math.round((vw / graph.width) * 100) / 100))
            setZoom(autoZoom)
          }
        }
      }
    })
    ro.observe(viewportRef.current)
    return () => ro.disconnect()
  }, [graph.width])

  const toggleHistoryCollapse = useCallback(() => {
    onUpdateProject({
      tasklineHistoryCollapsed: !isHistoryCollapsed
    })
  }, [isHistoryCollapsed, onUpdateProject])

  // 1-Click quick complete/uncomplete toggle ("卡片看板那种方框")
  const handleToggleComplete = useCallback(
    (nodeId: string) => {
      const raw = flattenedNodes.find((n) => n.id === nodeId)
      if (!raw) return

      // If node has children, toggle all children using toggleTask
      if (raw.children && raw.children.length > 0) {
        const { updatedTasks } = toggleTask((project.tasks || []) as TaskNode[], raw.id)
        onUpdateProject({ tasks: updatedTasks })
        return
      }

      const isCompleted = isNodeCompleted(raw)
      const now = new Date().toISOString()
      const nextCompleted = !isCompleted

      const updated: TaskNode = {
        ...raw,
        completed: nextCompleted,
        status: nextCompleted ? 'ACCEPTED' : 'TODO',
        completedAt: nextCompleted ? now : undefined,
        events: [
          ...(raw.events || []),
          {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            roundId: `round_quick_${Date.now()}`,
            timestamp: now,
            source: 'SELF',
            type: nextCompleted ? 'ACCEPTED' : 'RESUMED',
            summary: nextCompleted ? '快捷勾选标记完成' : '取消完成标记，恢复待开始'
          }
        ],
        updatedAt: now
      }

      if (onUpdateTaskNode) {
        onUpdateTaskNode(updated)
      } else {
        function updateTree(list: TaskNode[]): TaskNode[] {
          return list.map((t) => {
            if (t.id === updated.id) return updated
            if (t.children && t.children.length > 0) {
              return { ...t, children: updateTree(t.children as TaskNode[]) }
            }
            return t
          })
        }
        onUpdateProject({
          tasks: updateTree((project.tasks || []) as TaskNode[])
        })
      }
    },
    [flattenedNodes, onUpdateTaskNode, onUpdateProject, project.tasks]
  )

  const handleCommitCanvasTitle = useCallback(
    (nodeId: string) => {
      const trimmed = editingCanvasTitle.trim()
      const target = flattenedNodes.find((n) => n.id === nodeId)
      if (target && trimmed && trimmed !== target.title) {
        const now = new Date().toISOString()
        const updated: TaskNode = {
          ...target,
          title: trimmed,
          updatedAt: now
        }
        if (onUpdateTaskNode) {
          onUpdateTaskNode(updated)
        } else {
          function updateTree(list: TaskNode[]): TaskNode[] {
            return list.map((t) => {
              if (t.id === nodeId) return updated
              if (t.children && t.children.length > 0) {
                return { ...t, children: updateTree(t.children as TaskNode[]) }
              }
              return t
            })
          }
          onUpdateProject({ tasks: updateTree((project.tasks || []) as TaskNode[]) })
        }
      }
      setEditingCanvasNodeId(null)
    },
    [editingCanvasTitle, flattenedNodes, onUpdateTaskNode, onUpdateProject, project.tasks]
  )

  const handleFitView = () => {
    if (!viewportRef.current || graph.width <= 0) return
    const vw = viewportRef.current.clientWidth - 48
    const nextZoom = Math.max(0.6, Math.min(1, Math.round((vw / graph.width) * 100) / 100))
    setZoom(nextZoom)
  }

  // Node creation triggers
  const handleOpenCreateModal = (mode: 'next' | 'parallel' | 'merge', sourceId: string) => {
    setCreateMode(mode)
    setCreateSourceId(sourceId)
    setNodeTitleDraft('')
    setNodeDescDraft('')
    const srcNode = flattenedNodes.find((n) => n.id === sourceId)
    setNodeOwnerDraft(srcNode?.owner === 'GEMINI' ? 'CODEX' : 'GEMINI')
    const candidates = flattenedNodes.filter((n) => n.id !== sourceId)
    if (candidates.length > 0) {
      setMergeOtherId(candidates[0].id)
    }
  }

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedTitle = nodeTitleDraft.trim()
    if (!trimmedTitle || !createSourceId || !createMode) return

    const srcNode = flattenedNodes.find((n) => n.id === createSourceId)
    if (!srcNode) return

    let parents: string[] = []
    if (createMode === 'parallel') {
      parents = [...(srcNode.parents || [])]
    } else if (createMode === 'merge') {
      parents = [srcNode.id]
      if (mergeOtherId && mergeOtherId !== srcNode.id) {
        parents.push(mergeOtherId)
      }
    } else {
      // next
      parents = [srcNode.id]
    }

    const now = new Date().toISOString()
    const newId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const newNode: TaskNode = {
      id: newId,
      title: trimmedTitle,
      owner: nodeOwnerDraft,
      status: 'TODO',
      notes: nodeDescDraft.trim() || undefined,
      order: flattenedNodes.length,
      parents: [...new Set(parents)],
      children: [],
      rounds: [],
      events: [
        {
          id: `evt_${Date.now()}`,
          roundId: `round_${Date.now()}`,
          timestamp: now,
          source: 'SELF',
          type: 'ASSIGNED',
          summary:
            createMode === 'parallel'
              ? `由「${srcNode.title}」创建并行任务`
              : createMode === 'merge'
              ? `汇合依赖「${srcNode.title}」及另一分支`
              : `接续「${srcNode.title}」的下一步`
        }
      ],
      createdAt: now,
      updatedAt: now
    }

    const nextTasks = [...(project.tasks || []), newNode]
    onUpdateProject({ tasks: nextTasks })
    setCreateMode(null)
    setInternalSelectedId(newId)
    if (onOpenNodeDrawer) {
      onOpenNodeDrawer(newNode)
    }
  }

  // Statistics
  const runningCount = flattenedNodes.filter((n) => n.status === 'IN_PROGRESS').length
  const reviewCount = flattenedNodes.filter((n) => n.status === 'WAITING_REVIEW').length
  const blockedCount = flattenedNodes.filter((n) => n.status === 'BLOCKED').length
  const doneCount = graph.totalCompleted

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-slate-900 select-none overflow-hidden">
      {/* Canvas Top Bar: Info & Controls */}
      <div className="h-11 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[280px]">
            {project.title}
          </h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {flattenedNodes.length} 个工作方块 · 已完成 {doneCount}
          </span>
          {reviewCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold">
              {reviewCount} 待验收
            </span>
          )}
          {runningCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-medium">
              {runningCount} 执行中
            </span>
          )}
          {blockedCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-medium">
              {blockedCount} 阻塞
            </span>
          )}
        </div>

        {/* Right Controls: History Toggle + Zoom */}
        <div className="flex items-center gap-2 shrink-0">
          {/* History Collapse / Expand Toggle Button */}
          {graph.totalCompleted >= 2 && (
            <button
              onClick={toggleHistoryCollapse}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                isHistoryCollapsed
                  ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
              title={isHistoryCollapsed ? '展开全部已完成历史节点' : '收起旧历史，只保留最近完成一步'}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isHistoryCollapsed ? `已收纳历史 (${graph.hiddenCount})` : '收起已完成历史'}</span>
            </button>
          )}

          {/* Viewport Zoom Controls */}
          <div className="flex items-center gap-0.5 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
            <button
              onClick={handleFitView}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
              title="适应画布"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.55, Math.round((z - 0.1) * 10) / 10))}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded"
              title="缩小"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="font-mono text-[10px] min-w-[32px] text-center text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.3, Math.round((z + 0.1) * 10) / 10))}
              className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded"
              title="放大"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* DAG Viewport (Dot Grid, NO giant stage column backgrounds) */}
      <div
        ref={viewportRef}
        className="flex-1 w-full h-full relative overflow-auto bg-slate-50 dark:bg-slate-950"
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 0.75px, transparent 0.75px)',
          backgroundSize: '24px 24px'
        }}
      >
        <div
          className="relative origin-top-left transition-transform duration-75"
          style={{
            width: `${Math.max(graph.width, 800) * zoom}px`,
            height: `${Math.max(graph.height, 500) * zoom}px`
          }}
        >
          <div
            className="absolute origin-top-left"
            style={{
              transform: `scale(${zoom})`,
              width: `${Math.max(graph.width, 800)}px`,
              height: `${Math.max(graph.height, 500)}px`
            }}
          >
            {/* Breadcrumb Stage Markers (Light, NO huge grey background columns) */}
            {graph.stages.map((st) => (
              <div
                key={st.col}
                className="absolute top-3.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 pointer-events-none select-none z-[1]"
                style={{ left: `${st.x}px` }}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    st.isHistoryStage
                      ? 'bg-slate-400'
                      : st.col === 1 && graph.showCapsule
                      ? 'bg-emerald-400'
                      : 'bg-blue-400'
                  }`}
                />
                <span>{st.title}</span>
              </div>
            ))}

            {/* Quick Re-collapse button when in Expanded View */}
            {!isHistoryCollapsed && graph.totalCompleted >= 2 && (
              <button
                onClick={toggleHistoryCollapse}
                className="absolute top-3 left-10 z-10 flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors shadow-xs"
                title="收起旧历史，只保留最近完成一步"
              >
                <span>▴ 收起已完成历史</span>
              </button>
            )}

            {/* SVG Connecting Edges */}
            <svg
              className="absolute inset-0 pointer-events-none overflow-visible z-[1]"
              width={Math.max(graph.width, 800)}
              height={Math.max(graph.height, 500)}
            >
              <defs>
                <marker
                  id="edge-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
                </marker>
              </defs>
              {graph.edges.map((edge, idx) => (
                <path
                  key={`${edge.from}-${edge.to}-${idx}`}
                  d={edge.pathD}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.8"
                  strokeDasharray={edge.isDashed ? '4 4' : undefined}
                  strokeLinecap="round"
                  className="opacity-80"
                />
              ))}
            </svg>

            {/* Visual Task Nodes & Compact History Capsule */}
            {graph.items.map((item) => {
              const pos = graph.positions.get(item.id)
              if (!pos) return null

              // Compact History Capsule (v3.1 specification)
              if (item.isArchive) {
                return (
                  <div
                    key="__archive__"
                    onClick={toggleHistoryCollapse}
                    className="absolute z-[3] w-[160px] h-[38px] flex items-center justify-between px-3 bg-white dark:bg-slate-900 border-[1.5px] border-dashed border-slate-300 dark:border-slate-600 hover:border-blue-500 rounded-full text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer group"
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`
                    }}
                    title="点击展开完整已完成历史节点"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">
                        ↶
                      </span>
                      <span>已完成历史 · {item.count} 步</span>
                    </div>
                    <span className="text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-transform text-[11px]">
                      ▸
                    </span>
                  </div>
                )
              }

              // Task Card (Clean, 236px width, legible, hierarchy aligned)
              const raw = item.rawNode
              const isSelected = internalSelectedId === item.id
              const hasChildren = Boolean(item.hasChildren && raw?.children && raw.children.length > 0)
              const isSubtask = Boolean(item.isSubtask)
              const checkState = raw && hasChildren ? getNodeCheckState(raw) : (item.status === 'ACCEPTED' ? 'checked' : 'unchecked')
              const isDone = checkState === 'checked' || (!hasChildren && item.status === 'ACCEPTED')
              const isRecentDone = Boolean(item.isRecentDone)

              return (
                <div
                  key={item.id}
                  data-node-id={item.id}
                  onClick={() => {
                    setInternalSelectedId(item.id)
                    if (raw && onOpenNodeDrawer) {
                      onOpenNodeDrawer(raw)
                    }
                  }}
                  className={`absolute z-[2] w-[236px] min-h-[122px] bg-white dark:bg-slate-800 border rounded-2xl p-3.5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSubtask ? 'border-l-[4px] border-l-blue-400 dark:border-l-blue-500' : ''
                  } ${
                    isRecentDone
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/20 dark:bg-emerald-950/20'
                      : isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                      : isDone
                      ? 'border-slate-200 dark:border-slate-700/80 opacity-95'
                      : item.status === 'IN_PROGRESS'
                      ? 'border-blue-300 dark:border-blue-700/80 ring-1 ring-blue-400/20'
                      : item.status === 'WAITING_REVIEW'
                      ? 'border-amber-300 dark:border-amber-700/80 ring-1 ring-amber-400/20'
                      : item.status === 'BLOCKED'
                      ? 'border-rose-300 dark:border-rose-700/80'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`
                  }}
                >
                  {/* Subtask Breadcrumb Indicator */}
                  {isSubtask && item.parentTitle && (
                    <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium px-1.5 py-0.5 rounded bg-blue-50/80 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/60 truncate -mb-0.5">
                      <CornerDownRight className="w-3 h-3 shrink-0 text-blue-500" />
                      <span className="opacity-75 shrink-0">子任务 · 隶属</span>
                      <span className="font-semibold truncate max-w-[120px]">「{item.parentTitle}」</span>
                    </div>
                  )}

                  {/* Card Header: 1-Click Checkbox + Owner + Status + Recent Done / Parent Pill */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Checkbox square */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleComplete(item.id)
                        }}
                        className={`w-4 h-4 rounded flex items-center justify-center transition-all shrink-0 cursor-pointer border ${
                          checkState === 'checked'
                            ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                            : checkState === 'indeterminate'
                            ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:border-emerald-400'
                        }`}
                        title={
                          hasChildren
                            ? checkState === 'checked'
                              ? '点击重新打开所有子任务'
                              : '点击快捷标记所有子任务完成'
                            : isDone
                            ? '点击恢复为未完成'
                            : '点击快捷标记完成'
                        }
                      >
                        {checkState === 'checked' && <Check className="w-3 h-3 text-white stroke-[3]" />}
                        {checkState === 'indeterminate' && <Minus className="w-3 h-3 text-white stroke-[3]" />}
                      </button>

                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 ${
                            item.owner === 'GEMINI'
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                              : item.owner === 'CODEX'
                              ? 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {item.owner === 'GEMINI' ? 'G' : item.owner === 'CODEX' ? 'C' : '我'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                          {item.owner === 'GEMINI' ? 'Gemini' : item.owner === 'CODEX' ? 'Codex' : '自己'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {hasChildren ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>父任务 · {item.acceptedSubtaskCount}/{item.subtaskCount}</span>
                        </span>
                      ) : (
                        <>
                          {isRecentDone && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              最近完成✓
                            </span>
                          )}
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                              item.status === 'ACCEPTED'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : item.status === 'IN_PROGRESS'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                : item.status === 'WAITING_REVIEW'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                : item.status === 'BLOCKED'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {item.status === 'ACCEPTED'
                              ? '已完成'
                              : item.status === 'IN_PROGRESS'
                              ? '执行中'
                              : item.status === 'WAITING_REVIEW'
                              ? '待验收'
                              : item.status === 'BLOCKED'
                              ? '阻塞'
                              : '待开始'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Title & Desc / Subtasks preview */}
                  <div className="space-y-1">
                    {editingCanvasNodeId === item.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingCanvasTitle}
                          onChange={(e) => setEditingCanvasTitle(e.target.value)}
                          onCompositionStart={() => {
                            isCanvasTitleComposing.current = true
                          }}
                          onCompositionEnd={() => {
                            isCanvasTitleComposing.current = false
                          }}
                          onKeyDown={(e) => {
                            if (isCanvasTitleComposing.current || e.nativeEvent.isComposing) return
                            if (e.key === 'Enter') {
                              e.stopPropagation()
                              handleCommitCanvasTitle(item.id)
                            }
                            if (e.key === 'Escape') {
                              e.stopPropagation()
                              setEditingCanvasNodeId(null)
                            }
                          }}
                          onBlur={() => handleCommitCanvasTitle(item.id)}
                          autoFocus
                          className="w-full text-xs font-bold px-1.5 py-0.5 border border-blue-500 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none shadow-xs"
                        />
                      </div>
                    ) : (
                      <h3
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingCanvasNodeId(item.id)
                          setEditingCanvasTitle(item.title)
                        }}
                        className={`text-xs font-bold leading-snug line-clamp-2 transition-colors cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 ${
                          isDone
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-100'
                        }`}
                        title="双击直接修改方块名称"
                      >
                        {item.title}
                      </h3>
                    )}
                    {hasChildren && raw?.children && raw.children.length > 0 ? (
                      <div className="space-y-1 my-1 bg-slate-50/90 dark:bg-slate-900/70 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                        {raw.children.slice(0, 3).map((sub) => {
                          const isSubDone = isNodeCompleted(sub)
                          return (
                            <div key={sub.id} className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSubDone ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                              <span className={`truncate flex-1 ${isSubDone ? 'line-through opacity-70' : ''}`}>{sub.title}</span>
                              <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                                {sub.owner === 'GEMINI' ? 'Gemini' : sub.owner === 'CODEX' ? 'Codex' : '自己'}
                              </span>
                            </div>
                          )
                        })}
                        {raw.children.length > 3 && (
                          <div className="text-[9px] text-slate-400 pl-3">+{raw.children.length - 3} 个更多子任务...</div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {item.desc || '暂无说明，点击查看或登记执行进展'}
                      </p>
                    )}
                  </div>

                  {/* Card Footer: Latest event snippet + Quick add triggers */}
                  <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="truncate max-w-[125px]">
                      {raw?.events && raw.events.length > 0
                        ? `↗ ${raw.events[raw.events.length - 1].summary}`
                        : '待开始'}
                    </span>

                    {/* Quick DAG Branching Action Icons */}
                    <div
                      className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleOpenCreateModal('next', item.id)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-blue-600"
                        title="接续下一步"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleOpenCreateModal('parallel', item.id)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-indigo-600"
                        title="创建并行分支"
                      >
                        <GitBranch className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleOpenCreateModal('merge', item.id)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-emerald-600"
                        title="汇合其他分支"
                      >
                        <GitMerge className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal: Create Next / Parallel / Merge Node */}
      {createMode && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xl max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {createMode === 'next'
                    ? '接续下一步工作方块'
                    : createMode === 'parallel'
                    ? '创建并行分支'
                    : '汇合工作方块'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {createMode === 'parallel'
                    ? '新节点与当前方块共享前置任务，独立推进。'
                    : createMode === 'merge'
                    ? '需等待当前方块与选定分支同时完成。'
                    : '接在当前方块之后，任务线无限延伸。'}
                </p>
              </div>
              <button
                onClick={() => setCreateMode(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNode} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  工作名称
                </label>
                <input
                  type="text"
                  required
                  placeholder="例如：编写接口单元测试、验证动态响应..."
                  value={nodeTitleDraft}
                  onChange={(e) => setNodeTitleDraft(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  说明与目标
                </label>
                <textarea
                  rows={2}
                  placeholder="补充背景、验收标准或注意事项..."
                  value={nodeDescDraft}
                  onChange={(e) => setNodeDescDraft(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {createMode === 'merge' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    汇合的另一前置分支
                  </label>
                  <select
                    value={mergeOtherId}
                    onChange={(e) => setMergeOtherId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
                  >
                    {flattenedNodes
                      .filter((n) => n.id !== createSourceId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.status})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  执行者分配
                </label>
                <select
                  value={nodeOwnerDraft}
                  onChange={(e) => setNodeOwnerDraft(e.target.value as OwnerType)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100"
                >
                  <option value="GEMINI">Gemini (主理架构/重构)</option>
                  <option value="CODEX">Codex (主理实现/工程)</option>
                  <option value="SELF">自己 (手动实施/确认)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateMode(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={!nodeTitleDraft.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs"
                >
                  创建并接入任务线
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
