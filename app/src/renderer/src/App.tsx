import React, { useState, useEffect, useMemo } from 'react'
import { Card, AppData, DEFAULT_SETTINGS } from './domain/types'
import { Header, FilterStatus, SortOption } from './components/Header'
import { TaskCard } from './components/TaskCard'
import { SettingsModal } from './components/SettingsModal'
import { isCardOverdue } from './domain/date'
import { Sparkles, Plus, Undo2 } from 'lucide-react'

export const App: React.FC = () => {
  const [data, setData] = useState<AppData>({
    schemaVersion: 1,
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
  const [undoToast, setUndoToast] = useState<{ message: string; action: () => void } | null>(null)

  // Load initial data on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.storage.getInitialData().then((res) => {
        setData(res.data)
        setIsLoaded(true)
        if (res.isCorrupted) {
          alert('提示：检测到原数据文件异常，已自动从最近一份安全备份中恢复，或初始化了安全存储。')
        }
      })
    } else {
      setIsLoaded(true)
    }
  }, [])

  // Auto-save debounced whenever cards or settings change
  useEffect(() => {
    if (!isLoaded) return

    setSaveStatus('saving')
    const timer = setTimeout(async () => {
      try {
        if (window.electronAPI) {
          const success = await window.electronAPI.storage.saveData(data)
          setSaveStatus(success ? 'saved' : 'error')
        } else {
          setSaveStatus('saved')
        }
      } catch (err) {
        console.error('Auto save error:', err)
        setSaveStatus('error')
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [data, isLoaded])

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

  // Card Operations
  const handleAddNewCard = () => {
    const newCard: Card = {
      id: 'card_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title: '新任务卡片 ' + (data.cards.length + 1),
      status: 'TODO',
      owner: 'SELF',
      order: data.cards.length,
      collapsed: false,
      tasks: [],
      aiWork: {
        history: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    setData((prev) => ({
      ...prev,
      cards: [newCard, ...prev.cards],
      lastModified: new Date().toISOString()
    }))
  }

  const handleUpdateCard = (cardId: string, updates: Partial<Card>) => {
    setData((prev) => ({
      ...prev,
      cards: prev.cards.map((c) =>
        c.id === cardId ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      ),
      lastModified: new Date().toISOString()
    }))
  }

  const handleDeleteCard = (cardId: string) => {
    const target = data.cards.find((c) => c.id === cardId)
    if (!target) return

    const previousCards = [...data.cards]
    setData((prev) => ({
      ...prev,
      cards: prev.cards.filter((c) => c.id !== cardId),
      lastModified: new Date().toISOString()
    }))

    // Provide undo toast
    setUndoToast({
      message: `已删除卡片「${target.title}」`,
      action: () => {
        setData((prev) => ({
          ...prev,
          cards: previousCards,
          lastModified: new Date().toISOString()
        }))
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
      order: data.cards.length,
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

    setData((prev) => ({
      ...prev,
      cards: [duplicated, ...prev.cards],
      lastModified: new Date().toISOString()
    }))
  }

  const handleMoveCardOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= data.cards.length) return

    const nextCards = [...data.cards]
    const [moved] = nextCards.splice(index, 1)
    nextCards.splice(targetIndex, 0, moved)
    nextCards.forEach((c, idx) => {
      c.order = idx
    })

    setData((prev) => ({
      ...prev,
      cards: nextCards,
      lastModified: new Date().toISOString()
    }))
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

    setData((prev) => ({
      ...prev,
      cards: [sampleCard, ...prev.cards],
      lastModified: new Date().toISOString()
    }))
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
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shadow-inner">
              <Plus className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                创建第一个任务卡片
              </h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                点击上方「+ 新增卡片」开始规划你的工作，或一键导入标准示例项目体验三层任务管理与 AI 协同工作流。
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleAddNewCard}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-md shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>新建卡片</span>
              </button>
              <button
                onClick={handleAddSampleProject}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs rounded-xl"
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>载入示例项目 (FMU + MuJoCo)</span>
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
                onUpdateCard={(updates) => handleUpdateCard(card.id, updates)}
                onDeleteCard={handleDeleteCard}
                onDuplicateCard={handleDuplicateCard}
                onMoveOrder={(dir) => handleMoveCardOrder(index, dir)}
                isFirst={index === 0}
                isLast={index === filteredAndSortedCards.length - 1}
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
          onImportData={(json) => {
            if (window.electronAPI) {
              window.electronAPI.storage.importData(json).then((imported) => {
                setData(imported)
              })
            }
          }}
          onRestoreBackup={(backupName) => {
            if (window.electronAPI) {
              window.electronAPI.storage.restoreBackup(backupName).then((restored) => {
                setData(restored)
                alert(`已成功恢复备份 ${backupName}！`)
              })
            }
          }}
        />
      )}
    </div>
  )
}
