import { TaskNode, TaskItem, TaskNodeStatus, OwnerType } from './types'

export const ARCHIVED_STATUSES = new Set<TaskNodeStatus>(['ACCEPTED'])

export interface TasklineVisualNode {
  id: string
  title: string
  owner: OwnerType | string
  status: TaskNodeStatus | 'archive'
  desc?: string
  parents?: string[]
  renderParents?: string[]
  isArchive?: boolean
  isRecentDone?: boolean
  count?: number
  completedAt?: string
  createdAt?: string
  rawNode?: TaskNode
}

export interface TasklinePosition {
  x: number
  y: number
  isCapsule?: boolean
}

export interface TasklineEdge {
  from: string
  to: string
  isDashed?: boolean
  pathD?: string
}

export interface TasklineStage {
  col: number
  x: number
  width: number
  title: string
  isHistoryStage?: boolean
}

export interface TasklineGraph {
  items: TasklineVisualNode[]
  positions: Map<string, TasklinePosition>
  edges: TasklineEdge[]
  stages: TasklineStage[]
  maxDepth: number
  rowMax: number
  width: number
  height: number
  showCapsule: boolean
  hiddenCount: number
  totalCompleted: number
  latestCompletedNode: TaskNode | null
  getColX: (depth: number) => number
}

export interface TasklineLayoutOptions {
  nodeWidth?: number
  nodeHeight?: number
  colGap?: number
  rowGap?: number
  capsuleWidth?: number
  capsuleHeight?: number
  paddingLeft?: number
  paddingTop?: number
  collapseHistory?: boolean
}

export function isNodeCompleted(n: TaskItem | TaskNode): boolean {
  if (n.status === 'ACCEPTED') return true
  if (n.status === undefined && Boolean(n.completed)) return true
  return false
}

export function getCompletedTime(n: TaskItem | TaskNode): number {
  if (n.completedAt) {
    const t = new Date(n.completedAt).getTime()
    if (!Number.isNaN(t)) return t
  }
  if (Array.isArray(n.events) && n.events.length > 0) {
    const acceptedEvent = [...n.events].reverse().find((e) => e.type === 'ACCEPTED')
    if (acceptedEvent?.timestamp) {
      const t = new Date(acceptedEvent.timestamp).getTime()
      if (!Number.isNaN(t)) return t
    }
  }
  if (n.updatedAt) {
    const t = new Date(n.updatedAt).getTime()
    if (!Number.isNaN(t)) return t
  }
  if (n.createdAt) {
    const t = new Date(n.createdAt).getTime()
    if (!Number.isNaN(t)) return t
  }
  return 0
}

/**
 * Implements v3.1 DAG Completed History Auto-Collapse Algorithm:
 * - Sort completed nodes chronologically ascending (with ID as secondary tiebreaker).
 * - Rule 1: Auto-collapse enabled by default.
 * - Rule 2: Active nodes (TODO, IN_PROGRESS, WAITING_REVIEW, BLOCKED) are NEVER collapsed.
 * - Rule 3: If 0 completed: no capsule, no blank placeholder.
 * - Rule 4: If 1 completed: show normally as regular card, no capsule.
 * - Rule 5: If >= 2 completed:
 *     - When collapsed: hiddenNodes = completedNodes.slice(0, -1), latestCompletedNode = completedNodes[last].
 *       History capsule inserted as [已完成历史 · N 步 ▸].
 *     - When expanded: all nodes visible.
 * - Reroute edges so downstream active nodes cleanly link to latestCompletedNode or history capsule.
 */
