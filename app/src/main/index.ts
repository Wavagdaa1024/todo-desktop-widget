import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, clipboard, screen } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { StorageService } from './storage'
import { AppData, AppSettings } from '../renderer/src/domain/types'

let mainWindow: BrowserWindow | null = null
let widgetWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let isWidgetPinned = false
let storageService: StorageService
let currentSettings: AppSettings

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Reveal and focus existing window; never unexpectedly hide on second launch
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    } else {
      if (!widgetWindow || widgetWindow.isDestroyed()) {
        createWidgetWindow()
      }
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        if (!widgetWindow.isVisible()) widgetWindow.show()
        widgetWindow.focus()
      }
    }
  })
}

function getIconPath(): string {
  return join(__dirname, '../../resources/icon.png')
}

function getPreloadPath(): string {
  const mjsPath = join(__dirname, '../preload/index.mjs')
  if (existsSync(mjsPath)) return mjsPath
  return join(__dirname, '../preload/index.js')
}

function calculateWidgetPosition(height = 420): { x: number; y: number } {
  const point = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(point) || screen.getPrimaryDisplay()
  const { x: waX, y: waY, width: waW, height: waH } = display.workArea
  const widgetWidth = 350
  const widgetHeight = height
  const x = Math.round(waX + waW - widgetWidth - 16)
  const y = Math.round(waY + waH - widgetHeight - 16)
  return { x, y }
}

function createMainWindow(): void {
  const iconPath = getIconPath()

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (currentSettings?.alwaysOnTop) {
    mainWindow.setAlwaysOnTop(true)
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      // Invalid URL
    }
    return { action: 'deny' }
  })

  // Close to tray logic or exit (P1-05 & P0-01)
  mainWindow.on('close', async (event) => {
    if (isQuitting) return

    if (currentSettings && currentSettings.closeToTray) {
      event.preventDefault()
      mainWindow?.hide()

      if (!currentSettings.hasSeenTrayNotice) {
        currentSettings.hasSeenTrayNotice = true
        showNotification('AI Task Board 已在托盘运行', '点击托盘图标可弹出悬浮小面板，右键托盘图标可打开完整工作台或退出。')
      }
    } else {
      // User chose to quit app on window close
      event.preventDefault()
      await prepareAndQuit()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let blurHideTimer: NodeJS.Timeout | null = null

function createWidgetWindow(height = 420): void {
  const { x, y } = calculateWidgetPosition(height)
  const widgetWidth = 350
  const widgetHeight = height

  widgetWindow = new BrowserWindow({
    width: widgetWidth,
    height: widgetHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    icon: getIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  widgetWindow.on('blur', () => {
    if (!isWidgetPinned && widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
      if (blurHideTimer) clearTimeout(blurHideTimer)
      blurHideTimer = setTimeout(() => {
        if (!isWidgetPinned && widgetWindow && !widgetWindow.isDestroyed() && !widgetWindow.isFocused()) {
          widgetWindow.hide()
        }
      }, 150)
    }
  })

  widgetWindow.on('focus', () => {
    if (blurHideTimer) {
      clearTimeout(blurHideTimer)
      blurHideTimer = null
    }
    widgetWindow?.webContents.send('widget:refresh')
  })

  widgetWindow.on('closed', () => {
    widgetWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    widgetWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#widget`)
  } else {
    widgetWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'widget' })
  }
}

function toggleWidgetWindow(): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    createWidgetWindow()
  }
  if (!widgetWindow) return

  if (widgetWindow.isVisible()) {
    widgetWindow.hide()
  } else {
    const [, currentH] = widgetWindow.getSize()
    const { x, y } = calculateWidgetPosition(currentH)
    widgetWindow.setPosition(x, y)
    widgetWindow.show()
    widgetWindow.focus()
    widgetWindow.webContents.send('widget:refresh')
  }
}


function createTray(): void {
  const iconPath = getIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  tray.setToolTip('AI Task Board — 桌面悬浮工作台')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '悬浮小面板 (Widget)',
      click: (): void => {
        toggleWidgetWindow()
      }
    },
    {
      label: '打开完整工作台',
      click: (): void => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          if (!mainWindow.isVisible()) mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: '快速新增任务卡片',
      click: (): void => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('quick-action', 'new-card')
        }
      }
    },
    {
      label: '查看待我验收',
      click: (): void => {
        if (mainWindow) {
          if (!mainWindow.isVisible()) mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send('quick-action', 'filter-waiting-accept')
        }
      }
    },
    { type: 'separator' },
    {
      label: '真正退出',
      click: async (): Promise<void> => {
        await prepareAndQuit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Single click tray opens/hides floating widget (Figure 1 specification)
  tray.on('click', () => {
    toggleWidgetWindow()
  })
}

async function prepareAndQuit(): Promise<void> {
  if (isQuitting) return
  isQuitting = true

  // P0-01: Request renderer to flush any pending debounced save and await confirmation
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    try {
      const correlationId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const ackPromise = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          ipcMain.removeAllListeners(`system:flush-response:${correlationId}`)
          resolve(false)
        }, 1500)
        ipcMain.once(`system:flush-response:${correlationId}`, (_, success: boolean) => {
          clearTimeout(timer)
          resolve(success)
        })
      })
      mainWindow.webContents.send('system:request-flush', correlationId)
      await ackPromise
    } catch (err) {
      console.warn('Failed to request renderer flush:', err)
    }
  }

  // P0-03: Ensure all in-flight and queued writes settle to disk
  try {
    await storageService.flush()
  } catch (err) {
    console.error('Error during storage flush on exit:', err)
  }

  app.quit()
}

