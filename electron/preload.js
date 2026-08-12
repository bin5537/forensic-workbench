const { contextBridge, ipcRenderer } = require('electron')

// Thin, explicit surface. Renderer never touches ipcRenderer directly.
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args)

contextBridge.exposeInMainWorld('api', {
  // window + app
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close')
  },
  onPlatform: (cb) => ipcRenderer.on('app:platform', (_e, info) => cb(info)),
  setTheme: (mode) => invoke('app:setTheme', mode),

  // dialogs / shell
  openDir: () => invoke('dialog:openDir'),
  openFile: (filters) => invoke('dialog:openFile', filters),
  saveFile: (opts) => invoke('dialog:saveFile', opts),
  openPath: (p) => invoke('shell:openPath', p),
  showItem: (p) => invoke('shell:showItem', p),

  // cases
  cases: {
    list: () => invoke('case:list'),
    create: (meta) => invoke('case:create', meta),
    get: (id) => invoke('case:get', id),
    update: (id, patch) => invoke('case:update', id, patch),
    remove: (id) => invoke('case:delete', id),
    addEvidence: (id, filePath, note) => invoke('case:addEvidence', id, filePath, note),
    verifyEvidence: (id, evId) => invoke('case:verifyEvidence', id, evId),
    removeEvidence: (id, evId) => invoke('case:removeEvidence', id, evId),
    report: (id) => invoke('case:report', id)
  },

  // android
  adb: {
    available: () => invoke('adb:available'),
    devices: () => invoke('adb:devices'),
    info: (serial) => invoke('adb:info', serial),
    packages: (serial) => invoke('adb:packages', serial),
    logcat: (serial, lines) => invoke('adb:logcat', serial, lines),
    screenshot: (serial, outDir) => invoke('adb:screenshot', serial, outDir),
    query: (serial, kind) => invoke('adb:query', serial, kind),
    pull: (serial, remote, outDir) => invoke('adb:pull', serial, remote, outDir),
    acquire: (serial, outDir) => invoke('adb:acquire', serial, outDir)
  },

  // ios
  ios: {
    defaultBackupRoot: () => invoke('ios:defaultBackupRoot'),
    listBackups: (root) => invoke('ios:listBackups', root),
    parse: (backupPath) => invoke('ios:parse', backupPath),
    extractFile: (backupPath, fileID, outDir) =>
      invoke('ios:extractFile', backupPath, fileID, outDir)
  },

  // pc
  pc: {
    drives: () => invoke('pc:drives'),
    browse: (dir) => invoke('pc:browse', dir),
    hash: (filePath) => invoke('pc:hash', filePath),
    timeline: (dir, opts) => invoke('pc:timeline', dir, opts),
    scan: (dir) => invoke('pc:scan', dir)
  },

  // recovery
  recover: {
    sigTypes: () => invoke('recover:sigTypes'),
    recycleBin: () => invoke('recover:recycleBin'),
    restore: (recyclePath, name, outDir) => invoke('recover:restore', recyclePath, name, outDir),
    carve: (targetPath, outDir, opts) => invoke('recover:carve', targetPath, outDir, opts),
    autoSources: () => invoke('recover:autoSources'),
    autoScan: (sources, outDir, opts) => invoke('recover:autoScan', sources, outDir, opts),
    stop: () => ipcRenderer.send('recover:stop'),
    onProgress: (cb) => {
      const h = (_e, p) => cb(p)
      ipcRenderer.on('recover:progress', h)
      return () => ipcRenderer.removeListener('recover:progress', h)
    }
  },

  // analysis
  analyze: {
    footprint: () => invoke('analyze:footprint')
  },

  // admin / elevation
  isAdmin: () => invoke('app:isAdmin'),
  relaunchElevated: () => ipcRenderer.send('app:relaunchElevated'),

  // volume shadow copies (previous versions)
  vss: {
    list: () => invoke('vss:list'),
    browse: (device, sub) => invoke('vss:browse', device, sub),
    quickPaths: () => invoke('vss:quickPaths'),
    restore: (device, sub, outDir) => invoke('vss:restore', device, sub, outDir)
  }
})
