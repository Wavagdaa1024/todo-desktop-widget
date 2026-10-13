const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const artifactDir = 'C:\\Users\\wt\\.gemini\\antigravity\\brain\\f65a0339-28b4-47de-bd57-9887d7ecc76d'

// Exact user data structure from user's screenshots
const userProject = {
  id: 'card_user_1',
  title: '新任务卡片 1',
  category: '默认分类',
  description: '用户实际正在操作的任务线',
  status: 'TODO',
  owner: 'SELF',
  order: 0,
  collapsed: false,
  tasklineHistoryCollapsed: false,
  tasks: [
    {
      id: 't_hello',
      title: '你好',
      status: 'TODO',
      owner: 'SELF',
      order: 0,
      children: [],
      rounds: [],
      events: [],
      completed: false,
      createdAt: '2026-10-13T10:00:00Z',
      updatedAt: '2026-10-13T10:00:00Z'
    },
    {
      id: 't_g1',
      title: '11',
      status: 'TODO',
      owner: 'GEMINI',
      order: 1,
      parents: ['t_hello'],
      children: [],
      rounds: [],
      events: [{ id: 'e1', roundId: 'r1', timestamp: '2026-10-13T10:05:00Z', source: 'SELF', type: 'ASSIGNED', summary: '汇合依赖「你好」及另一...' }],
      completed: false,
      createdAt: '2026-10-13T10:05:00Z',
      updatedAt: '2026-10-13T10:05:00Z'
    },
    {
      id: 't_g2_done',
      title: '11',
      status: 'ACCEPTED',
      owner: 'GEMINI',
      order: 2,
      parents: ['t_g1'],
      children: [],
      rounds: [],
      events: [{ id: 'e2', roundId: 'r2', timestamp: '2026-10-13T10:10:00Z', source: 'SELF', type: 'ACCEPTED', summary: '直接确认完成' }],
      completed: true,
      completedAt: '2026-10-13T10:10:00Z',
      createdAt: '2026-10-13T10:08:00Z',
      updatedAt: '2026-10-13T10:10:00Z'
    },
    {
      id: 't_c1',
      title: '11',
      status: 'TODO',
      owner: 'CODEX',
      order: 3,
      parents: ['t_g1'],
      children: [],
      rounds: [],
      events: [{ id: 'e3', roundId: 'r3', timestamp: '2026-10-13T10:12:00Z', source: 'SELF', type: 'ASSIGNED', summary: '由「11」创建并行任务' }],
      completed: false,
      createdAt: '2026-10-13T10:12:00Z',
      updatedAt: '2026-10-13T10:12:00Z'
    },
    {
      id: 't_c2_parent',
      title: '11',
      status: 'TODO',
      owner: 'CODEX',
      order: 4,
      parents: ['t_c1'],
      children: [
        {
          id: 't_self_sub',
          title: '11',
          status: 'TODO',
          owner: 'SELF',
          order: 0,
          parentId: 't_c2_parent',
          parents: ['t_c2_parent'],
          children: [],
          rounds: [],
          events: [],
          completed: false,
          createdAt: '2026-10-13T10:15:00Z',
          updatedAt: '2026-10-13T10:15:00Z'
        }
      ],
      rounds: [],
      events: [{ id: 'e4', roundId: 'r4', timestamp: '2026-10-13T10:15:00Z', source: 'SELF', type: 'ASSIGNED', summary: '汇合依赖「11」及另一分...' }],
      completed: false,
      createdAt: '2026-10-13T10:15:00Z',
      updatedAt: '2026-10-13T10:15:00Z'
    },
    {
      id: 't_detail',
      title: '详情',
      status: 'TODO',
      owner: 'SELF',
      order: 5,
      parents: ['t_c2_parent'],
      children: [],
      rounds: [],
      events: [],
      completed: false,
      createdAt: '2026-10-13T10:20:00Z',
      updatedAt: '2026-10-13T10:20:00Z'
    }
  ],
  aiWork: {
    history: []
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const activeScenarioData = {
  schemaVersion: 1,
  cards: [userProject],
  settings: {
    theme: 'light',
    closeToTray: false,
    autoStart: false,
    alwaysOnTop: false,
    aiWaitReminderThreshold: 30,
    hasSeenTrayNotice: true
  },
  lastModified: new Date().toISOString(),
  revision: 1
}

ipcMain.handle('storage:getInitialData', async () => {
  console.log('[Main IPC] storage:getInitialData requested!')
  return {
    data: activeScenarioData,
    recoveryRequired: false,
    recoveredFromBackup: false
  }
})
ipcMain.handle('storage:saveData', async () => true)
ipcMain.handle('system:copyText', async () => {})
ipcMain.on('window:setWidgetHeight', () => {})

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

app.whenReady().then(async () => {
  const preloadPath = path.join(__dirname, '../out/preload/index.mjs')
  const htmlPath = path.join(__dirname, '../out/renderer/index.html')

  let win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true,
    frame: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.webContents.on('console-message', (e, level, msg) => {
    console.log('[Renderer]', msg)
  })

  await win.loadFile(htmlPath)
  await sleep(2000)

  // 1. Capture Taskline Canvas with aligned hierarchy
  console.log('Capturing screenshot_hierarchy_aligned_canvas.png...')
  let image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(artifactDir, 'screenshot_hierarchy_aligned_canvas.png'), image.toPNG())

  // 2. Click parent task node '11 (Codex)' to open the 350px Inspector Drawer
  console.log('Clicking parent task node to open drawer...')
  await win.webContents.executeJavaScript(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div[class*="rounded-2xl"]'));
      // Find parent card (has text '父任务')
      const parentCard = cards.find(c => c.textContent.includes('父任务'));
      if (parentCard) {
        parentCard.click();
      }
    })()
  `)
  await sleep(800)

  console.log('Capturing screenshot_hierarchy_parent_drawer.png...')
  image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(artifactDir, 'screenshot_hierarchy_parent_drawer.png'), image.toPNG())

  // 3. Click subtask node '11 (自己)' to inspect subtask drawer with parent banner
  console.log('Clicking subtask card to inspect subtask drawer...')
  await win.webContents.executeJavaScript(`
    (() => {
      const cards = Array.from(document.querySelectorAll('div[class*="rounded-2xl"]'));
      // Find subtask card (has text '子任务 · 隶属')
      const subtaskCard = cards.find(c => c.textContent.includes('子任务 · 隶属'));
      if (subtaskCard) {
        subtaskCard.click();
      }
    })()
  `)
  await sleep(800)

  console.log('Capturing screenshot_hierarchy_subtask_drawer.png...')
  image = await win.webContents.capturePage()
  fs.writeFileSync(path.join(artifactDir, 'screenshot_hierarchy_subtask_drawer.png'), image.toPNG())

  win.close()
  console.log('Done capturing hierarchy screenshots!')
  app.quit()
})