function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      icon: getIconPath()
    }).show()
  }
}

// P0-02: Broadcast to other windows, filtering out sender window to prevent echo overwriting
function broadcastDataUpdated(data: AppData, senderWebContentsId?: number): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!senderWebContentsId || mainWindow.webContents.id !== senderWebContentsId) {
      mainWindow.webContents.send('data-updated', data)
    }
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    if (!senderWebContentsId || widgetWindow.webContents.id !== senderWebContentsId) {
      widgetWindow.webContents.send('data-updated', data)
    }
  }
}

// AI Timeout Monitor (P1-04: Persisted notification rounds)
function checkAiTimeouts(): void {
  if (!currentSettings || currentSettings.aiWaitReminderThreshold <= 0) return

  const initial = storageService.getInitialData()
  const thresholdMs = currentSettings.aiWaitReminderThreshold * 60 * 1000
  const now = Date.now()
  const notifiedRounds = storageService.getNotifiedRounds()

  const cardList = initial.data.projects || initial.data.cards || []
  for (const card of cardList) {
    if (card.status === 'AI_RUNNING' && card.aiWork?.activeStartTime) {
      const startTime = new Date(card.aiWork.activeStartTime).getTime()
      const elapsedMs = now - startTime
      const roundKey = `${card.id}_${card.aiWork.activeStartTime}`

      if (elapsedMs >= thresholdMs && !notifiedRounds.has(roundKey)) {
        storageService.markRoundNotified(roundKey)
        const minutes = Math.floor(elapsedMs / 60000)
        showNotification(
          `任务等待提醒：${card.title}`,
          `该任务已等待 ${minutes} 分钟，建议检查 AI 进展。`
        )
      }
    }
  }
}

app.whenReady().then(() => {
  storageService = new StorageService()
  const initial = storageService.getInitialData()
  currentSettings = initial.data.settings

  app.setAppUserModelId('com.aitaskboard.desktop')

  createMainWindow()
  createWidgetWindow()
  createTray()

  // Respect silent autostart (P2-04)
  const isSilentStart = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden
  if (!isSilentStart) {
    setTimeout(() => {
      toggleWidgetWindow()
    }, 500)
  }

  // Periodic AI timeout monitor
  setInterval(checkAiTimeouts, 60000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      createWidgetWindow()
    }
  })
})

