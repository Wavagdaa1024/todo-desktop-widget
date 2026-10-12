const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const outDir = path.join(__dirname, '../docs/screenshots')
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const sampleTasksCard1 = [
  {
    id: 't1',
    title: '动力学物理引擎接口设计',
    completed: true,
    order: 0,
    children: [
      { id: 't1_1', title: 'MuJoCo mjModel 几何绑定', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' },
      { id: 't1_2', title: '广义坐标 qpos/qvel 同步映射', completed: true, order: 1, children: [], createdAt: '', updatedAt: '' }
    ],
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 't2',
    title: 'FMI 2.0 Co-Simulation 时间步长桥接',
    completed: true,
    order: 1,
    children: [
      { id: 't2_1', title: 'doStep 积分器单步推进', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' },
      { id: 't2_2', title: '连续碰撞检测中断回调', completed: false, order: 1, children: [], createdAt: '', updatedAt: '' }
    ],
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 't3',
    title: '闭环动力学收敛性基准测试',
    completed: false,
    order: 2,
    children: [],
    createdAt: '',
    updatedAt: ''
  }
]

const card1 = {
  id: 'card_mujoco',
  title: 'FMU + MuJoCo 动力学联合仿真',
  category: '动力学仿真',
  description: '工业机器人刚柔耦合动力学与控制系统联合仿真测试项目',
  status: 'AI_RUNNING',
  owner: 'GEMINI',
  dueDate: '2026-10-25',
  order: 0,
  collapsed: false,
  tasks: sampleTasksCard1,
  aiWork: {
    activeStartTime: new Date(Date.now() - 42 * 60000).toISOString(),
    currentTaskDescription: '让 Gemini 修复 fmu_bridge.py 时间步长同步机制',
    recentProgress: '完成了 C 结构体与 Python ctypes 的内存对齐验证',
    currentBlockers: 'MuJoCo 接触力雅可比矩阵偶发非正定',
    nextAction: '运行 test_step.py 验证动力学闭环收敛',
    history: [
      {
        id: 'log_1',
        timestamp: new Date(Date.now() - 120 * 60000).toISOString(),
        source: 'GEMINI',
        summary: '完成 MuJoCo XML 刚体模型解析与 FMI 变量映射',
        changedFiles: 'src/fmu_bridge.py, src/model_parser.py',
        testResults: '单元测试 8/8 通过'
      },
      {
        id: 'log_2',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
        source: 'GEMINI',
        summary: '重构 doStep 积分调度，支持变步长插值',
        nextAction: '验证连续碰撞中断处理'
      }
    ]
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const card2 = {
  id: 'card_vision',
  title: '双目视觉位姿估计算法适配',
  category: '感知算法',
  description: '立体视觉与点云特征提取深度学习网络适配',
  status: 'WAITING_ACCEPT',
  owner: 'CODEX',
  dueDate: '2026-10-18',
  order: 1,
  collapsed: true,
  tasks: [
    { id: 'v1', title: '相机内参标定畸变矫正', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' },
    { id: 'v2', title: 'YOLOv8 点云目标检测推理', completed: true, order: 1, children: [], createdAt: '', updatedAt: '' },
    { id: 'v3', title: 'ICP 点云配准位姿输出', completed: true, order: 2, children: [], createdAt: '', updatedAt: '' }
  ],
  aiWork: {
    currentTaskDescription: 'Codex 已完成算法交付，等待用户在真机上验证精度',
    recentProgress: '位姿输出重投影误差小于 0.8mm',
    nextAction: '人工连机实物相机抓取测试',
    history: []
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const card3 = {
  id: 'card_can',
  title: 'CANopen 驱动器通信协议栈',
  category: '底层驱动',
  description: '伺服电机底层总线驱动与同步周期性通信',
  status: 'BLOCKED',
  owner: 'SELF',
  dueDate: '2026-10-14',
  order: 2,
  collapsed: true,
  tasks: [
    { id: 'c1', title: 'PDO 映射参数字典配置', completed: true, order: 0, children: [], createdAt: '', updatedAt: '' },
    { id: 'c2', title: 'SYNC 同步报文中断定时器', completed: false, order: 1, children: [], createdAt: '', updatedAt: '' }
  ],
  aiWork: {
    currentTaskDescription: '排查 Windows USB-CAN 驱动在 1ms 周期下的抖动',
    currentBlockers: '硬件适配器驱动在 Windows 11 下偶尔丢失 SYNC 帧',
    nextAction: '更换为 PCI-e CAN 卡或升级固件驱动',
    history: []
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

let activeScenarioData = {
  schemaVersion: 1,
  cards: [card1, card2, card3],
  settings: {
    theme: 'light',
    closeToTray: true,
    autoStart: false,
    alwaysOnTop: false,
    aiWaitReminderThreshold: 30,
    hasSeenTrayNotice: true
  },
  lastModified: new Date().toISOString(),
  revision: 1
}

// Intercept IPC for deterministic scenario captures
ipcMain.handle('storage:getInitialData', async () => {
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

  // --- Scenario 1: Main Window with 1 Card (natural left-alignment, no wide stretch) ---
  console.log('Capturing 01-main-single-card.png...')
  activeScenarioData = {
    ...activeScenarioData,
    cards: [{ ...card1, collapsed: true }]
  }

  let win = new BrowserWindow({
    width: 1180,
    height: 760,
    show: false,
    frame: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true
    }
  })
  await win.loadFile(htmlPath)
  await sleep(1000)
  let img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '01-main-single-card.png'), img.toPNG())
  win.close()

  // --- Scenario 2: Main Window with 3 Cards (2 collapsed, 1 expanded) ---
  console.log('Capturing 02-main-three-cards.png...')
  activeScenarioData = {
    ...activeScenarioData,
    cards: [
      { ...card1, collapsed: false },
      { ...card2, collapsed: true },
      { ...card3, collapsed: true }
    ]
  }

  win = new BrowserWindow({
    width: 1180,
    height: 760,
    show: true,
    frame: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  await win.loadFile(htmlPath)
  await sleep(800)
  img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '02-main-three-cards.png'), img.toPNG())

  // --- Scenario 3: Main Window with Task Detail Modal open ---
  console.log('Capturing 03-main-detail-modal.png...')
  await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => (b.innerText || b.textContent || '').includes('详情与进展'));
      if (btn) {
        btn.click();
      }
    })()
  `)
  await sleep(800)
  img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '03-main-detail-modal.png'), img.toPNG())
  win.close()

  // --- Scenario 4: Floating Widget with 0 cards (compact empty state ~205px) ---
  console.log('Capturing 04-widget-empty.png...')
  activeScenarioData = {
    ...activeScenarioData,
    cards: []
  }

  let widgetWin = new BrowserWindow({
    width: 350,
    height: 205,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true
    }
  })
  await widgetWin.loadFile(htmlPath, { hash: 'widget' })
  await sleep(1000)
  img = await widgetWin.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '04-widget-empty.png'), img.toPNG())
  widgetWin.close()

  // --- Scenario 5: Floating Widget with 3 tasks (Hero + 2 secondary tasks) ---
  console.log('Capturing 05-widget-three-tasks.png...')
  activeScenarioData = {
    ...activeScenarioData,
    cards: [card1, card2, card3]
  }

  widgetWin = new BrowserWindow({
    width: 350,
    height: 420,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true
    }
  })
  await widgetWin.loadFile(htmlPath, { hash: 'widget' })
  await sleep(1000)
  img = await widgetWin.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '05-widget-three-tasks.png'), img.toPNG())
  widgetWin.close()

  // --- Scenario 6: Floating Widget transition to Main Window ---
  console.log('Capturing 06-widget-to-main.png...')
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    show: false,
    frame: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true
    }
  })
  await win.loadFile(htmlPath)
  await sleep(1000)
  img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(outDir, '06-widget-to-main.png'), img.toPNG())
  win.close()

  console.log('All 6 real screenshots successfully captured in docs/screenshots!')
  app.quit()
})
