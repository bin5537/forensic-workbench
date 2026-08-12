const fs = require('fs')
const path = require('path')
const os = require('os')

/* ======================================================================
 *  Digital footprint analysis — reads real, high-signal artifacts that
 *  need no admin: browser history/downloads/searches (Chromium SQLite via
 *  sql.js) and the Windows "Recent" list. Surfaces downloaded files that
 *  no longer exist on disk (i.e. deleted).
 * ==================================================================== */

let SQL = null
async function getSQL() {
  if (SQL) return SQL
  const initSqlJs = require('sql.js')
  const wasmPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm')
  SQL = await initSqlJs({ locateFile: () => wasmPath })
  return SQL
}

// Browser DBs are often locked while the browser runs — copy to temp first.
async function openCopy(file) {
  const tmp = path.join(os.tmpdir(), `fw_${Date.now()}_${path.basename(file)}`)
  fs.copyFileSync(file, tmp)
  try {
    const S = await getSQL()
    const db = new S.Database(fs.readFileSync(tmp))
    return db
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }
}

function rows(db, sql) {
  let res
  try {
    res = db.exec(sql)
  } catch {
    return []
  }
  if (!res.length) return []
  const { columns, values } = res[0]
  return values.map((v) => {
    const o = {}
    columns.forEach((c, i) => (o[c] = v[i]))
    return o
  })
}

// Chromium timestamps: microseconds since 1601-01-01.
function chromeTime(t) {
  if (!t) return null
  const ms = Number(t) / 1000 - 11644473600000
  return ms > 0 ? new Date(ms).toISOString() : null
}

function chromiumProfiles() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
  const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
  const bases = [
    ['Chrome', path.join(local, 'Google', 'Chrome', 'User Data')],
    ['Edge', path.join(local, 'Microsoft', 'Edge', 'User Data')],
    ['Brave', path.join(local, 'BraveSoftware', 'Brave-Browser', 'User Data')],
    ['Whale', path.join(local, 'Naver', 'Naver Whale', 'User Data')],
    ['Opera', path.join(roaming, 'Opera Software', 'Opera Stable')]
  ]
  const found = []
  for (const [name, base] of bases) {
    if (!fs.existsSync(base)) continue
    let profiles = []
    try {
      profiles = fs.readdirSync(base).filter((d) => {
        try {
          return (
            fs.statSync(path.join(base, d)).isDirectory() &&
            fs.existsSync(path.join(base, d, 'History'))
          )
        } catch {
          return false
        }
      })
    } catch {
      /* ignore */
    }
    // Opera stores History directly in the base folder.
    if (!profiles.length && fs.existsSync(path.join(base, 'History'))) profiles = ['']
    for (const prof of profiles) {
      found.push({
        browser: name,
        profile: prof || 'Default',
        historyPath: path.join(base, prof, 'History')
      })
    }
  }
  return found
}

async function readProfile(p) {
  const db = await openCopy(p.historyPath)
  try {
    const dl = rows(
      db,
      `SELECT target_path, tab_url, total_bytes, received_bytes, start_time, end_time, state
       FROM downloads ORDER BY start_time DESC LIMIT 200`
    ).map((r) => {
      const target = r.target_path || ''
      return {
        name: target ? path.basename(target) : '(unknown)',
        path: target,
        url: r.tab_url || '',
        size: r.total_bytes || r.received_bytes || 0,
        time: chromeTime(r.start_time),
        exists: target ? fs.existsSync(target) : false
      }
    })

    const sites = rows(
      db,
      `SELECT url, title, visit_count, last_visit_time FROM urls
       WHERE visit_count > 0 ORDER BY visit_count DESC LIMIT 40`
    ).map((r) => ({
      url: r.url,
      title: r.title || '',
      visits: r.visit_count,
      lastVisit: chromeTime(r.last_visit_time)
    }))

    const searches = rows(
      db,
      `SELECT kst.term AS term, u.last_visit_time AS t
       FROM keyword_search_terms kst JOIN urls u ON kst.url_id = u.id
       ORDER BY u.last_visit_time DESC LIMIT 60`
    ).map((r) => ({ term: r.term, time: chromeTime(r.t) }))

    return { ...p, downloads: dl, topSites: sites, searches }
  } finally {
    db.close()
  }
}

// Windows "Recent" — each .lnk name is the original file name; mtime ≈ last opened.
function recentFiles() {
  const dir = path.join(
    process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Microsoft',
    'Windows',
    'Recent'
  )
  const out = []
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.toLowerCase().endsWith('.lnk')) continue
      let st
      try {
        st = fs.statSync(path.join(dir, f))
      } catch {
        continue
      }
      out.push({ name: f.replace(/\.lnk$/i, ''), openedAt: st.mtime.toISOString(), ext: path.extname(f.replace(/\.lnk$/i, '')).toLowerCase() })
    }
  } catch {
    /* ignore */
  }
  out.sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1))
  return out.slice(0, 100)
}

async function digitalFootprint() {
  const profs = chromiumProfiles()
  const browsers = []
  for (const p of profs) {
    try {
      browsers.push(await readProfile(p))
    } catch (e) {
      browsers.push({ ...p, error: e.message })
    }
  }

  // Aggregate a few headline numbers.
  const allDownloads = browsers.flatMap((b) => b.downloads || [])
  const deletedDownloads = allDownloads.filter((d) => d.path && !d.exists)

  return {
    browsers,
    recent: recentFiles(),
    summary: {
      profiles: profs.length,
      downloads: allDownloads.length,
      deletedDownloads: deletedDownloads.length,
      sites: browsers.reduce((a, b) => a + (b.topSites?.length || 0), 0),
      searches: browsers.reduce((a, b) => a + (b.searches?.length || 0), 0)
    }
  }
}

module.exports = { digitalFootprint }
