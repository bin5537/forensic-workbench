const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { hashFile } = require('./hash')

let ROOT = null // <userData>/cases
let INDEX = null // <userData>/cases/index.json

function init(userDataDir) {
  ROOT = path.join(userDataDir, 'cases')
  INDEX = path.join(ROOT, 'index.json')
  fs.mkdirSync(ROOT, { recursive: true })
  if (!fs.existsSync(INDEX)) writeJson(INDEX, [])
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2))
}

function caseDir(id) {
  return path.join(ROOT, id)
}
function caseFile(id) {
  return path.join(caseDir(id), 'case.json')
}
function evidenceDir(id) {
  return path.join(caseDir(id), 'evidence')
}

function nowIso() {
  return new Date().toISOString()
}
function newId(prefix) {
  return prefix + '_' + crypto.randomBytes(6).toString('hex')
}

function list() {
  const idx = readJson(INDEX, [])
  // Enrich with live evidence counts.
  return idx
    .map((row) => {
      const c = readJson(caseFile(row.id), null)
      if (!c) return null
      return {
        id: c.id,
        name: c.name,
        investigator: c.investigator,
        subject: c.subject,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        evidenceCount: (c.evidence || []).length
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

function create(meta) {
  const id = newId('case')
  const c = {
    id,
    name: meta.name || 'Untitled Case',
    investigator: meta.investigator || '',
    subject: meta.subject || '',
    authorization: meta.authorization || '', // consent / warrant / self-owned note
    notes: meta.notes || '',
    status: 'open',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    evidence: [],
    log: [{ ts: nowIso(), action: 'case.created', detail: c_name(meta) }]
  }
  fs.mkdirSync(evidenceDir(id), { recursive: true })
  writeJson(caseFile(id), c)
  const idx = readJson(INDEX, [])
  idx.push({ id })
  writeJson(INDEX, idx)
  return c
}
function c_name(meta) {
  return meta.name || 'Untitled Case'
}

function get(id) {
  const c = readJson(caseFile(id), null)
  if (!c) throw new Error('Case not found: ' + id)
  return c
}

function save(c) {
  c.updatedAt = nowIso()
  writeJson(caseFile(c.id), c)
  return c
}

function update(id, patch) {
  const c = get(id)
  const allowed = ['name', 'investigator', 'subject', 'authorization', 'notes', 'status']
  for (const k of allowed) if (k in patch) c[k] = patch[k]
  c.log.push({ ts: nowIso(), action: 'case.updated', detail: Object.keys(patch).join(', ') })
  return save(c)
}

function remove(id) {
  const dir = caseDir(id)
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  const idx = readJson(INDEX, []).filter((r) => r.id !== id)
  writeJson(INDEX, idx)
  return { removed: id }
}

// Copy a source file into the case evidence store, hash it, and record chain-of-custody.
async function addEvidence(id, filePath, note) {
  const c = get(id)
  const stat = fs.statSync(filePath)
  const evId = newId('ev')
  const base = path.basename(filePath)
  const destName = evId + '__' + base
  const dest = path.join(evidenceDir(id), destName)
  fs.mkdirSync(evidenceDir(id), { recursive: true })
  fs.copyFileSync(filePath, dest)

  const digest = await hashFile(dest)
  const ev = {
    id: evId,
    originalName: base,
    originalPath: filePath,
    storedAs: destName,
    note: note || '',
    size: digest.size,
    sha256: digest.sha256,
    md5: digest.md5,
    acquiredAt: nowIso(),
    sourceMtime: stat.mtime.toISOString(),
    lastVerify: { at: nowIso(), ok: true }
  }
  c.evidence.push(ev)
  c.log.push({
    ts: nowIso(),
    action: 'evidence.added',
    detail: `${base} sha256=${digest.sha256.slice(0, 16)}…`
  })
  save(c)
  return ev
}

// Re-hash a stored evidence file and compare to the recorded digest.
async function verifyEvidence(id, evId) {
  const c = get(id)
  const ev = (c.evidence || []).find((e) => e.id === evId)
  if (!ev) throw new Error('Evidence not found')
  const p = path.join(evidenceDir(id), ev.storedAs)
  const digest = await hashFile(p)
  const okMatch = digest.sha256 === ev.sha256
  ev.lastVerify = { at: nowIso(), ok: okMatch, sha256: digest.sha256 }
  c.log.push({
    ts: nowIso(),
    action: 'evidence.verified',
    detail: `${ev.originalName} → ${okMatch ? 'MATCH' : 'MISMATCH'}`
  })
  save(c)
  return { ok: okMatch, expected: ev.sha256, actual: digest.sha256 }
}

function removeEvidence(id, evId) {
  const c = get(id)
  const ev = (c.evidence || []).find((e) => e.id === evId)
  if (ev) {
    const p = path.join(evidenceDir(id), ev.storedAs)
    if (fs.existsSync(p)) fs.rmSync(p, { force: true })
    c.evidence = c.evidence.filter((e) => e.id !== evId)
    c.log.push({ ts: nowIso(), action: 'evidence.removed', detail: ev.originalName })
    save(c)
  }
  return { removed: evId }
}

module.exports = {
  init,
  list,
  create,
  get,
  update,
  remove,
  addEvidence,
  verifyEvidence,
  removeEvidence,
  evidenceDir
}
