const { execFile } = require('child_process')
const fs = require('fs')
const path = require('path')

// Resolve adb: prefer PATH, fall back to the standard Android SDK location.
function adbPath() {
  const home = process.env.USERPROFILE || process.env.HOME || ''
  const candidates = [
    'adb',
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb'),
    home && path.join(home, 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    home && path.join(home, 'Library', 'Android', 'sdk', 'platform-tools', 'adb')
  ].filter(Boolean)
  for (const c of candidates) {
    if (c === 'adb') return c // let PATH resolve
    if (fs.existsSync(c)) return c
  }
  return 'adb'
}

const ADB = adbPath()

// Run adb, returning stdout as text. Rejects on nonzero exit.
function run(args, { serial, timeout = 30000, maxBuffer = 1024 * 1024 * 64 } = {}) {
  const full = serial ? ['-s', serial, ...args] : args
  return new Promise((resolve, reject) => {
    execFile(ADB, full, { timeout, maxBuffer, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        err.message = `adb ${full.join(' ')}\n${stderr || err.message}`
        return reject(err)
      }
      resolve(stdout)
    })
  })
}

// Run adb capturing raw stdout as a Buffer (for binary payloads like screencap).
function runBinary(args, { serial, timeout = 30000, maxBuffer = 1024 * 1024 * 128 } = {}) {
  const full = serial ? ['-s', serial, ...args] : args
  return new Promise((resolve, reject) => {
    execFile(
      ADB,
      full,
      { timeout, maxBuffer, encoding: 'buffer', windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          err.message = `adb ${full.join(' ')}\n${stderr}`
          return reject(err)
        }
        resolve(stdout)
      }
    )
  })
}

async function available() {
  try {
    const out = await run(['version'], { timeout: 8000 })
    const m = out.match(/version\s+([\d.]+)/i)
    return { available: true, version: m ? m[1] : out.trim().split('\n')[0], path: ADB }
  } catch (e) {
    return { available: false, error: e.message, path: ADB }
  }
}

async function devices() {
  const out = await run(['devices', '-l'], { timeout: 8000 })
  const lines = out.split('\n').slice(1)
  const list = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const parts = t.split(/\s+/)
    const serial = parts[0]
    const state = parts[1]
    const props = {}
    for (const p of parts.slice(2)) {
      const kv = p.split(':')
      if (kv.length === 2) props[kv[0]] = kv[1]
    }
    list.push({
      serial,
      state,
      model: props.model || '',
      device: props.device || '',
      product: props.product || '',
      transport: props.transport_id || ''
    })
  }
  return list
}

// getprop is verbose; surface the fields an examiner cares about.
async function info(serial) {
  const out = await run(['shell', 'getprop'], { serial, timeout: 15000 })
  const props = {}
  const re = /^\[([^\]]+)\]:\s*\[([^\]]*)\]$/gm
  let m
  while ((m = re.exec(out))) props[m[1]] = m[2]

  const pick = (k) => props[k] || ''
  const summary = {
    manufacturer: pick('ro.product.manufacturer'),
    model: pick('ro.product.model'),
    device: pick('ro.product.device'),
    androidVersion: pick('ro.build.version.release'),
    sdk: pick('ro.build.version.sdk'),
    securityPatch: pick('ro.build.version.security_patch'),
    buildId: pick('ro.build.display.id'),
    fingerprint: pick('ro.build.fingerprint'),
    serialno: pick('ro.serialno') || pick('ro.boot.serialno'),
    hardware: pick('ro.hardware'),
    bootloader: pick('ro.bootloader'),
    timezone: pick('persist.sys.timezone'),
    locale: pick('persist.sys.locale') || pick('ro.product.locale')
  }
  return { summary, propCount: Object.keys(props).length, raw: props }
}

async function packages(serial) {
  const third = await run(['shell', 'pm', 'list', 'packages', '-3'], { serial, timeout: 20000 })
  const sys = await run(['shell', 'pm', 'list', 'packages', '-s'], { serial, timeout: 20000 })
  const parse = (s) =>
    s
      .split('\n')
      .map((l) => l.replace('package:', '').trim())
      .filter(Boolean)
      .sort()
  return { thirdParty: parse(third), system: parse(sys) }
}

