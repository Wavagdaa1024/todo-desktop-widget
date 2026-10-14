const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')

const artifactDir = 'C:\\Users\\wt\\.gemini\\antigravity\\brain\\f65a0339-28b4-47de-bd57-9887d7ecc76d'

// Realistic engineering taskline project: FMU + MuJoCo Co-simulation
const demoProject = {
  id: 'card_fmu_mujoco',
  title: 'FMU + MuJoCo 联合仿真流水线',
  category: '仿真工程',
  description: '个人多 Agent 研发任务线：MuJoCo 物理引擎与 FMU 控制接口对接',
  status: 'IN_PROGRESS',
  owner: 'SELF',
  order: 0,
  collapsed: false,
  tasklineHistoryCollapsed: false,
  tasks: [
    {
      id: 'task_01_prep',
      title: '编译生成 FMU 2.0 动力学模型',
      status: 'ACCEPTED',
      owner: 'SELF',
      order: 0,
      parents: [],
      children: [],
      rounds: [
        {
          id: 'round_01',
          roundNumber: 1,
          agent: 'SELF',
          startTime: '2026-10-14T08:00:00Z',
          endTime: '2026-10-14T08:30:00Z',
          status: 'ACCEPTED',
          summary: '成功导出并在本地环境通过加载自测'
        }
      ],
      events: [
        {
          id: 'evt_01_done',
          roundId: 'round_01',
          timestamp: '2026-10-14T08:30:00Z',
          source: 'SELF',
          type: 'ACCEPTED',
          summary: '导出 FMU 动力学模型，本地检验通过'
        }
      ],
      completed: true,
      completedAt: '2026-10-14T08:30:00Z',
      createdAt: '2026-10-14T08:00:00Z',
      updatedAt: '2026-10-14T08:30:00Z'
    },
    {
      id: 'task_02_sync',
      title: '修复 FMU 时间步长同步问题',
      status: 'IN_PROGRESS',
      owner: 'GEMINI',
      order: 1,
      parents: ['task_01_prep'],
      children: [],
      rounds: [
        {
          id: 'round_02',
          roundNumber: 1,
          agent: 'GEMINI',
          startTime: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
          status: 'IN_PROGRESS'
        }
      ],
      events: [
        {
          id: 'evt_02_assign',
          roundId: 'round_02',
          timestamp: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
          source: 'SELF',
          type: 'ASSIGNED',
          summary: '任务指派给 Gemini 进行离散步长与连续积分对齐'
        },
        {
          id: 'evt_02_init',
          roundId: 'round_02',
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          source: 'GEMINI',
          type: 'PROGRESS',
          summary: '已完成信号映射，正在检查仿真步长并对齐采样时钟。'
        }
      ],
      notes: '必须确保 FMU 输出步长为 0.001s，与 MuJoCo 动力学步长保持整数倍严格同步。',
      acceptanceCriteria: '两套求解器无时钟漂移，连续运行 10000 步误差 < 1e-4',
      completed: false,
      createdAt: '2026-10-14T08:30:00Z',
      updatedAt: '2026-10-14T08:45:00Z'
    },
    {
      id: 'task_03_mesh',
      title: 'MuJoCo 接触几何体导入与网格对齐',
      status: 'WAITING_REVIEW',
      owner: 'CODEX',
      order: 2,
      parents: ['task_01_prep'],
      children: [],
      rounds: [
        {
          id: 'round_03',
          roundNumber: 1,
          agent: 'CODEX',
          startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          status: 'WAITING_REVIEW',
          summary: '网格对齐完成，生成 XML 模型并自测碰撞无贯穿'
        }
      ],
      events: [
        {
          id: 'evt_03_submit',
          roundId: 'round_03',
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          source: 'CODEX',
          type: 'SUBMITTED',
          summary: '生成 robot_scene.xml，碰撞几何已修复，提交人工审核'
        }
      ],
      notes: '包含 STL 网格简化与凸包分解',
      acceptanceCriteria: '自碰撞检测无穿模，网格法线统一朝外',
      completed: false,
      createdAt: '2026-10-14T08:15:00Z',
      updatedAt: '2026-10-14T09:10:00Z'
    },
    {
      id: 'task_04_adrc',
      title: '联合阻尼参数校验与自抗扰闭环测试',
      status: 'TODO',
      owner: 'SELF',
      order: 3,
      parents: ['task_02_sync', 'task_03_mesh'],
      children: [],
      rounds: [],
      events: [],
      notes: '前置依赖步长同步与网格对齐完成后启动',
      completed: false,
      createdAt: '2026-10-14T08:45:00Z',
      updatedAt: '2026-10-14T08:45:00Z'
    }
  ],
  aiWork: {
    history: []
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}

const scenarioData = {
  schemaVersion: 2,
  projects: [demoProject],
  cards: [demoProject],
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
  return {
    data: scenarioData,
    recoveryRequired: false,
    recoveredFromBackup: false
  }
})
ipcMain.handle('storage:saveData', async () => true)
ipcMain.handle('system:copyText', async () => {})
ipcMain.on('window:setWidgetHeight', () => {})

