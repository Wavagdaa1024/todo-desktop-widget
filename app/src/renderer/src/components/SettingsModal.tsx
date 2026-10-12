import React, { useState, useEffect } from 'react'
import { AppSettings } from '../domain/types'
import {
  Settings,
  Moon,
  Sun,
  Laptop,
  FolderOpen,
  Download,
  Upload,
  ShieldCheck
} from 'lucide-react'

interface SettingsModalProps {
  settings: AppSettings
  onUpdateSettings: (updates: Partial<AppSettings>) => void
  onClose: () => void
  onExportData: () => void
  onImportData: (json: string) => Promise<boolean>
  onRestoreBackup: (backupName: string) => Promise<boolean>
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  onExportData,
  onImportData,
  onRestoreBackup
}) => {
  const [backups, setBackups] = useState<Array<{ name: string; path: string; time: string; size: number }>>([])
  const [dataFilePath, setDataFilePath] = useState<string>('')
  const [importError, setImportError] = useState<string>('')

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.storage.getBackups().then(setBackups)
      window.electronAPI.storage.getDataFilePath().then(setDataFilePath)
    }
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm('导入将覆盖当前所有任务数据，是否确认继续？（系统将自动为您保存导入前安全备份）')) {
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const success = await onImportData(text)
        if (success) {
          setImportError('')
          alert('数据导入成功！已自动为您生成导入前安全备份。')
          if (window.electronAPI) {
            const updated = await window.electronAPI.storage.getBackups()
            setBackups(updated)
          }
        } else {
          setImportError('导入失败：数据未能成功保存到磁盘')
        }
      } catch (err: any) {
        setImportError(err.message || '文件格式不合法')
      } finally {
        e.target.value = ''
      }
    }
    reader.readAsText(file)
  }


  const handleOpenUserDataFolder = () => {
    window.electronAPI?.system?.openUserDataFolder()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
            <Settings className="w-4 h-4 text-blue-600" />
            <span>系统设置</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section 1: Appearance */}
          <div className="space-y-2.5">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span>外观与主题</span>
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'light', label: '浅色主题', icon: Sun },
                { key: 'dark', label: '深色主题', icon: Moon },
                { key: 'system', label: '跟随系统', icon: Laptop }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => onUpdateSettings({ theme: key as any })}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    settings.theme === key
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Window & Behavior */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200">
              窗口与系统行为
            </h4>
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              {/* Close to tray */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    点击右上角 × 隐藏到系统托盘
                  </div>
                  <div className="text-[11px] text-slate-400">
                    默认开启。关闭窗口时在后台驻留托盘，不退出应用
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.closeToTray}
                  onChange={(e) => onUpdateSettings({ closeToTray: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20"
                />
              </label>

              <div className="border-t border-slate-200/60 dark:border-slate-700/60 my-2" />

              {/* Always on top */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    窗口始终置顶
                  </div>
                  <div className="text-[11px] text-slate-400">
                    保持窗口在其他应用窗口上方，适合悬浮对照任务
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.alwaysOnTop}
                  onChange={(e) => {
                    const checked = e.target.checked
                    onUpdateSettings({ alwaysOnTop: checked })
                    window.electronAPI?.window?.setAlwaysOnTop(checked)
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20"
                />
              </label>

              <div className="border-t border-slate-200/60 dark:border-slate-700/60 my-2" />

              {/* Autostart */}
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    开机自动启动
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Windows 开机后静默启动并驻留托盘，不抢前台焦点
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoStart}
                  onChange={async (e) => {
                    const checked = e.target.checked
                    if (window.electronAPI?.system?.setAutoStart) {
                      const actual = await window.electronAPI.system.setAutoStart(checked)
                      onUpdateSettings({ autoStart: actual })
                    } else {
                      onUpdateSettings({ autoStart: checked })
                    }
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20"
                />
              </label>
            </div>
          </div>

          {/* Section 3: AI Timeout Reminders */}
          <div className="space-y-2.5">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200">
              AI 任务等待超时提醒
            </h4>
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <div>
                <div className="font-medium text-slate-700 dark:text-slate-200">
                  提醒检查阈值
                </div>
                <div className="text-[11px] text-slate-400">
                  当标记为「AI 执行中」超过设定时长时发送 Windows 桌面提醒
                </div>
              </div>
              <select
                value={settings.aiWaitReminderThreshold}
                onChange={(e) =>
                  onUpdateSettings({ aiWaitReminderThreshold: Number(e.target.value) })
                }
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
              >
                <option value={0}>关闭提醒</option>
                <option value={15}>15 分钟</option>
                <option value={30}>30 分钟 (默认)</option>
                <option value={60}>60 分钟</option>
                <option value={120}>120 分钟</option>
              </select>
            </div>
          </div>

          {/* Section 4: Data Management & Backup Recovery */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span>数据安全与备份恢复</span>
              <span className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                本地原子写入保护
              </span>
            </h4>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    数据导出与导入
                  </div>
                  <div className="text-[11px] text-slate-400">
                    支持将全部卡片与设置导出为 JSON，或从 JSON 文件恢复
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onExportData}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>导出 JSON</span>
                  </button>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>导入 JSON</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {importError && (
                <div className="text-rose-600 text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 p-2 rounded">
                  导入失败: {importError}
                </div>
              )}

              <div className="border-t border-slate-200/60 dark:border-slate-700/60 my-2" />

              {/* Data file path */}
              <div className="flex items-center justify-between text-xs">
                <div className="truncate mr-2">
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    本地存储位置
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {dataFilePath || 'userData/tasks_data.json'}
                  </div>
                </div>
                <button
                  onClick={handleOpenUserDataFolder}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-lg"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>打开目录</span>
                </button>
              </div>

              {/* Backups List */}
              <div className="border-t border-slate-200/60 dark:border-slate-700/60 my-2" />
              <div>
                <div className="font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  自动安全备份 ({backups.length} 份可用)
                </div>
                {backups.length === 0 ? (
                  <p className="text-slate-400 text-[11px]">暂无自动轮转备份</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {backups.map((b) => (
                      <div
                        key={b.name}
                        className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                      >
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-200 font-mono">
                            {b.name}
                          </span>
                          <span className="ml-2 text-slate-400 font-mono">
                            {(b.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            if (confirm(`确定要从备份 ${b.name} 恢复吗？当前数据将被覆盖。`)) {
                              try {
                                const success = await onRestoreBackup(b.name)
                                if (success) {
                                  alert(`已成功从备份 ${b.name} 恢复数据！`)
                                } else {
                                  alert('恢复备份失败：写入时发生错误')
                                }
                              } catch (err: any) {
                                alert(`恢复备份失败: ${err.message || '未知错误'}`)
                              }
                            }
                          }}
                          className="px-2 py-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
                        >
                          恢复此备份
                        </button>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 5: About */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
            <div>
              <div className="font-bold text-slate-800 dark:text-slate-100">
                AI Task Board
              </div>
              <div className="text-[11px] text-slate-400">
                版本 v1.0.0 · Windows 桌面任务工作台
              </div>
            </div>
            <a
              href="https://github.com/Wavagdaa1024/todo-desktop-widget"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline text-[11px]"
            >
              GitHub 仓库
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