async function logcat(serial, lines = 500) {
  const out = await run(['logcat', '-d', '-v', 'time', '-t', String(lines)], {
    serial,
    timeout: 20000
  })
  return out
}

// Pull a live screenshot straight to a PNG in the given directory.
async function screenshot(serial, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const buf = await runBinary(['exec-out', 'screencap', '-p'], { serial, timeout: 20000 })
  // Some Windows shells inject CRLF; screencap PNG is clean via exec-out, but guard anyway.
  const file = path.join(outDir, `screenshot_${stamp()}.png`)
  fs.writeFileSync(file, buf)
  return { path: file, size: buf.length, dataUrl: 'data:image/png;base64,' + buf.toString('base64') }
}

// Content-provider queries. These succeed only when the device grants access
// (USB debugging authorized, and the provider is readable via shell uid).
const QUERIES = {
  calls: 'content://call_log/calls',
  sms: 'content://sms',
  contacts: 'content://com.android.contacts/data/phones'
}

async function query(serial, kind) {
  const uri = QUERIES[kind]
  if (!uri) throw new Error('Unknown query: ' + kind)
  const out = await run(['shell', 'content', 'query', '--uri', uri], { serial, timeout: 25000 })
  // adb content query prints one row per line: "Row: N key=val, key=val, ..."
  const rows = []
  for (const line of out.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('Row:')) continue
    const body = t.replace(/^Row:\s*\d+\s*/, '')
    const obj = {}
    // split on ", key=" boundaries (values may contain commas)
    const parts = body.split(/,\s(?=[A-Za-z0-9_]+=)/)
    for (const p of parts) {
      const eq = p.indexOf('=')
      if (eq > 0) obj[p.slice(0, eq).trim()] = p.slice(eq + 1)
    }
    rows.push(obj)
  }
  return { kind, uri, count: rows.length, rows, raw: out.length > 200000 ? '' : out }
}

async function pull(serial, remote, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const base = path.basename(remote) || 'pulled'
  const dest = path.join(outDir, base)
  await run(['pull', remote, dest], { serial, timeout: 120000 })
  return { path: dest }
}

// A convenience "logical acquisition": snapshot device info, package list,
// a screenshot and recent logcat into a timestamped folder.
async function logicalAcquire(serial, outDir) {
  const dir = path.join(outDir, `android_${serial.replace(/[^\w.-]/g, '_')}_${stamp()}`)
  fs.mkdirSync(dir, { recursive: true })
  const written = []

  const inf = await info(serial).catch((e) => ({ error: e.message }))
  fs.writeFileSync(path.join(dir, 'device_info.json'), JSON.stringify(inf, null, 2))
  written.push('device_info.json')

  const pk = await packages(serial).catch((e) => ({ error: e.message }))
  fs.writeFileSync(path.join(dir, 'packages.json'), JSON.stringify(pk, null, 2))
  written.push('packages.json')

  const lg = await logcat(serial, 2000).catch((e) => 'logcat error: ' + e.message)
  fs.writeFileSync(path.join(dir, 'logcat.txt'), lg)
  written.push('logcat.txt')

  try {
    const shot = await screenshot(serial, dir)
    written.push(path.basename(shot.path))
  } catch (e) {
    fs.writeFileSync(path.join(dir, 'screenshot_error.txt'), e.message)
  }

  for (const kind of ['calls', 'sms', 'contacts']) {
    try {
      const q = await query(serial, kind)
      fs.writeFileSync(path.join(dir, `${kind}.json`), JSON.stringify(q, null, 2))
      written.push(`${kind}.json`)
    } catch (e) {
      fs.writeFileSync(path.join(dir, `${kind}_error.txt`), e.message)
    }
  }

  return { dir, written }
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`
}

module.exports = {
  available,
  devices,
  info,
  packages,
  logcat,
  screenshot,
  query,
  pull,
  logicalAcquire
}