export function makeTasklineGraph(
  nodes: TaskNode[],
  options: TasklineLayoutOptions = {}
): TasklineGraph {
  const NODE_W = options.nodeWidth ?? 244
  const NODE_H = options.nodeHeight ?? 158
  const COL_GAP = options.colGap ?? 84
  const ROW_GAP = options.rowGap ?? 35
  const CAPSULE_W = options.capsuleWidth ?? 172
  const CAPSULE_H = options.capsuleHeight ?? 42
  const LEFT = options.paddingLeft ?? 50
  const TOP = options.paddingTop ?? 95
  const isAutoCollapsed = options.collapseHistory !== false

  const completedNodes = nodes.filter((n) => isNodeCompleted(n))
  const activeNodes = nodes.filter((n) => !isNodeCompleted(n))

  // Sort completed nodes chronologically ascending by completion time, then stable by ID
  completedNodes.sort((a, b) => {
    const diff = getCompletedTime(a) - getCompletedTime(b)
    if (diff !== 0) return diff
    return (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)
  })

  const totalCompleted = completedNodes.length
  let hiddenNodes: TaskNode[] = []
  let visibleNodes: TaskNode[] = []
  let latestCompletedNode: TaskNode | null = null
  let showCapsule = false

  if (totalCompleted <= 1) {
    // Rule 3 (0 completed) & Rule 4 (1 completed): No capsule!
    visibleNodes = [...completedNodes, ...activeNodes]
    hiddenNodes = []
    latestCompletedNode = totalCompleted === 1 ? completedNodes[0] : null
    showCapsule = false
  } else {
    // Rule 5: >= 2 completed nodes
    latestCompletedNode = completedNodes[completedNodes.length - 1]
    if (isAutoCollapsed) {
      hiddenNodes = completedNodes.slice(0, completedNodes.length - 1)
      visibleNodes = [latestCompletedNode, ...activeNodes]
      showCapsule = true
    } else {
      hiddenNodes = []
      visibleNodes = [...completedNodes, ...activeNodes]
      showCapsule = false
    }
  }

  const hiddenSet = new Set(hiddenNodes.map((n) => n.id))
  const visibleSet = new Set(visibleNodes.map((n) => n.id))

  // Calculate effective visual parents with DAG rerouting
  function getRenderParents(n: TaskNode): string[] {
    if (showCapsule && n.id === latestCompletedNode?.id) {
      return ['__archive__']
    }

    const res = new Set<string>()
    let hasHiddenAncestor = false

    function trace(pid: string, seen = new Set<string>()): void {
      if (seen.has(pid)) return
      seen.add(pid)
      if (visibleSet.has(pid)) {
        res.add(pid)
        return
      }
      if (hiddenSet.has(pid)) {
        hasHiddenAncestor = true
        const parentObj = nodes.find((x) => x.id === pid)
        ;(parentObj?.parents || []).forEach((pp) => trace(pp, new Set(seen)))
      }
    }

    ;(n.parents || []).forEach((pid) => trace(pid))

    // If node depended directly on hidden history and has no visible parent,
    // connect it cleanly to the history capsule anchor
    if (showCapsule && hasHiddenAncestor && res.size === 0) {
      res.add('__archive__')
    }

    return [...res]
  }

  const visualItems: TasklineVisualNode[] = visibleNodes.map((n) => ({
    id: n.id,
    title: n.title,
    owner: n.owner || 'SELF',
    status: n.status || (n.completed ? 'ACCEPTED' : 'TODO'),
    desc: n.notes || n.acceptanceCriteria,
    parents: n.parents,
    renderParents: getRenderParents(n),
    isArchive: false,
    isRecentDone: Boolean(latestCompletedNode && n.id === latestCompletedNode.id && totalCompleted >= 2),
    completedAt: n.completedAt,
    createdAt: n.createdAt,
    rawNode: n
  }))

  if (showCapsule) {
    visualItems.unshift({
      id: '__archive__',
      title: `已完成历史 · ${hiddenNodes.length} 步`,
      owner: 'HISTORY',
      status: 'archive',
      isArchive: true,
      count: hiddenNodes.length,
      renderParents: []
    })
  }

  const graphMap = new Map<string, TasklineVisualNode>(visualItems.map((n) => [n.id, n]))
  const depthMemo = new Map<string, number>()

  function calcDepth(id: string, seen = new Set<string>()): number {
    if (depthMemo.has(id)) return depthMemo.get(id)!
    if (seen.has(id)) return 0
    seen.add(id)
    const n = graphMap.get(id)
    if (!n) return 0
    if (n.id === '__archive__') {
      depthMemo.set(id, 0)
      return 0
    }
    const pDepths = (n.renderParents || [])
      .filter((pid) => graphMap.has(pid))
      .map((pid) => calcDepth(pid, new Set(seen)))

    let d: number
    if (pDepths.length === 0) {
      // If showCapsule is true, active root tasks without parents should start at depth 1
      // so Column 0 is reserved purely for the history capsule
      d = showCapsule ? 1 : 0
    } else {
      d = Math.max(...pDepths) + 1
    }
    depthMemo.set(id, d)
    return d
  }

  visualItems.forEach((n) => calcDepth(n.id))

  const cols = new Map<number, TasklineVisualNode[]>()
  visualItems.forEach((n) => {
    const d = depthMemo.get(n.id) || 0
    if (!cols.has(d)) cols.set(d, [])
    cols.get(d)!.push(n)
  })

  const maxDepth = Math.max(0, ...cols.keys())
  const rowMax = Math.max(1, ...[...cols.values()].map((v) => v.length))
  const rowStep = NODE_H + ROW_GAP

  // Dynamic column widths:
  // Each column's allocated width is the max width of the items actually inside it.
  const colWidths = new Map<number, number>()
  for (let d = 0; d <= maxDepth; d++) {
    const colNodes = cols.get(d) || []
    const maxW = colNodes.reduce(
      (w, n) => Math.max(w, n.isArchive ? CAPSULE_W : NODE_W),
      0
    )
    colWidths.set(d, maxW || (showCapsule && d === 0 ? CAPSULE_W : NODE_W))
  }

  function getColX(d: number): number {
    let x = LEFT
    for (let i = 0; i < d; i++) {
      x += (colWidths.get(i) || NODE_W) + COL_GAP
    }
    return x
  }

  const lastColX = getColX(maxDepth)
  const lastColW = colWidths.get(maxDepth) || NODE_W
  const contentHeight = Math.max(380, TOP + rowMax * rowStep + 45)
  const contentWidth = Math.max(540, lastColX + lastColW + LEFT + 30)

  const positions = new Map<string, TasklinePosition>()
  for (let d = 0; d <= maxDepth; d++) {
    const colNodes = cols.get(d) || []
    const startY = TOP + ((rowMax - colNodes.length) * rowStep) / 2
    colNodes.forEach((n, i) => {
      if (n.isArchive) {
        const yPos = startY + i * rowStep + (NODE_H - CAPSULE_H) / 2
        positions.set(n.id, { x: getColX(d), y: yPos, isCapsule: true })
      } else {
        positions.set(n.id, { x: getColX(d), y: startY + i * rowStep })
      }
    })
  }

  // Calculate edges with smooth SVG bezier curves
  const edges: TasklineEdge[] = []
  visualItems.forEach((n) => {
    ;(n.renderParents || []).forEach((pid) => {
      const fromPos = positions.get(pid)
      const toPos = positions.get(n.id)
      if (fromPos && toPos) {
        const isFromCapsule = pid === '__archive__'
        const fromW = isFromCapsule ? CAPSULE_W : NODE_W
        const fromH = isFromCapsule ? CAPSULE_H : NODE_H
        const x1 = fromPos.x + fromW
        const y1 = fromPos.y + fromH / 2
        const x2 = toPos.x
        const y2 = toPos.y + NODE_H / 2
        const c1x = (x1 + x2) / 2
        const c2x = (x1 + x2) / 2
        const pathD = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`

        edges.push({
          from: pid,
          to: n.id,
          isDashed: isFromCapsule,
          pathD
        })
      }
    })
  })

  // Calculate background stage columns
  const stages: TasklineStage[] = []
  for (let col = 0; col <= maxDepth; col++) {
    const x = getColX(col) - 16
    const curW = colWidths.get(col) || NODE_W
    const stageW = curW + 32
    let title = `继续推进 · ${String(col + 1).padStart(2, '0')}`
    let isHistoryStage = false

    if (showCapsule && col === 0) {
      title = '已归档历史'
      isHistoryStage = true
    } else if (showCapsule && col === 1) {
      title = '最近完成'
    } else if (!showCapsule && totalCompleted > 0 && col === 0) {
      title = '起点 / 历史'
    }

    stages.push({
      col,
      x,
      width: stageW,
      title,
      isHistoryStage
    })
  }

  return {
    items: visualItems,
    positions,
    edges,
    stages,
    maxDepth,
    rowMax,
    width: contentWidth,
    height: contentHeight,
    showCapsule,
    hiddenCount: hiddenNodes.length,
    totalCompleted,
    latestCompletedNode,
    getColX
  }
}
