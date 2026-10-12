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
    toggleWidgetWindow()
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

  if (currentSettings.alwaysOnTop) {
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

  // Close to tray logic
  mainWindow.on('close', (event) => {
    if (!isQuitting && currentSettings.closeToTray) {
      event.preventDefault()
      mainWindow?.hide()

      if (!currentSettings.hasSeenTrayNotice) {
        currentSettings.hasSeenTrayNotice = true
        showNotification('AI Task Board 已在托盘运行', '点击托盘图标可弹出悬浮小面板，右键托盘图标可打开完整工作台或退出。')
      }
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createWidgetWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  const widgetWidth = 360
  const widgetHeight = 490
  const x = Math.round(width - widgetWidth - 16)
  const y = Math.round(height - widgetHeight - 16)

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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    widgetWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#widget`)
  } else {
    widgetWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'widget' })
  }
}

function toggleWidgetWindow(): void {
  if (!widgetWindow) return
  if (widgetWindow.isVisible()) {
    widgetWindow.hide()
  } else {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    const widgetWidth = 360
    const widgetHeight = 490
    const x = Math.round(width - widgetWidth - 16)
    const y = Math.round(height - widgetHeight - 16)
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
      click: (): void => {
        isQuitting = true
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

  // By default, pop up the widget window at startup so user immediately sees the Figure 1 widget!
  setTimeout(() => {
    toggleWidgetWindow()
  }, 500)

  // Periodic AI timeout monitor
  setInterval(checkAiTimeouts, 60000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      createWidgetWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
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
  return storageService.saveData(data)
})

ipcMain.handle('storage:exportData', async () => {
  return storageService.exportData()
})

ipcMain.handle('storage:importData', async (_, jsonContent: string) => {
  const result = storageService.importData(jsonContent)
  currentSettings = result.settings
  return result
})

ipcMain.handle('storage:getBackups', async () => {
  return storageService.getBackupFiles()
})

ipcMain.handle('storage:restoreBackup', async (_, backupName: string) => {
  const result = storageService.restoreFromBackup(backupName)
  currentSettings = result.settings
  return result
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
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
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
