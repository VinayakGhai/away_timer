import { app, BrowserWindow, ipcMain, screen } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { PostHog } from 'posthog-node'

const posthog = new PostHog('phc_xzSvDAjBbqD8K9kfiuoQjZXWy3iTJAZxQ8tEmWxasadD', {
  host: 'https://us.i.posthog.com'
})

const isDev = !app.isPackaged
const DATA_FILE = path.join(app.getPath('userData'), 'away-timer-state.json')

let mainWindow: BrowserWindow | null = null
let appDeviceId = ''

interface PersistedState {
  timer: unknown
  alwaysOnTop: boolean
  windowBounds?: { x: number; y: number; width: number; height: number }
  deviceId?: string
}

function loadState(): PersistedState | null {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
      appDeviceId = data.deviceId || crypto.randomUUID()
      return data
    }
  } catch {
    // ignore corrupt state
  }
  appDeviceId = crypto.randomUUID()
  return null
}

function saveState(state: PersistedState): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ ...state, deviceId: appDeviceId }, null, 2), 'utf-8')
  } catch {
    // ignore write errors
  }
}

function createWindow(): void {
  const saved = loadState()
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    title: 'Away Timer',
    width: saved?.windowBounds?.width ? Math.min(saved.windowBounds.width, 260) : 240,
    height: saved?.windowBounds?.height ? Math.min(saved.windowBounds.height, 260) : 240,
    x: saved?.windowBounds?.x ?? Math.round((width - 240) / 2),
    y: saved?.windowBounds?.y ?? Math.round((height - 240) / 2),
    minWidth: 160,
    minHeight: 160,
    maxWidth: 600,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: saved?.alwaysOnTop ?? false,
    backgroundColor: '#0f0f12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  }

  mainWindow = new BrowserWindow(windowOptions)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      const current = loadState()
      saveState({
        timer: current?.timer ?? {},
        alwaysOnTop: mainWindow.isAlwaysOnTop(),
        windowBounds: bounds,
      })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  
  posthog.capture({
    distinctId: appDeviceId,
    event: 'App_Launched',
    properties: { version: app.getVersion() }
  })
  
  if (!isDev) {
    // Initial check after a short delay
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify()
    }, 3000)

    // Periodic check every 6 hours
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify()
    }, 6 * 60 * 60 * 1000)
  }
})

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    await posthog.shutdown()
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('get-state', () => loadState())
ipcMain.handle('get-version', () => app.getVersion())

ipcMain.handle('save-state', (_event, state: PersistedState) => {
  const current = loadState()
  saveState({
    ...state,
    windowBounds: current?.windowBounds ?? state.windowBounds,
  })
})

ipcMain.handle('set-always-on-top', (_event, value: boolean) => {
  mainWindow?.setAlwaysOnTop(value)
})

ipcMain.handle('get-always-on-top', () => mainWindow?.isAlwaysOnTop() ?? false)

ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-close', () => mainWindow?.close())

// Setup updater logging
log.transports.file.level = 'info'
autoUpdater.logger = log

// Auto-Updater events
const sendUpdaterEvent = (event: string, data?: any) => {
  mainWindow?.webContents.send('updater-event', event, data)
}

autoUpdater.on('checking-for-update', () => sendUpdaterEvent('checking'))
autoUpdater.on('update-available', (info) => sendUpdaterEvent('available', info))
autoUpdater.on('update-not-available', (info) => sendUpdaterEvent('not-available', info))
autoUpdater.on('error', (err) => sendUpdaterEvent('error', err?.message || 'Update error'))
autoUpdater.on('download-progress', (progressObj) => sendUpdaterEvent('progress', progressObj))
autoUpdater.on('update-downloaded', (info) => sendUpdaterEvent('downloaded', info))

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall(false, true)
})

ipcMain.on('track-event', (event, eventName, properties) => {
  posthog.capture({
    distinctId: appDeviceId,
    event: eventName,
    properties: {
      ...properties,
      version: app.getVersion()
    }
  })
})
