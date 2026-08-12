const fs = require('fs')
const path = require('path')

// sql.js is a wasm SQLite; loaded lazily so the app boots even if it's missing.
let SQL = null
async function getSQL() {
  if (SQL) return SQL
  const initSqlJs = require('sql.js')
  const wasmPath = path.join(
    path.dirname(require.resolve('sql.js')),
    'sql-wasm.wasm'
  )
  SQL = await initSqlJs({
    locateFile: () => wasmPath
  })
  return SQL
}

function openDb(filePath) {
  return getSQL().then((S) => {
    const buf = fs.readFileSync(filePath)
    return new S.Database(buf)
  })
}

function rowsOf(db, sql) {
  const res = db.exec(sql)
  if (!res.length) return []
  const { columns, values } = res[0]
  return values.map((v) => {
    const o = {}
    columns.forEach((c, i) => (o[c] = v[i]))
    return o
  })
}

// Standard per-user iTunes/Finder backup roots.
function defaultBackupRoot() {
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const candidates = [
    process.platform === 'win32' &&
      path.join(home, 'Apple', 'MobileSync', 'Backup'),
    process.platform === 'win32' &&
      path.join(home, 'AppData', 'Roaming', 'Apple Computer', 'MobileSync', 'Backup'),
    process.platform === 'darwin' &&
      path.join(home, 'Library', 'Application Support', 'MobileSync', 'Backup')
  ].filter(Boolean)
  for (const c of candidates) if (fs.existsSync(c)) return c
  return candidates[0] || ''
}

// Each subfolder of the backup root is one device backup; read Info.plist-ish
// metadata from Manifest.plist / Info.plist when present.
function listBackups(root) {
  if (!root || !fs.existsSync(root)) return []
  const out = []
  for (const name of fs.readdirSync(root)) {
    const dir = path.join(root, name)
    let stat
    try {
      stat = fs.statSync(dir)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    const hasManifestDb = fs.existsSync(path.join(dir, 'Manifest.db'))
    if (!hasManifestDb && !fs.existsSync(path.join(dir, 'Manifest.plist'))) continue
    const meta = readInfoPlist(path.join(dir, 'Info.plist'))
    out.push({
      id: name,
      path: dir,
      hasManifestDb,
      encrypted: isEncrypted(path.join(dir, 'Manifest.plist')),
      deviceName: meta.deviceName || '',
      productType: meta.productType || '',
      iosVersion: meta.iosVersion || '',
      lastBackup: meta.lastBackup || stat.mtime.toISOString()
    })
  }
  return out.sort((a, b) => (a.lastBackup < b.lastBackup ? 1 : -1))
}

function isEncrypted(manifestPlist) {
  try {
    const txt = fs.readFileSync(manifestPlist, 'utf8')
    const m = txt.match(/<key>IsEncrypted<\/key>\s*<(true|false)\/>/)
    return m ? m[1] === 'true' : /<key>IsEncrypted<\/key>\s*<true/.test(txt)
  } catch {
    return false
  }
}

// Minimal binary/xml plist scraping — enough for a few string fields without a plist dep.
function readInfoPlist(p) {
  const out = {}
  try {
    const txt = fs.readFileSync(p, 'latin1')
    const grab = (key) => {
      const re = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`)
      const m = txt.match(re)
      return m ? m[1] : ''
    }
    out.deviceName = grab('Device Name')
    out.productType = grab('Product Type')
    out.iosVersion = grab('Product Version')
    const lastBackup = grab('Last Backup Date')
    if (lastBackup) out.lastBackup = lastBackup
  } catch {
    /* ignore */
  }
  return out
}

const DOMAINS = {
  sms: { file: 'Library/SMS/sms.db', label: '메시지' },
  calls: { file: 'Library/CallHistoryDB/CallHistory.storedata', label: '통화 기록' },
  contacts: { file: 'Library/AddressBook/AddressBook.sqlitedb', label: '연락처' }
}

// Look up a logical file inside a backup via Manifest.db → the hashed on-disk name.
async function locate(backupPath, relativePath) {
  const manifest = path.join(backupPath, 'Manifest.db')
  if (!fs.existsSync(manifest)) throw new Error('Manifest.db 없음 (암호화 또는 구형 백업?)')
  const db = await openDb(manifest)
  try {
    const rows = rowsOf(
      db,
      `SELECT fileID, domain, relativePath FROM Files WHERE relativePath = '${relativePath.replace(
        /'/g,
        "''"
      )}' LIMIT 5`
    )
    if (!rows.length) return null
    const fileID = rows[0].fileID
    // iOS 10+ stores files under <backup>/<first 2 hex chars>/<fileID>
    const onDisk = path.join(backupPath, fileID.slice(0, 2), fileID)
    return { fileID, relativePath, onDisk: fs.existsSync(onDisk) ? onDisk : null }
  } finally {
    db.close()
  }
}

