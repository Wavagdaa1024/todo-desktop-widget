const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')

const artifactDir = 'C:/Users/wt/.gemini/antigravity/brain/f65a0339-28b4-47de-bd57-9887d7ecc76d'

// Exact tree from Image 1:
// 新任务卡片 1
// ├── 层级1
// │   ├── 层级1.1
// │   │   └── 层级1.1.1
// │   └── 层级1.2
// └── 层级2
const testProject = {
  id: 'card_user_exact',
  title: '新任务卡片 1',
  status: 'TODO',
  owner: 'SELF',
  order: 0,
  collapsed: false,
  tasklineHistoryCollapsed: false,
  tasks: [
    {
      id: 'task_c1',
      title: '层级1',
      status: 'TODO',
      owner: 'SELF',
      order: 0,
      parents: [],
      children: [
        {
          id: 'task_c1_1',
          title: '层级1.1',
          status: 'TODO',
          owner: 'SELF',
          order: 0,
          parentId: 'task_c1',
          parents: ['task_c1'],
          children: [
            {
              id: 'task_c1_1_1',
              title: '层级1.1.1',
              status: 'TODO',
              owner: 'SELF',
              order: 0,
              parentId: 'task_c1_1',
              parents: ['task_c1_1'],
              children: [],
              rounds: [],
              events: [],
              completed: false,
              createdAt: '2026-10-14T06:00:00Z',
              updatedAt: '2026-10-14T06:00:00Z'
            }
          ],
          rounds: [],
          events: [],
          completed: false,
          createdAt: '2026-10-14T06:00:00Z',
          updatedAt: '2026-10-14T06:00:00Z'
        },
        {
          id: 'task_c1_2',
          title: '层级1.2',
          status: 'TODO',
          owner: 'SELF',
          order: 1,
          parentId: 'task_c1',
          parents: ['task_c1'],
          children: [],
          rounds: [],
          events: [],
          completed: false,
          createdAt: '2026-10-14T06:00:00Z',
          updatedAt: '2026-10-14T06:00:00Z'
        }
      ],
      rounds: [],
      events: [],
      completed: false,
      createdAt: '2026-10-14T06:00:00Z',
      updatedAt: '2026-10-14T06:00:00Z'
    },
    {
      id: 'task_c2',
      title: '层级2',
      status: 'TODO',
      owner: 'SELF',
      order: 1,
      parents: [],
      children: [],
      rounds: [],
      events: [],
      completed: false,
      createdAt: '2026-10-14T06:00:00Z',
      updatedAt: '2026-10-14T06:00:00Z'
    }
  ]
}

const mockData = {
  schemaVersion: 2,
  cards: [testProject],
  projects: [testProject],
  settings: {
    theme: 'light',
    closeToTray: true,
    autoStart: false,
    alwaysOnTop: false,
    aiWaitReminderThreshold: 30,
    hasSeenTrayNotice: false
  },
  lastModified: new Date().toISOString(),
  revision: 1
}

// Write preload that provides this exact mockData
const preloadContent = `
const { contextBridge } = require('electron')

const mockData = ${JSON.stringify(mockData, null, 2)}

contextBridge.exposeInMainWorld('electronAPI', {
  storage: {
    getInitialData: async () => ({ data: mockData }),
    saveData: async () => true,
    onDataUpdated: () => () => {}
  },
  system: {
    onQuickAction: () => () => {},
    onRequestFlush: () => () => {}
  },
  window: {
    onNavigateToNode: () => () => {}
  }
})
`

const preloadPath = path.join(__dirname, 'temp_preload_exact_tree.cjs')
fs.writeFileSync(preloadPath, preloadContent)

async function run() {
  await app.whenReady()

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  })

  const indexPath = path.join(__dirname, '../out/renderer/index.html')
  await win.loadFile(indexPath)
  await new Promise((r) => setTimeout(r, 1500))

  // Inspect the rendered nodes on canvas
  const inspectResult = await win.webContents.executeJavaScript(`
    (() => {
      const cards = Array.from(document.querySelectorAll('[data-node-id]'));
      return cards.map(c => {
        const id = c.getAttribute('data-node-id');
        const title = c.querySelector('h3')?.textContent?.trim() || '';
        const rect = c.getBoundingClientRect();
        const hasParentBadge = !!c.querySelector('span:has(svg.lucide-layers)');
        const subtaskBadge = c.querySelector('div:has(svg.lucide-corner-down-right)')?.textContent?.trim() || '';
        return {
          id,
          title,
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          hasParentBadge,
          subtaskBadge
        };
      });
    })()
  `)

  console.log('RENDERED NODES IN ELECTRON:', JSON.stringify(inspectResult, null, 2))

  // Capture canvas screenshot
  const img = await win.webContents.capturePage()
  const outPath = path.join(artifactDir, 'screenshot_exact_tree_rendered.png')
  fs.writeFileSync(outPath, img.toPNG())
  console.log('Saved exact tree screenshot:', outPath)

  // Click on '层级1.1' to open inspector
  await win.webContents.executeJavaScript(`
    (() => {
      const card = document.querySelector('[data-node-id="task_c1_1"]');
      if (card) card.click();
    })()
  `)
  await new Promise((r) => setTimeout(r, 800))

  const imgInspector = await win.webContents.capturePage()
  const outPathInspector = path.join(artifactDir, 'screenshot_exact_tree_inspector.png')
  fs.writeFileSync(outPathInspector, imgInspector.toPNG())
  console.log('Saved inspector screenshot:', outPathInspector)

  // Cleanup
  if (fs.existsSync(preloadPath)) {
    fs.unlinkSync(preloadPath)
  }

  win.destroy()
  app.quit()
}

run().catch((err) => {
  console.error('Error running test:', err)
  app.quit()
})
