const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

/* ======================================================================
 *  Volume Shadow Copies — Windows keeps point-in-time snapshots of the
 *  disk (System Restore / File History). They can hold OLD versions of
 *  files, including ones long since deleted. Listing and reading them
 *  requires Administrator.
 * ==================================================================== */

function ps(script) {
  return execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { encoding: 'utf8', windowsHide: true, timeout: 30000, maxBuffer: 8 * 1024 * 1024 }
  )
}

function isAdmin() {
  if (process.platform !== 'win32') return false
  try {
    const out = ps(
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)'
    )
    return /true/i.test(out)
  } catch {
    return false
  }
}

// List all shadow copies on the machine.
function listSnapshots() {
  if (process.platform !== 'win32') return { admin: false, snapshots: [] }
  const admin = isAdmin()
  if (!admin) return { admin: false, snapshots: [] }
  let out
  try {
    out = ps(
      "Get-CimInstance Win32_ShadowCopy | ForEach-Object { [PSCustomObject]@{ Device=$_.DeviceObject; Install=$_.InstallDate.ToString('o'); Volume=$_.VolumeName; Id=$_.ID } } | ConvertTo-Json -Compress"
    )
  } catch (e) {
    return { admin: true, snapshots: [], error: e.message }
  }
  let data = []
  try {
    const parsed = JSON.parse(out.trim() || '[]')
    data = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    data = []
  }
  const snapshots = data
    .filter((s) => s && s.Device)
    .map((s, i) => ({
      id: s.Id || String(i),
      device: s.Device, // \\?\GLOBALROOT\Device\HarddiskVolumeShadowCopyN
      installedAt: s.Install || null,
      volume: s.Volume || ''
    }))
    .sort((a, b) => (a.installedAt < b.installedAt ? 1 : -1))
  return { admin: true, snapshots }
}

// GLOBALROOT device paths must be concatenated manually (path.join mangles \\?\).
function deviceJoin(device, sub) {
  let s = (sub || '').replace(/\//g, '\\').replace(/^\\+/, '')
  return device + '\\' + s
}

// List entries inside a snapshot at the given sub-path.
function browseSnapshot(device, sub) {
  const full = deviceJoin(device, sub)
  let names
  try {
    names = fs.readdirSync(full, { withFileTypes: true })
  } catch (e) {
    throw new Error('이 위치를 열 수 없습니다: ' + (e.code || e.message))
  }
  const dirs = []
  const files = []
  for (const ent of names) {
    const child = deviceJoin(device, (sub ? sub + '\\' : '') + ent.name)
    let st = null
    try {
      st = fs.statSync(child)
    } catch {
      /* ignore unreadable */
    }
    const rec = {
      name: ent.name,
      sub: (sub ? sub + '\\' : '') + ent.name,
      size: st ? st.size : 0,
      mtime: st ? st.mtime.toISOString() : null
    }
    if (ent.isDirectory()) dirs.push(rec)
    else files.push(rec)
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name))
  files.sort((a, b) => a.name.localeCompare(b.name))
  return { sub: sub || '', dirs, files }
}

// Common user folders worth jumping straight to.
function quickPaths() {
  return [
    { label: '사용자', sub: 'Users' },
    { label: '바탕화면', sub: 'Users\\' + (process.env.USERNAME || '') + '\\Desktop' },
    { label: '문서', sub: 'Users\\' + (process.env.USERNAME || '') + '\\Documents' },
    { label: '다운로드', sub: 'Users\\' + (process.env.USERNAME || '') + '\\Downloads' },
    { label: '사진', sub: 'Users\\' + (process.env.USERNAME || '') + '\\Pictures' }
  ]
}

// Copy a file out of a snapshot into a normal folder.
function restoreFromSnapshot(device, sub, outDir) {
  const src = deviceJoin(device, sub)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const name = path.basename(sub.replace(/\\/g, '/'))
  let dest = path.join(outDir, name)
  let i = 1
  const ext = path.extname(name)
  const base = path.basename(name, ext)
  while (fs.existsSync(dest)) dest = path.join(outDir, `${base} (${i++})${ext}`)
  fs.copyFileSync(src, dest)
  return { path: dest }
}

module.exports = { isAdmin, listSnapshots, browseSnapshot, restoreFromSnapshot, quickPaths }