// High-level parse: device summary + counts/samples from the key databases.
async function parseBackup(backupPath) {
  const result = { backupPath, tables: {}, warnings: [] }
  const manifest = path.join(backupPath, 'Manifest.db')
  if (!fs.existsSync(manifest)) {
    result.warnings.push('Manifest.db 없음 — 암호화되었거나 구형 백업일 수 있습니다.')
    return result
  }

  const db = await openDb(manifest)
  try {
    result.fileCount = rowsOf(db, 'SELECT COUNT(*) c FROM Files')[0]?.c || 0
    result.domains = rowsOf(
      db,
      'SELECT domain, COUNT(*) c FROM Files GROUP BY domain ORDER BY c DESC LIMIT 25'
    )
  } finally {
    db.close()
  }

  // Messages
  await tryDomain(result, backupPath, DOMAINS.sms, async (dbPath) => {
    const d = await openDb(dbPath)
    try {
      const count = rowsOf(d, 'SELECT COUNT(*) c FROM message')[0]?.c || 0
      const sample = rowsOf(
        d,
        `SELECT m.ROWID id, h.id AS handle, m.is_from_me,
                datetime(m.date/1000000000 + 978307200,'unixepoch') AS dt,
                substr(m.text,1,120) AS text
         FROM message m LEFT JOIN handle h ON m.handle_id=h.ROWID
         WHERE m.text IS NOT NULL ORDER BY m.date DESC LIMIT 25`
      )
      return { count, sample }
    } finally {
      d.close()
    }
  })

  // Contacts
  await tryDomain(result, backupPath, DOMAINS.contacts, async (dbPath) => {
    const d = await openDb(dbPath)
    try {
      const count = rowsOf(d, 'SELECT COUNT(*) c FROM ABPerson')[0]?.c || 0
      const sample = rowsOf(
        d,
        `SELECT ROWID id, First AS first, Last AS last, Organization AS org
         FROM ABPerson ORDER BY ROWID LIMIT 30`
      )
      return { count, sample }
    } finally {
      d.close()
    }
  })

  // Call history
  await tryDomain(result, backupPath, DOMAINS.calls, async (dbPath) => {
    const d = await openDb(dbPath)
    try {
      const count = rowsOf(d, 'SELECT COUNT(*) c FROM ZCALLRECORD')[0]?.c || 0
      const sample = rowsOf(
        d,
        `SELECT Z_PK id, ZADDRESS AS address, ZDURATION AS duration,
                datetime(ZDATE + 978307200,'unixepoch') AS dt, ZORIGINATED AS originated
         FROM ZCALLRECORD ORDER BY ZDATE DESC LIMIT 25`
      )
      return { count, sample }
    } finally {
      d.close()
    }
  })

  return result
}

async function tryDomain(result, backupPath, domain, fn) {
  try {
    const loc = await locate(backupPath, domain.file)
    if (!loc || !loc.onDisk) {
      result.warnings.push(`${domain.label}: 백업에서 찾을 수 없습니다.`)
      return
    }
    result.tables[domain.label] = await fn(loc.onDisk)
  } catch (e) {
    result.warnings.push(`${domain.label}: ${e.message}`)
  }
}

// Copy a single backup file out to a folder, named by its logical path.
async function extractFile(backupPath, fileID, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const src = path.join(backupPath, fileID.slice(0, 2), fileID)
  if (!fs.existsSync(src)) throw new Error('Backup file not on disk: ' + fileID)
  const dest = path.join(outDir, fileID)
  fs.copyFileSync(src, dest)
  return { path: dest }
}

module.exports = {
  defaultBackupRoot,
  listBackups,
  parseBackup,
  extractFile
}
