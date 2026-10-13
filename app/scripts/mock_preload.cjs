const { contextBridge } = require('electron')

const userProject = {
  id: 'proj_user_overlap_fix',
  title: '并行与分支任务线测试',
  order: 0,
  collapsed: false,
  tasklineHistoryCollapsed: true,
  tasks: [
    {
      id: 'h1',
      title: 'DADA 前置研究',
      completed: true,
      status: 'ACCEPTED',
      owner: 'CODEX',
      completedAt: '2026-10-13T09:00:00Z',
      order: 0,
      children: []
    },
    {
      id: 'h2',
      title: 'DADA 架构设计',
      completed: true,
      status: 'ACCEPTED',
      owner: 'GEMINI',
      parents: ['h1'],
      completedAt: '2026-10-13T10:00:00Z',
      order: 1,
      children: []
    },
    {
      id: 'h3',
      title: 'DADA 模块验证',
      completed: true,
      status: 'ACCEPTED',
      owner: 'CODEX',
      parents: ['h2'],
      completedAt: '2026-10-13T11:00:00Z',
      order: 2,
      children: []
    },
    {
      id: 't_root',
      title: '你好',
      completed: false,
      status: 'TODO',
      owner: 'SELF',
      parents: [],
      order: 3,
      children: [],
      notes: '暂无说明，点击查看或添加执行记录'
    },
    {
      id: 't_dads',
      title: 'DADS',
      completed: false,
      status: 'TODO',
      owner: 'GEMINI',
      parents: ['h2'], // branched from DADA
      order: 4,
      children: [],
      notes: '由「DADA」创建并行任务'
    },
    {
      id: 't_11',
      title: '11',
      completed: false,
      status: 'TODO',
      owner: 'GEMINI',
      parents: ['t_root', 't_dads'], // merged from 你好 and DADS
      order: 5,
      children: [],
      notes: '汇合依赖「你好」及另一分支'
    }
  ]
}

const mockData = {
  schemaVersion: 2,
  cards: [userProject],
  projects: [userProject],
  settings: {
    theme: 'light',
    soundEnabled: true,
    autoStartBreaks: false,
    dailyGoalPomodoros: 8,
    notifications: true,
    widgetOpacity: 0.9,
    widgetAlwaysOnTop: true,
    launchOnStartup: false,
    minimizeToTray: true,
    agentApiKey: ''
  },
  lastModified: new Date().toISOString(),
  revision: 1
}

contextBridge.exposeInMainWorld('electronAPI', {
  storage: {
    getInitialData: async () => ({ data: mockData }),
    saveData: async () => true,
    onDataUpdated: () => () => {},
    exportData: async () => JSON.stringify(mockData),
    importData: async () => mockData,
    restoreBackup: async () => mockData
  },
  system: {
    onRequestFlush: () => () => {},
    onQuickAction: () => () => {}
  },
  window: {
    onNavigateToNode: () => () => {},
    openMainWindow: async () => true,
    hideWidget: async () => true,
    togglePin: async () => true,
    setWindowHeight: async () => true
  }
})
