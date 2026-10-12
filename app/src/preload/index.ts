import { contextBridge, ipcRenderer } from 'electron'
import { AppData } from '../renderer/src/domain/types'

export interface IElectronAPI {
  storage: {
    getInitialData: () => Promise<{ data: AppData; recoveredFromBackup?: boolean; isCorrupted?: boolean }>
    saveData: (data: AppData) => Promise<boolean>
    exportData: () => Promise<string>
    importData: (json: string) => Promise<AppData>
    getBackups: () => Promise<Array<{ name: string; path: string; time: string; size: number }>>
    restoreBackup: (name: string) => Promise<AppData>
    getDataFilePath: () => Promise<string>
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    setAlwaysOnTop: (alwaysOnTop: boolean) => void
  }
  system: {
    setAutoStart: (enable: boolean) => Promise<boolean>
    getAutoStart: () => Promise<boolean>
    showNotification: (title: string, body: string) => void
    openUserDataFolder: () => void
    copyText: (text: string) => Promise<void>
  }
}

const api: IElectronAPI = {
  storage: {
    getInitialData: () => ipcRenderer.invoke('storage:getInitialData'),
    saveData: (data: AppData) => ipcRenderer.invoke('storage:saveData', data),
    exportData: () => ipcRenderer.invoke('storage:exportData'),
    importData: (json: string) => ipcRenderer.invoke('storage:importData', json),
    getBackups: () => ipcRenderer.invoke('storage:getBackups'),
    restoreBackup: (name: string) => ipcRenderer.invoke('storage:restoreBackup', name),
    getDataFilePath: () => ipcRenderer.invoke('storage:getDataFilePath')
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    setAlwaysOnTop: (alwaysOnTop: boolean) => ipcRenderer.send('window:setAlwaysOnTop', alwaysOnTop)
  },
  system: {
    setAutoStart: (enable: boolean) => ipcRenderer.invoke('system:setAutoStart', enable),
    getAutoStart: () => ipcRenderer.invoke('system:getAutoStart'),
    showNotification: (title: string, body: string) => ipcRenderer.send('system:showNotification', { title, body }),
    openUserDataFolder: () => ipcRenderer.send('system:openUserDataFolder'),
    copyText: (text: string) => ipcRenderer.invoke('system:copyText', text)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error('Failed to expose electronAPI:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electronAPI = api
}
