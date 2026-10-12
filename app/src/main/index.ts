import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, clipboard } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { StorageService } from './storage'
import { AppData, AppSettings } from '../renderer/src/domain/types'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let storageService: StorageService
let currentSettings: AppSettings

// Enforce single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

function getIconPath(): string {
  return join(__dirname, '../../resources/icon.png')
}

import { existsSync } from 'fs'

function getPreloadPath(): string {
  const mjsPath = join(__dirname, '../preload/index.mjs')
  if (existsSync(mjsPath)) return mjsPath
  return join(__dirname, '../preload/index.js')
}

function createWindow(): void {
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

  mainWindow.on('ready-to-show', () => {
    if (mainWindow && !process.argv.includes('--hidden')) {
      mainWindow.show()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Only open safe external URLs
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
        showNotification('AI Task Board 已在托盘运行', '点击托盘图标可重新打开，右键托盘图标可退出程序。')
      }
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  const iconPath = getIconPath()
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  tray.setToolTip('AI Task Board — 桌面任务工作台')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开工作台',
      click: (): void => {
        if (mainWindow) {
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

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
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

  // Set Windows App User Model ID
  app.setAppUserModelId('com.aitaskboard.desktop')

  createWindow()
  createTray()

  // Start periodic monitor (every 1 minute)
  setInterval(checkAiTimeouts, 60000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
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
