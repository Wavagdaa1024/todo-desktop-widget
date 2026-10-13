import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Card, AppData, DEFAULT_SETTINGS, TaskNode } from './domain/types'
import { Header, FilterStatus, SortOption } from './components/Header'
import { TaskCard } from './components/TaskCard'
import { TaskNodeDrawer } from './components/TaskNodeDrawer'
import { SettingsModal } from './components/SettingsModal'
import { isCardOverdue } from './domain/date'
import { reorderCards } from './domain/calculator'
import { Plus, Undo2, AlertTriangle, CheckCircle2 } from 'lucide-react'

export const App: React.FC = () => {
  const [data, setData] = useState<AppData>({
    schemaVersion: 2,
    projects: [],
    cards: [],
    settings: { ...DEFAULT_SETTINGS },
    lastModified: new Date().toISOString()
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [currentFilter, setCurrentFilter] = useState<FilterStatus>('ALL')
  const [currentSort, setCurrentSort] = useState<SortOption>('MANUAL')
  const [showSettings, setShowSettings] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [undoToast, setUndoToast] = useState<{ message: string; action: () => void } | null>(null)
  const [drawerTarget, setDrawerTarget] = useState<{ projectId: string; nodeId: string } | null>(null)
  const isRemoteUpdate = useRef(false)
  const pendingDataRef = useRef<AppData | null>(null)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const currentRevisionRef = useRef<number>(0)

  // Load initial data on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.storage.getInitialData().then((res) => {
        setData(res.data)
        currentRevisionRef.current = res.data.revision || 0
        if (res.recoveryRequired) {
          setIsRecoveryMode(true)
          setIsLoaded(false)
        } else {
          setIsLoaded(true)
          if (res.recoveredFromBackup) {
            alert('提示：检测到原数据文件异常，已自动从最近一份安全备份中恢复。')
          }
        }
      })
    } else {
      setIsLoaded(true)
    }
  }, [])

  // P0-01: Guaranteed flush for pending debounced save
  const flushPendingSave = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!pendingDataRef.current || isRecoveryMode) {
      return true
    }
    const toSave = pendingDataRef.current
    pendingDataRef.current = null
    try {
      if (window.electronAPI) {
        setSaveStatus('saving')
        const success = await window.electronAPI.storage.saveData(toSave)
        setSaveStatus(success ? 'saved' : 'error')
        return success
      }
      return true
    } catch (err) {
      console.error('Flush save error:', err)
      setSaveStatus('error')
      return false
    }
  }, [isRecoveryMode])

  // P0-01: Main process asks renderer to flush pending save before quitting
  useEffect(() => {
    if (!window.electronAPI?.system?.onRequestFlush) return
    const unsubscribe = window.electronAPI.system.onRequestFlush(async () => {
      return await flushPendingSave()
    })
    return () => unsubscribe()
  }, [flushPendingSave])

  // P0-01: Window beforeunload browser event hook
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPendingSave()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [flushPendingSave])

  // Auto-save debounced whenever cards or settings change (Blocked in recovery mode: P0-02)
  useEffect(() => {
    if (!isLoaded || isRecoveryMode) return
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false
      return
    }

    pendingDataRef.current = data
    setSaveStatus('saving')
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null
      if (!pendingDataRef.current) return
      const toSave = pendingDataRef.current
      pendingDataRef.current = null
      try {
        if (window.electronAPI) {
          const success = await window.electronAPI.storage.saveData(toSave)
          setSaveStatus(success ? 'saved' : 'error')
        } else {
          setSaveStatus('saved')
        }
      } catch (err) {
        console.error('Auto save error:', err)
        setSaveStatus('error')
      }
    }, 400)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [data, isLoaded, isRecoveryMode])


  // Sync theme
  useEffect(() => {
    const root = document.documentElement
    const theme = data.settings.theme
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isSystemDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }, [data.settings.theme])

  // Global Keyboard Shortcuts (Ctrl+N, Ctrl+F, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        handleAddNewCard()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement
        searchInput?.focus()
        searchInput?.select()
      } else if (e.key === 'Escape') {
        setShowSettings(false)
        setUndoToast(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [data.cards])

  // Listen for data updates broadcast from Main (Dual-window event sync)
  useEffect(() => {
    if (!window.electronAPI?.storage?.onDataUpdated) return
    const unsubscribe = window.electronAPI.storage.onDataUpdated((remoteData) => {
      // P0-02: Ignore stale broadcasts older or equal to current local revision
      if (
        remoteData.revision !== undefined &&
        currentRevisionRef.current !== undefined &&
        remoteData.revision <= currentRevisionRef.current
      ) {
        return
      }
      if (remoteData.revision !== undefined) {
        currentRevisionRef.current = remoteData.revision
      }
      isRemoteUpdate.current = true
      setData(remoteData)
    })
    return () => unsubscribe()
  }, [])

  // Listen for tray quick actions (P1-02 & P1-03)
  useEffect(() => {
    if (!window.electronAPI?.system?.onQuickAction) return
    const unsubscribe = window.electronAPI.system.onQuickAction((action) => {
      if (action === 'new-card') {
        handleAddNewCard()
      } else if (action === 'filter-waiting-accept') {
        setCurrentFilter('WAITING_ACCEPT')
      }
    })
    return () => unsubscribe()
  }, [])

  // Listen for deep link navigation to specific node from Widget (PRD Section 7.1)
  useEffect(() => {
    if (!window.electronAPI?.window?.onNavigateToNode) return
    const unsubscribe = window.electronAPI.window.onNavigateToNode((target: { projectId?: string; nodeId?: string }) => {
      if (target.projectId) {
        if (target.nodeId) {
          setDrawerTarget({ projectId: target.projectId, nodeId: target.nodeId })
        }
        setTimeout(() => {
          const elem = document.getElementById(`project-${target.projectId}`)
          elem?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleUpdateTaskNode = (projectId: string, updatedNode: TaskNode) => {
    setData((prev) => {
      function replaceNode(tasks: TaskNode[]): TaskNode[] {
        return tasks.map((t) => {
          if (t.id === updatedNode.id) {
            return updatedNode
          }
          if (t.children && t.children.length > 0) {
            return { ...t, children: replaceNode(t.children) }
          }
          return t
        })
      }

      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      const nextCards = prev.cards.map((c) => {
        if (c.id === projectId) {
          const updatedTasks = replaceNode(c.tasks as TaskNode[])
          return {
            ...c,
            tasks: updatedTasks,
            updatedAt: new Date().toISOString()
          }
        }
        return c
      })

      return {
        ...prev,
        cards: nextCards,
        projects: nextCards,
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })
  }

  const handleDeleteTaskNode = (projectId: string, nodeId: string) => {
    setData((prev) => {
      function filterNode(tasks: TaskNode[]): TaskNode[] {
        return tasks
          .filter((t) => t.id !== nodeId)
          .map((t) => ({
            ...t,
            children: t.children ? filterNode(t.children) : []
          }))
      }

      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      const nextCards = prev.cards.map((c) => {
        if (c.id === projectId) {
          return {
            ...c,
            tasks: filterNode(c.tasks as TaskNode[]),
            updatedAt: new Date().toISOString()
          }
        }
        return c
      })

      return {
        ...prev,
        cards: nextCards,
        projects: nextCards,
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })
  }

  // Card Operations
  const handleAddNewCard = () => {
    setData((prev) => {
      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      const newCard: Card = {
        id: 'card_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        // P1-03: Dynamically compute title from current prev.cards state
        title: '新任务卡片 ' + (prev.cards.length + 1),
        status: 'TODO',
        owner: 'SELF',
        order: 0,
        collapsed: false,
        tasks: [],
        aiWork: {
          history: []
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      const nextCards = [newCard, ...prev.cards].map((c, idx) => ({ ...c, order: idx }))
      return {
        ...prev,
        cards: nextCards,
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })
  }

  const handleUpdateCard = (cardId: string, updates: Partial<Card>) => {
    setData((prev) => {
      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      return {
        ...prev,
        cards: prev.cards.map((c) =>
          c.id === cardId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })
  }

  const handleDeleteCard = (cardId: string) => {
    const target = data.cards.find((c) => c.id === cardId)
    const targetIndex = data.cards.findIndex((c) => c.id === cardId)
    if (!target || targetIndex === -1) return

    setData((prev) => {
      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      const remaining = prev.cards.filter((c) => c.id !== cardId).map((c, idx) => ({ ...c, order: idx }))
      return {
        ...prev,
        cards: remaining,
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })

    // Provide undo toast with non-destructive inverse restore (P1-02)
    setUndoToast({
      message: `已删除卡片「${target.title}」`,
      action: () => {
        setData((prev) => {
          if (prev.cards.some((c) => c.id === target.id)) return prev
          const nextRevision = (prev.revision || 0) + 1
          currentRevisionRef.current = nextRevision
          const nextCards = [...prev.cards]
          const insertIdx = Math.min(Math.max(0, targetIndex), nextCards.length)
          nextCards.splice(insertIdx, 0, target)
          return {
            ...prev,
            cards: nextCards.map((c, idx) => ({ ...c, order: idx })),
            revision: nextRevision,
            lastModified: new Date().toISOString()
          }
        })
      }
    })
    setTimeout(() => setUndoToast(null), 6000)
  }

  const handleDuplicateCard = (card: Card) => {
    // Generate new ids for tasks
    function cloneTaskTree(tasks: typeof card.tasks): typeof card.tasks {
      return tasks.map((t) => ({
        ...t,
        id: 'task_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
        completed: false, // Reset completed as per plan.md 1.3
        children: cloneTaskTree(t.children)
      }))
    }

    const duplicated: Card = {
      ...card,
      id: 'card_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: `${card.title} (副本)`,
      status: 'TODO',
      order: 0,
      tasks: cloneTaskTree(card.tasks),
      aiWork: {
        currentTaskDescription: card.aiWork.currentTaskDescription,
        recentProgress: '',
        currentBlockers: '',
        nextAction: '',
        history: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setData((prev) => {
      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      const nextCards = [duplicated, ...prev.cards].map((c, idx) => ({ ...c, order: idx }))
      return {
        ...prev,
        cards: nextCards,
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })
  }

  // Card Reordering based on stable ID (P1-01)
  const handleMoveCardOrder = (cardId: string, direction: 'up' | 'down') => {
    setData((prev) => {
      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      return {
        ...prev,
        cards: reorderCards(prev.cards, cardId, direction),
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })
  }

  // Card Drag and Drop Reordering (P1-01)
  const handleDropCardOrder = (sourceCardId: string, targetCardId: string) => {
    if (sourceCardId === targetCardId) return
    setData((prev) => {
      const sorted = [...prev.cards].sort((a, b) => a.order - b.order)
      const srcIdx = sorted.findIndex((c) => c.id === sourceCardId)
      const tgtIdx = sorted.findIndex((c) => c.id === targetCardId)
      if (srcIdx === -1 || tgtIdx === -1) return prev

      const [moved] = sorted.splice(srcIdx, 1)
      sorted.splice(tgtIdx, 0, moved)
      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      return {
        ...prev,
        cards: sorted.map((c, idx) => ({ ...c, order: idx })),
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })
  }

  const handleInitializeClean = async () => {
    if (confirm('确认放弃损坏的原文件并全新初始化？此操作将清空损坏卡片数据并恢复安全状态。')) {
      if (window.electronAPI?.storage?.initializeClean) {
        const clean = await window.electronAPI.storage.initializeClean()
        currentRevisionRef.current = clean.revision || 0
        setData(clean)
        setIsRecoveryMode(false)
        setIsLoaded(true)
      }
    }
  }


  // Sample Project Creation (As requested by Section 1.1 of plan.md)
  const handleAddSampleProject = () => {
    const sampleCard: Card = {
      id: 'card_sample_mujoco',
      title: 'FMU + MuJoCo 联合仿真',
      category: '动力学与控制',
      description: '多体动力学与控制系统联合仿真测试项目',
      status: 'AI_RUNNING',
      owner: 'GEMINI',
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      order: 0,
      collapsed: false,
      tasks: [
        {
          id: 's_p1',
          title: '检查 FMU 接口',
          completed: false,
          order: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          children: [
            {
              id: 's_l1',
              title: '确认 FMI 版本与 FMU 类型',
              completed: true,
              order: 0,
              children: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 's_l2',
              title: '检查输入输出变量映射',
              completed: true,
              order: 1,
              children: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        },
        {
          id: 's_p2',
          title: 'MuJoCo 联调闭环',
          completed: false,
          order: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          children: [
            {
              id: 's_l3',
              title: '加载 MJCF 场景模型',
              completed: true,
              order: 0,
              children: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 's_l4',
              title: '实现信号交换协议',
              completed: false,
              order: 1,
              children: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            {
              id: 's_l5',
              title: '验证时间步长同步',
              completed: false,
              order: 2,
              children: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        },
        {
          id: 's_l6',
          title: '绘制联合仿真曲线与结果',
          completed: false,
          order: 2,
          children: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      aiWork: {
        activeStartTime: new Date().toISOString(),
        currentTaskDescription: '让 Gemini 优化 fmu_bridge.py 时间步长同步',
        recentProgress: '完成了基础 MJCF 场景与变量映射',
        currentBlockers: 'MuJoCo 步长小于 FMU 步长时的插值问题',
        nextAction: '在 bridge 中实现一阶保持器插值',
        history: [
          {
            id: 'log_1',
            timestamp: new Date().toISOString(),
            source: 'GEMINI',
            summary: '完成 FMU 变量清单提取与测试用例搭建',
            changedFiles: 'src/fmu_bridge.py',
            testResults: '单元测试通过',
            nextAction: '验证时间步长同步'
          }
        ]
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setData((prev) => {
      const nextRevision = (prev.revision || 0) + 1
      currentRevisionRef.current = nextRevision
      const remaining = prev.cards.filter((c) => c.id !== sampleCard.id)
      const nextCards = [sampleCard, ...remaining].map((c, idx) => ({ ...c, order: idx }))
      return {
        ...prev,
        cards: nextCards,
        revision: nextRevision,
        lastModified: new Date().toISOString()
      }
    })
  }

  // Filter & Search & Sort pipeline
  const filteredAndSortedCards = useMemo(() => {
    let result = [...data.cards]

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((card) => {
        const titleMatch = card.title.toLowerCase().includes(q)
        const catMatch = card.category?.toLowerCase().includes(q)
        const descMatch = card.description?.toLowerCase().includes(q)
        const aiFocusMatch = card.aiWork.currentTaskDescription?.toLowerCase().includes(q)
        const aiProgressMatch = card.aiWork.recentProgress?.toLowerCase().includes(q)

        // Check tasks
        const hasTaskMatch = (tasks: typeof card.tasks): boolean => {
          return tasks.some(
            (t) => t.title.toLowerCase().includes(q) || hasTaskMatch(t.children)
          )
        }
        return titleMatch || catMatch || descMatch || aiFocusMatch || aiProgressMatch || hasTaskMatch(card.tasks)
      })
    }

    // 2. Status Filter
    if (currentFilter !== 'ALL') {
      if (currentFilter === 'OVERDUE') {
        result = result.filter((c) => isCardOverdue(c))
      } else {
        result = result.filter((c) => c.status === currentFilter)
      }
    }

    // 3. Sorting
    if (currentSort === 'UPDATED') {
      result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    } else if (currentSort === 'DUE_DATE') {
      result.sort((a, b) => {
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate.localeCompare(b.dueDate)
      })
    } else {
      // MANUAL
      result.sort((a, b) => a.order - b.order)
    }

    return result
  }, [data.cards, searchQuery, currentFilter, currentSort])

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Header
        cards={data.cards}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentFilter={currentFilter}
        onFilterChange={setCurrentFilter}
        currentSort={currentSort}
        onSortChange={setCurrentSort}
        onAddCard={handleAddNewCard}
        onOpenSettings={() => setShowSettings(true)}
        saveStatus={saveStatus}
        onAddSampleProject={handleAddSampleProject}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {data.cards.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center border border-blue-100 dark:border-blue-900/60 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                还没有任务卡片
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                创建任务后，这里会显示任务清单与 AI 协同工作状态。
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleAddNewCard}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium text-xs rounded-xl shadow-sm shadow-blue-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ 新建任务卡片</span>
              </button>
              <button
                onClick={handleAddSampleProject}
                className="text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:underline px-2 py-1"
              >
                载入演示项目 (FMU + MuJoCo)
              </button>
            </div>
          </div>
        ) : filteredAndSortedCards.length === 0 ? (
          /* No search or filter result */
          <div className="text-center py-20 text-slate-400 space-y-2">
            <p className="text-sm">没有匹配到符合筛选条件的卡片</p>
            <button
              onClick={() => {
                setSearchQuery('')
                setCurrentFilter('ALL')
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              清除所有筛选条件
            </button>
          </div>
        ) : (
          /* Responsive Card Grid (3 / 2 / 1 columns, 320-400px cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
            {filteredAndSortedCards.map((card, index) => (
              <TaskCard
                key={card.id}
                card={card}
                currentSort={currentSort}
                onUpdateCard={(updates) => handleUpdateCard(card.id, updates)}
                onDeleteCard={handleDeleteCard}
                onDuplicateCard={handleDuplicateCard}
                onMoveOrder={(dir) => handleMoveCardOrder(card.id, dir)}
                onDropOrder={handleDropCardOrder}
                isFirst={index === 0}
                isLast={index === filteredAndSortedCards.length - 1}
                onNotifyUndo={(msg, action) => {
                  setUndoToast({ message: msg, action })
                  setTimeout(() => setUndoToast(null), 6000)
                }}
                onOpenNodeDrawer={(node) => setDrawerTarget({ projectId: card.id, nodeId: node.id })}
              />
            ))}
          </div>
        )}
      </main>

      {/* Undo Toast Notification */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-900 text-white rounded-xl shadow-2xl text-xs border border-slate-800 animate-slide-up">
          <span>{undoToast.message}</span>
          <button
            onClick={() => {
              undoToast.action()
              setUndoToast(null)
            }}
            className="flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300 ml-2"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>撤销</span>
          </button>
          <button
            onClick={() => setUndoToast(null)}
            className="text-slate-500 hover:text-slate-300 ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Disaster Recovery Mode Dialog (P0-02) */}
      {isRecoveryMode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl p-6 shadow-2xl max-w-md w-full space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>数据异常保护（安全恢复模式）</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              检测到当前主任务数据文件损坏且无可用历史快照自动恢复。为防止覆盖受损文件，已自动挂起自动保存并进入只读安全模式。请选择：
            </p>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setShowSettings(true)}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                导入外部备份 JSON 或从历史备份恢复
              </button>
              <button
                onClick={handleInitializeClean}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                确认全新初始化（新建空白数据）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          settings={data.settings}
          onUpdateSettings={(updates) =>
            setData((prev) => ({
              ...prev,
              settings: { ...prev.settings, ...updates }
            }))
          }
          onClose={() => setShowSettings(false)}
          onExportData={async () => {
            if (window.electronAPI) {
              const json = await window.electronAPI.storage.exportData()
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `ai-task-board-backup-${new Date().toISOString().split('T')[0]}.json`
              a.click()
              URL.revokeObjectURL(url)
            }
          }}
          onImportData={async (json) => {
            if (window.electronAPI) {
              const imported = await window.electronAPI.storage.importData(json)
              isRemoteUpdate.current = true
              setData(imported)
              setIsRecoveryMode(false)
              setIsLoaded(true)
              return true
            }
            return false
          }}
          onRestoreBackup={async (backupName) => {
            if (window.electronAPI) {
              const restored = await window.electronAPI.storage.restoreBackup(backupName)
              isRemoteUpdate.current = true
              setData(restored)
              setIsRecoveryMode(false)
              setIsLoaded(true)
              return true
            }
            return false
          }}
        />
      )}

      {/* Task Node Execution & Review Drawer (PRD Section 4.2 & 6) */}
      {(() => {
        if (!drawerTarget) return null
        const activeProject = data.cards.find((c) => c.id === drawerTarget.projectId)
        if (!activeProject) return null

        function findNodeInTree(list: TaskNode[], id: string): TaskNode | null {
          for (const item of list) {
            if (item.id === id) return item
            if (item.children && item.children.length > 0) {
              const found = findNodeInTree(item.children, id)
              if (found) return found
            }
          }
          return null
        }

        const activeNode = findNodeInTree(activeProject.tasks as TaskNode[], drawerTarget.nodeId)
        if (!activeNode) return null

        return (
          <TaskNodeDrawer
            project={activeProject}
            node={activeNode}
            isOpen={true}
            onClose={() => setDrawerTarget(null)}
            onUpdateNode={(updated) => handleUpdateTaskNode(activeProject.id, updated)}
            onDeleteNode={(nodeId) => handleDeleteTaskNode(activeProject.id, nodeId)}
          />
        )
      })()}
    </div>
  )
}

