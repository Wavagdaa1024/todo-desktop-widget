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

function calculateWidgetPosition(): { x: number; y: number } {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { x: waX, y: waY, width: waW, height: waH } = primaryDisplay.workArea
  const widgetWidth = 360
  const widgetHeight = 490
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

  // Close to tray logic or exit (P1-05)
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
      isQuitting = true
      await storageService.flush()
      app.quit()
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

function createWidgetWindow(): void {
  const { x, y } = calculateWidgetPosition()
  const widgetWidth = 360
  const widgetHeight = 490

  widgetWindow = new BrowserWindow({
    width: widgetWidth,
    height: widgetHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
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
    if (!isWidgetPinned && widgetWindow?.isVisible()) {
      widgetWindow.hide()
    }
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
    const { x, y } = calculateWidgetPosition()
    widgetWindow.setPosition(x, y)
    widgetWindow.show()
    widgetWindow.focus()
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
        isQuitting = true
        await storageService.flush()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Single click tray opens/hides floating widget (Figure 1 specification)
  tray.on('click', () => {
    toggleWidgetWindow()
  })
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

function broadcastDataUpdated(data: AppData): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('data-updated', data)
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send('data-updated', data)
  }
}

// AI Timeout Monitor
const notifiedRounds = new Set<string>()

function checkAiTimeouts(): void {
  if (!currentSettings || currentSettings.aiWaitReminderThreshold <= 0) return

  const initial = storageService.getInitialData()
  const thresholdMs = currentSettings.aiWaitReminderThreshold * 60 * 1000
  const now = Date.now()

  for (const card of initial.data.cards) {
    if (card.status === 'AI_RUNNING' && card.aiWork.activeStartTime) {
      const startTime = new Date(card.aiWork.activeStartTime).getTime()
      const elapsedMs = now - startTime
      const roundKey = `${card.id}_${card.aiWork.activeStartTime}`

      if (elapsedMs >= thresholdMs && !notifiedRounds.has(roundKey)) {
        notifiedRounds.add(roundKey)
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

ipcMain.handle('storage:saveData', async (_, data: AppData) => {
  currentSettings = data.settings
  const success = await storageService.saveData(data)
  if (success) {
    broadcastDataUpdated(data)
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

ipcMain.on('window:openMainBoard', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
  }
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
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
