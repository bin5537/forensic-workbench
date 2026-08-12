const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV === 'development'

// Feature modules
const cases = require('./lib/cases')
const android = require('./lib/android')
const ios = require('./lib/ios')
const pc = require('./lib/pc')
const report = require('./lib/report')
const recover = require('./lib/recover')
const analyze = require('./lib/analyze')
const vss = require('./lib/vss')
const { execFileSync } = require('child_process')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#00000000',
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: 'sidebar', // macOS only; ignored elsewhere
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (isDev) {
    mainWindow.loadURL('http://localhost:5175')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  // Toggle DevTools with F12 / Ctrl+Shift+I instead of auto-opening.
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools()
    }
  })

  // Report platform so renderer can adapt window controls (real traffic lights on mac,
  // custom-drawn ones elsewhere).
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('app:platform', {
      platform: process.platform,
      isDev
    })
  })
}

app.whenReady().then(() => {
  cases.init(app.getPath('userData'))
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ---- IPC ----------------------------------------------------------------

function ok(data) {
  return { ok: true, data }
}
function fail(err) {
  return { ok: false, error: err && err.message ? err.message : String(err) }
}

// Wrap a handler so exceptions never crash the bridge; renderer always gets {ok,...}.
function handle(channel, fn) {
  ipcMain.handle(channel, async (_evt, ...args) => {
    try {
      return ok(await fn(...args))
    } catch (err) {
      return fail(err)
    }
  })
}

function registerIpc() {
  // Window controls (custom titlebar)
  ipcMain.on('win:minimize', () => mainWindow?.minimize())
  ipcMain.on('win:maximize', () => {
    if (!mainWindow) return
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  })
  ipcMain.on('win:close', () => mainWindow?.close())

  handle('app:setTheme', (mode) => {
    nativeTheme.themeSource = mode // 'system' | 'light' | 'dark'
    return nativeTheme.shouldUseDarkColors
  })

  // Dialogs
  handle('dialog:openDir', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('dialog:openFile', async (filters) => {
    const r = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || []
    })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('dialog:saveFile', async (opts) => {
    const r = await dialog.showSaveDialog(mainWindow, opts || {})
    return r.canceled ? null : r.filePath
  })
  handle('shell:openPath', (p) => shell.openPath(p))
  handle('shell:showItem', (p) => shell.showItemInFolder(p))

  // Cases
  handle('case:list', () => cases.list())
  handle('case:create', (meta) => cases.create(meta))
  handle('case:get', (id) => cases.get(id))
  handle('case:update', (id, patch) => cases.update(id, patch))
  handle('case:delete', (id) => cases.remove(id))
  handle('case:addEvidence', (id, filePath, note) => cases.addEvidence(id, filePath, note))
  handle('case:verifyEvidence', (id, evId) => cases.verifyEvidence(id, evId))
  handle('case:removeEvidence', (id, evId) => cases.removeEvidence(id, evId))
  handle('case:report', async (id) => report.generate(cases.get(id), cases.evidenceDir(id)))

  // Android (ADB)
  handle('adb:available', () => android.available())
  handle('adb:devices', () => android.devices())
  handle('adb:info', (serial) => android.info(serial))
  handle('adb:packages', (serial) => android.packages(serial))
  handle('adb:logcat', (serial, lines) => android.logcat(serial, lines))
  handle('adb:screenshot', (serial, outDir) => android.screenshot(serial, outDir))
  handle('adb:query', (serial, kind) => android.query(serial, kind))
  handle('adb:pull', (serial, remote, outDir) => android.pull(serial, remote, outDir))
  handle('adb:acquire', (serial, outDir) => android.logicalAcquire(serial, outDir))

  // iOS backup
  handle('ios:defaultBackupRoot', () => ios.defaultBackupRoot())
  handle('ios:listBackups', (root) => ios.listBackups(root))
  handle('ios:parse', (backupPath) => ios.parseBackup(backupPath))
  handle('ios:extractFile', (backupPath, fileID, outDir) =>
    ios.extractFile(backupPath, fileID, outDir)
  )

  // PC disk / filesystem
  handle('pc:drives', () => pc.drives())
  handle('pc:browse', (dir) => pc.browse(dir))
  handle('pc:hash', (filePath) => pc.hashFile(filePath))
  handle('pc:timeline', (dir, opts) => pc.timeline(dir, opts))
  handle('pc:scan', (dir) => pc.quickScan(dir))

  // Recovery
  handle('recover:sigTypes', () => recover.signatureTypes())
  handle('recover:recycleBin', () => recover.recycleBin())
  handle('recover:restore', (recyclePath, name, outDir) =>
    recover.restoreRecycle(recyclePath, name, outDir)
  )
  handle('recover:carve', (targetPath, outDir, opts) =>
    recover.carve(targetPath, outDir, opts, (p) =>
      mainWindow?.webContents.send('recover:progress', p)
    )
  )
  handle('recover:autoSources', () => recover.autoImageSources())
  handle('recover:autoScan', (sources, outDir, opts) =>
    recover.carveMany(sources, outDir, opts, (p) =>
      mainWindow?.webContents.send('recover:progress', p)
    )
  )
  ipcMain.on('recover:stop', () => recover.stopCarve())

  // Analysis
  handle('analyze:footprint', () => analyze.digitalFootprint())

  // Volume Shadow Copies (previous versions)
  handle('app:isAdmin', () => vss.isAdmin())
  ipcMain.on('app:relaunchElevated', () => relaunchElevated())
  handle('vss:list', () => vss.listSnapshots())
  handle('vss:browse', (device, sub) => vss.browseSnapshot(device, sub))
  handle('vss:quickPaths', () => vss.quickPaths())
  handle('vss:restore', (device, sub, outDir) => vss.restoreFromSnapshot(device, sub, outDir))
}

// Relaunch the app with Administrator rights via a UAC prompt.
function relaunchElevated() {
  if (process.platform !== 'win32') return
  const exe = app.getPath('exe')
  const args = app.isPackaged ? [] : process.argv.slice(1)
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'"
  const argList = args.length ? ` -ArgumentList @(${args.map(q).join(',')})` : ''
  const cmd = `Start-Process -FilePath ${q(exe)} -Verb RunAs${argList}`
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', cmd], { windowsHide: true })
    app.quit()
  } catch {
    /* user dismissed the UAC prompt — stay open */
  }
}
