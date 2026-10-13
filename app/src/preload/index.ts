import { contextBridge, ipcRenderer } from 'electron'
import { AppData, StorageInitialResult } from '../renderer/src/domain/types'

export interface IElectronAPI {
  storage: {
    getInitialData: () => Promise<StorageInitialResult>
    saveData: (data: AppData) => Promise<boolean>
    exportData: () => Promise<string>
    importData: (json: string) => Promise<AppData>
    getBackups: () => Promise<Array<{ name: string; path: string; time: string; size: number }>>
    restoreBackup: (name: string) => Promise<AppData>
    getDataFilePath: () => Promise<string>
    flush: () => Promise<boolean>
    initializeClean: () => Promise<AppData>
    onDataUpdated: (callback: (data: AppData) => void) => () => void
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    setAlwaysOnTop: (alwaysOnTop: boolean) => void
    openMainBoard: (options?: { projectId?: string; nodeId?: string }) => void
    closeWidget: () => void
    setWidgetPin: (pinned: boolean) => void
    setWidgetHeight: (height: number) => void
    onWidgetRefresh?: (callback: () => void) => () => void
    onNavigateToNode?: (callback: (target: { projectId?: string; nodeId?: string }) => void) => () => void
  }
  system: {
    setAutoStart: (enable: boolean) => Promise<boolean>
    getAutoStart: () => Promise<boolean>
    showNotification: (title: string, body: string) => void
    openUserDataFolder: () => void
    copyText: (text: string) => Promise<void>
    onQuickAction: (callback: (action: string) => void) => () => void
    onRequestFlush: (callback: () => Promise<boolean>) => () => void
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
    getDataFilePath: () => ipcRenderer.invoke('storage:getDataFilePath'),
    flush: () => ipcRenderer.invoke('storage:flush'),
    initializeClean: () => ipcRenderer.invoke('storage:initializeClean'),
    onDataUpdated: (callback: (data: AppData) => void) => {
      const listener = (_event: any, data: AppData) => callback(data)
      ipcRenderer.on('data-updated', listener)
      return () => {
        ipcRenderer.removeListener('data-updated', listener)
      }
    }
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    setAlwaysOnTop: (alwaysOnTop: boolean) => ipcRenderer.send('window:setAlwaysOnTop', alwaysOnTop),
    openMainBoard: (options?: { projectId?: string; nodeId?: string }) => ipcRenderer.send('window:openMainBoard', options),
    closeWidget: () => ipcRenderer.send('window:closeWidget'),
    setWidgetPin: (pinned: boolean) => ipcRenderer.send('window:setWidgetPin', pinned),
    setWidgetHeight: (height: number) => ipcRenderer.send('window:setWidgetHeight', height),
    onWidgetRefresh: (callback: () => void) => {
      const listener = () => callback()
      ipcRenderer.on('widget:refresh', listener)
      return () => {
        ipcRenderer.removeListener('widget:refresh', listener)
      }
    },
    onNavigateToNode: (callback: (target: { projectId?: string; nodeId?: string }) => void) => {
      const listener = (_event: any, target: { projectId?: string; nodeId?: string }) => callback(target)
      ipcRenderer.on('navigate-to-node', listener)
      return () => {
        ipcRenderer.removeListener('navigate-to-node', listener)
      }
    }
  },
  system: {
    setAutoStart: (enable: boolean) => ipcRenderer.invoke('system:setAutoStart', enable),
    getAutoStart: () => ipcRenderer.invoke('system:getAutoStart'),
    showNotification: (title: string, body: string) => ipcRenderer.send('system:showNotification', { title, body }),
    openUserDataFolder: () => ipcRenderer.send('system:openUserDataFolder'),
    copyText: (text: string) => ipcRenderer.invoke('system:copyText', text),
    onQuickAction: (callback: (action: string) => void) => {
      const listener = (_event: any, action: string) => callback(action)
      ipcRenderer.on('quick-action', listener)
      return () => {
        ipcRenderer.removeListener('quick-action', listener)
      }
    },
    onRequestFlush: (callback: () => Promise<boolean>) => {
      const listener = async (_event: any, correlationId: string) => {
        try {
          const success = await callback()
          ipcRenderer.send(`system:flush-response:${correlationId}`, success)
        } catch {
          ipcRenderer.send(`system:flush-response:${correlationId}`, false)
        }
      }
      ipcRenderer.on('system:request-flush', listener)
      return () => {
        ipcRenderer.removeListener('system:request-flush', listener)
      }
    }
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