app.on('before-quit', async (event) => {
  if (!isQuitting) {
    isQuitting = true
    event.preventDefault()
    await storageService.flush()
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && (!currentSettings || !currentSettings.closeToTray)) {
    app.quit()
  }
})

// IPC Handlers
ipcMain.handle('storage:getInitialData', async () => {
  return storageService.getInitialData()
})

ipcMain.handle('storage:saveData', async (event, data: AppData) => {
  currentSettings = data.settings
  const success = await storageService.saveData(data)
  if (success) {
    // P0-02: Broadcast to other windows, but never echo back to the sender window!
    broadcastDataUpdated(data, event.sender.id)
  }
  return success
})

ipcMain.handle('storage:exportData', async () => {
  return storageService.exportData()
})

ipcMain.handle('storage:importData', async (_, jsonContent: string) => {
  const result = await storageService.importData(jsonContent)
  currentSettings = result.settings
  broadcastDataUpdated(result)
  return result
})

ipcMain.handle('storage:getBackups', async () => {
  return storageService.getBackupFiles()
})

ipcMain.handle('storage:restoreBackup', async (_, backupName: string) => {
  const result = await storageService.restoreFromBackup(backupName)
  currentSettings = result.settings
  broadcastDataUpdated(result)
  return result
})

ipcMain.handle('storage:initializeClean', async () => {
  const cleanData = await storageService.initializeCleanAfterCorruption()
  currentSettings = cleanData.settings
  broadcastDataUpdated(cleanData)
  return cleanData
})

ipcMain.handle('storage:flush', async () => {
  return storageService.flush()
})

ipcMain.handle('storage:getDataFilePath', async () => {
  return storageService.getDataFilePath()
})

// Window control IPC
ipcMain.on('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('window:close', () => {
  mainWindow?.close()
})

ipcMain.on('window:setAlwaysOnTop', (_, alwaysOnTop: boolean) => {
  mainWindow?.setAlwaysOnTop(alwaysOnTop)
})

ipcMain.on('window:openMainBoard', (_, target?: { projectId?: string; nodeId?: string }) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
    if (target && (target.projectId || target.nodeId)) {
      mainWindow.webContents.send('navigate-to-node', target)
    }
  }

  // Dual window requirement: unpinned widget hides when opening main board
  if (!isWidgetPinned && widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
    widgetWindow.hide()
  }
})

ipcMain.on('window:closeWidget', () => {
  widgetWindow?.hide()
})

ipcMain.on('window:setWidgetPin', (_, pinned: boolean) => {
  isWidgetPinned = pinned
  widgetWindow?.setAlwaysOnTop(pinned)
})

ipcMain.on('window:setWidgetHeight', (_, height: number) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    const clampedHeight = Math.max(180, Math.min(height, 520))
    const [currX, currY] = widgetWindow.getPosition()
    const [, currH] = widgetWindow.getSize()
    const newY = currY + (currH - clampedHeight)
    widgetWindow.setSize(350, clampedHeight)
    widgetWindow.setPosition(currX, newY)
  }
})


// System control IPC
ipcMain.handle('system:setAutoStart', async (_, enable: boolean) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: true
  })
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.handle('system:getAutoStart', async () => {
  return app.getLoginItemSettings().openAtLogin
})

ipcMain.on('system:showNotification', (_, { title, body }: { title: string; body: string }) => {
  showNotification(title, body)
})

ipcMain.on('system:openUserDataFolder', () => {
  shell.openPath(storageService.getUserDataPath())
})

ipcMain.handle('system:copyText', async (_, text: string) => {
  clipboard.writeText(text)
})

let hasFlushedBeforeQuit = false
app.on('before-quit', async (event) => {
  if (!hasFlushedBeforeQuit && !isQuitting) {
    event.preventDefault()
    hasFlushedBeforeQuit = true
    await prepareAndQuit()
  }
})
