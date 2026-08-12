const fs = require('fs')
const path = require('path')

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtSize(n) {
  if (n == null) return ''
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = Number(n)
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`
}

// Produce a self-contained HTML report for a case and write it into the case folder.
function generate(c, evDir) {
  const evidence = c.evidence || []
  const log = c.log || []

  const evRows = evidence
    .map(
      (e, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td>${esc(e.originalName)}</td>
        <td class="mono small">${esc(e.originalPath)}</td>
        <td class="num">${fmtSize(e.size)}</td>
        <td class="mono small">${esc(e.sha256)}</td>
        <td>${e.lastVerify && e.lastVerify.ok ? '<span class="ok">✓ 검증됨</span>' : '<span class="bad">✗ 불일치</span>'}</td>
        <td class="small">${esc((e.acquiredAt || '').replace('T', ' ').replace('Z', ''))}</td>
      </tr>`
    )
    .join('')

  const logRows = log
    .map(
      (l) => `
      <tr>
        <td class="small mono">${esc((l.ts || '').replace('T', ' ').replace('Z', ''))}</td>
        <td class="small">${esc(l.action)}</td>
        <td class="small">${esc(l.detail)}</td>
      </tr>`
    )
    .join('')

  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>포렌식 보고서 — ${esc(c.name)}</title>
<style>
  :root{--fg:#1d1d1f;--muted:#6e6e73;--line:#e3e3e6;--accent:#0a84ff;--ok:#1a8a3a;--bad:#c8102e;}
  *{box-sizing:border-box}
  body{font:14px/1.5 -apple-system,"SF Pro Text","Segoe UI",Roboto,sans-serif;color:var(--fg);margin:0;padding:40px;background:#fff}
  .wrap{max-width:1000px;margin:0 auto}
  h1{font-size:26px;margin:0 0 4px} h2{font-size:17px;margin:34px 0 12px;border-bottom:1px solid var(--line);padding-bottom:8px}
  .sub{color:var(--muted);margin-bottom:24px}
  .grid{display:grid;grid-template-columns:180px 1fr;gap:6px 18px;margin:10px 0}
  .grid .k{color:var(--muted)}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
  .mono{font-family:"SF Mono",ui-monospace,Menlo,Consolas,monospace}
  .small{font-size:12px} .num{text-align:right;white-space:nowrap}
  .ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}
  .badge{display:inline-block;background:#f2f2f4;border-radius:6px;padding:2px 8px;font-size:12px;color:var(--muted)}
  footer{margin-top:40px;color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:14px}
</style></head>
<body><div class="wrap">
  <h1>${esc(c.name)}</h1>
  <div class="sub">디지털 포렌식 보고서 · <span class="badge">${esc(c.status || 'open')}</span></div>

  <div class="grid">
    <div class="k">케이스 ID</div><div class="mono">${esc(c.id)}</div>
    <div class="k">조사자</div><div>${esc(c.investigator) || '—'}</div>
    <div class="k">대상 / 기기</div><div>${esc(c.subject) || '—'}</div>
    <div class="k">권한 근거</div><div>${esc(c.authorization) || '—'}</div>
    <div class="k">생성일</div><div>${esc((c.createdAt || '').replace('T', ' ').replace('Z', ''))}</div>
    <div class="k">보고서 생성</div><div>${new Date().toISOString().replace('T', ' ').replace('Z', '')}</div>
  </div>

  ${c.notes ? `<h2>메모</h2><p>${esc(c.notes).replace(/\n/g, '<br>')}</p>` : ''}

  <h2>증거 (${evidence.length})</h2>
  ${
    evidence.length
      ? `<table><thead><tr><th>#</th><th>이름</th><th>원본 경로</th><th>크기</th><th>SHA-256</th><th>무결성</th><th>수집일</th></tr></thead><tbody>${evRows}</tbody></table>`
      : '<p class="sub">기록된 증거가 없습니다.</p>'
  }

  <h2>연계 보관성 / 활동 로그</h2>
  <table><thead><tr><th>시각 (UTC)</th><th>동작</th><th>상세</th></tr></thead><tbody>${logRows}</tbody></table>

  <footer>
    Forensic Workbench로 생성됨. 무결성 열은 각 저장 아티팩트의 최신 SHA-256 재검증 결과를 반영합니다.
  </footer>
</div></body></html>`

  const out = path.join(evDir, '..', `report_${Date.now()}.html`)
  fs.writeFileSync(out, html, 'utf8')
  return { path: out }
}

module.exports = { generate }
