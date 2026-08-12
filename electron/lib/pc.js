const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFile } = require('child_process')
const { hashFile } = require('./hash')

// List logical drives / mount points as browse entry points.
function drives() {
  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      execFile(
        'wmic',
        ['logicaldisk', 'get', 'DeviceID,VolumeName,Size,FreeSpace,DriveType'],
        { windowsHide: true, timeout: 8000 },
        (err, stdout) => {
          if (err) {
            // Fallback: probe A: - Z:
            const found = []
            for (let i = 67; i <= 90; i++) {
              const d = String.fromCharCode(i) + ':\\'
              if (fs.existsSync(d)) found.push({ path: d, label: '', size: null, free: null })
            }
            return resolve(found.length ? found : [{ path: 'C:\\', label: '', size: null }])
          }
          const lines = stdout.split('\n').slice(1)
          const out = []
          for (const line of lines) {
            const t = line.trim()
            if (!t) continue
            const cols = t.split(/\s{2,}/)
            // DeviceID DriveType FreeSpace Size VolumeName (order varies) — parse loosely
            const idm = t.match(/^([A-Z]:)/)
            if (!idm) continue
            const nums = t.match(/\d{5,}/g) || []
            out.push({
              path: idm[1] + '\\',
              label: (t.match(/[A-Za-z][A-Za-z0-9 _-]+$/) || [''])[0].trim(),
              free: nums[0] ? Number(nums[0]) : null,
              size: nums[1] ? Number(nums[1]) : null
            })
          }
          resolve(out.length ? out : [{ path: 'C:\\', label: '' }])
        }
      )
    })
  }
  // POSIX: home + root as simple entry points
  return Promise.resolve([
    { path: '/', label: 'root' },
    { path: os.homedir(), label: 'home' }
  ])
}

function safeStat(p) {
  try {
    return fs.lstatSync(p)
  } catch {
    return null
  }
}

// One directory level: entries with type, size and MACB-ish timestamps.
function browse(dir) {
  const target = dir || os.homedir()
  const entries = fs.readdirSync(target, { withFileTypes: true })
  const out = []
  for (const d of entries) {
    const full = path.join(target, d.name)
    const st = safeStat(full)
    out.push({
      name: d.name,
      path: full,
      type: d.isDirectory() ? 'dir' : d.isSymbolicLink() ? 'link' : 'file',
      size: st ? st.size : null,
      mtime: st ? st.mtime.toISOString() : null,
      atime: st ? st.atime.toISOString() : null,
      ctime: st ? st.ctime.toISOString() : null,
      birthtime: st && st.birthtime ? st.birthtime.toISOString() : null,
      ext: d.isFile() ? path.extname(d.name).toLowerCase() : ''
    })
  }
  out.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return { dir: target, parent: path.dirname(target), entries: out }
}

async function hashFileEntry(filePath) {
  const st = fs.statSync(filePath)
  const digest = await hashFile(filePath)
  return { path: filePath, size: st.size, mtime: st.mtime.toISOString(), ...digest }
}

// Recursive MACB timeline. Bounded by maxEntries to stay responsive.
function timeline(dir, opts = {}) {
  const maxEntries = opts.maxEntries || 5000
  const maxDepth = opts.maxDepth == null ? 6 : opts.maxDepth
  const events = []
  let scanned = 0
  let truncated = false

  const walk = (d, depth) => {
    if (truncated || depth > maxDepth) return
    let list
    try {
      list = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of list) {
      if (events.length >= maxEntries) {
        truncated = true
        return
      }
      const full = path.join(d, ent.name)
      const st = safeStat(full)
      if (!st) continue
      scanned++
      if (ent.isDirectory()) {
        walk(full, depth + 1)
      } else if (ent.isFile()) {
        events.push({
          path: full,
          name: ent.name,
          size: st.size,
          modified: st.mtime.toISOString(),
          accessed: st.atime.toISOString(),
          changed: st.ctime.toISOString(),
          born: st.birthtime ? st.birthtime.toISOString() : null
        })
      }
    }
  }
  walk(dir, 0)
  events.sort((a, b) => (a.modified < b.modified ? 1 : -1))
  return { dir, count: events.length, scanned, truncated, events }
}

// A quick triage scan: file-type breakdown, largest files, and hits on
// forensically-interesting names/extensions.
function quickScan(dir) {
  const byExt = {}
  const largest = []
  const interesting = []
  let files = 0
  let dirs = 0
  let bytes = 0
  let truncated = false
  const MAX = 40000

  const INTEREST = /\.(db|sqlite|sqlite3|log|pst|ost|eml|key|pem|kdbx|bak|vhd|vhdx|e01|dd|img|pcap|pcapng)$/i
  const INTEREST_NAME = /(password|passwd|secret|wallet|backup|history|cookies|credential)/i

  const walk = (d, depth) => {
    if (truncated || depth > 8) return
    let list
    try {
      list = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of list) {
      if (files + dirs >= MAX) {
        truncated = true
        return
      }
      const full = path.join(d, ent.name)
      if (ent.isDirectory()) {
        dirs++
        walk(full, depth + 1)
      } else if (ent.isFile()) {
        files++
        const st = safeStat(full)
        const size = st ? st.size : 0
        bytes += size
        const ext = path.extname(ent.name).toLowerCase() || '(none)'
        byExt[ext] = byExt[ext] || { count: 0, bytes: 0 }
        byExt[ext].count++
        byExt[ext].bytes += size
        largest.push({ path: full, size })
        if (largest.length > 200) {
          largest.sort((a, b) => b.size - a.size)
          largest.length = 100
        }
        if (INTEREST.test(ent.name) || INTEREST_NAME.test(ent.name)) {
          if (interesting.length < 500)
            interesting.push({ path: full, size, mtime: st ? st.mtime.toISOString() : null })
        }
      }
    }
  }
  walk(dir, 0)
  largest.sort((a, b) => b.size - a.size)

  const extTable = Object.entries(byExt)
    .map(([ext, v]) => ({ ext, count: v.count, bytes: v.bytes }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)

  return {
    dir,
    files,
    dirs,
    bytes,
    truncated,
    extTable,
    largest: largest.slice(0, 30),
    interesting
  }
}

module.exports = { drives, browse, hashFile: hashFileEntry, timeline, quickScan }
