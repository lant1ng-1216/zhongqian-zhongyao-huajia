import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { initDb } from './db'
import { backfillPinyin, getSettings } from './services'
import { registerIpc } from './ipc'
import { runBackup } from './backup'
import { getInitialState, trackWindow } from './windowState'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const st = getInitialState()
  mainWindow = new BrowserWindow({
    width: st.width,
    height: st.height,
    ...(st.x !== undefined && st.y !== undefined ? { x: st.x, y: st.y } : {}),
    minWidth: 480, // 允许拖到很小，适配小平板
    minHeight: 360,
    resizable: true, // 明确允许拖动边框改变大小
    maximizable: true,
    show: false,
    autoHideMenuBar: true,
    title: '仲谦 · 中药划价',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 记住窗口大小/位置/最大化
  trackWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    if (st.isMaximized) mainWindow?.maximize()
    mainWindow?.show()
  })

  // 启动时应用已保存的界面缩放
  mainWindow.webContents.on('did-finish-load', () => {
    try {
      const z = getSettings().ui_zoom || 1
      mainWindow?.webContents.setZoomFactor(Math.min(1.3, Math.max(0.5, z)))
    } catch {
      /* 忽略 */
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite 注入的开发服务器地址
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  initDb()
  backfillPinyin()
  registerIpc()

  // 启动时自动备份
  runBackup()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// 退出前自动备份
let didExitBackup = false
app.on('before-quit', () => {
  if (!didExitBackup) {
    didExitBackup = true
    runBackup()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