async function waitFrames(win, ms = 500) {
  try {
    await Promise.race([
      win.webContents.executeJavaScript(`
        new Promise(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(resolve, ${ms});
            });
          });
        })
      `),
      new Promise((r) => setTimeout(r, ms + 200))
    ])
  } catch (e) {}
  await new Promise((r) => setTimeout(r, ms))
}

async function capture(win, filename) {
  await waitFrames(win, 400)
  const img = await win.webContents.capturePage()
  const buffer = img.toPNG()
  console.log(`Saved ${filename}: ${buffer.length} bytes (${img.getSize().width}x${img.getSize().height})`)
  fs.writeFileSync(path.join(artifactDir, filename), buffer)
}

app.whenReady().then(async () => {
  const preloadPath = path.join(__dirname, '../out/preload/index.mjs')
  const htmlPath = path.join(__dirname, '../out/renderer/index.html')

  let win = new BrowserWindow({
    width: 1360,
    height: 820,
    show: false,
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.webContents.on('console-message', (e, level, msg) => {
    console.log('[Renderer Console]', msg)
  })

  await win.loadFile(htmlPath)
  await new Promise((r) => setTimeout(r, 2000))

  // 1. Click Node 2 ('修复 FMU 时间步长同步问题') to open docked 360px inspector
  console.log('1. Selecting Node 2 (修复 FMU 时间步长同步问题)...')
  await win.webContents.executeJavaScript(`
    (() => {
      const syncCard = document.querySelector('[data-node-id="task_02_sync"]');
      if (syncCard) {
        syncCard.click();
      }
    })()
  `)
  await waitFrames(win, 600)

  // Capture Screenshot 1: Canvas + docked inspector without obscuring node
  console.log('Capturing screenshot_mubu_canvas_and_inspector.png...')
  await capture(win, 'screenshot_mubu_canvas_and_inspector.png')

  // 2. Type and save a quick progress update in Zone 4 input
  console.log('2. Entering quick progress log in input...')
  await win.webContents.executeJavaScript(`
    (() => {
      const textarea = document.querySelector('textarea[placeholder*="做到哪了"]');
      if (textarea) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        nativeSetter.call(textarea, '发现 FMU 与 MuJoCo 的采样步长不一致，已重设积分时钟并对齐采样边界。');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `)
  await new Promise((r) => setTimeout(r, 400))

  // Click [记录进展] to submit quick log
  console.log('Submitting quick progress update...')
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const recordBtn = buttons.find(b => b.textContent.includes('记录进展'));
      if (recordBtn) {
        recordBtn.click();
      }
    })()
  `)
  await waitFrames(win, 800)

  // Capture Screenshot 2: Saved quick progress update
  console.log('Capturing screenshot_mubu_saved_quick_progress.png...')
  await capture(win, 'screenshot_mubu_saved_quick_progress.png')

  // 3. Click [交给其他 AI →] to expand the inline handoff area
  console.log('3. Clicking [交给其他 AI →] button...')
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const handoffBtn = buttons.find(b => b.textContent.includes('交给其他 AI'));
      if (handoffBtn) {
        handoffBtn.click();
      }
    })()
  `)
  await waitFrames(win, 600)

  // Capture Screenshot 3: Expanded inline handoff area
  console.log('Capturing screenshot_mubu_agent_handoff_inline.png...')
  await capture(win, 'screenshot_mubu_agent_handoff_inline.png')

  // Close handoff before expanding history disclosure
  await win.webContents.executeJavaScript(`
    (() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('取消'));
      if (cancelBtn) cancelBtn.click();
    })()
  `)
  await new Promise((r) => setTimeout(r, 300))

  // 4. Click [▸ 历史记录] disclosure to expand chronological timeline
  console.log('4. Expanding History Disclosure...')
  await win.webContents.executeJavaScript(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const histBtn = buttons.find(b => b.textContent.includes('历史记录'));
      if (histBtn) {
        histBtn.click();
      }
    })()
  `)
  await waitFrames(win, 600)

  // Capture Screenshot 4: Expanded history disclosure
  console.log('Capturing screenshot_mubu_history_disclosure.png...')
  await capture(win, 'screenshot_mubu_history_disclosure.png')

  // 5. Click Node 3 ('MuJoCo 接触几何体导入与网格对齐') which is WAITING_REVIEW
  console.log('5. Selecting Node 3 (WAITING_REVIEW state)...')
  await win.webContents.executeJavaScript(`
    (() => {
      const meshCard = document.querySelector('[data-node-id="task_03_mesh"]');
      if (meshCard) {
        meshCard.click();
      }
    })()
  `)
  await waitFrames(win, 800)

  // Capture Screenshot 5: WAITING_REVIEW with [验收通过] and [退回修改]
  console.log('Capturing screenshot_mubu_waiting_review_state.png...')
  await capture(win, 'screenshot_mubu_waiting_review_state.png')

  win.close()
  console.log('All 5 Mubu-style screenshots captured successfully!')
  app.quit()
})
