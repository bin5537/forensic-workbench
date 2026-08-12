import React, { useEffect, useState } from 'react'
import { call, fmtDate, useToast, Empty, Spinner, Icon } from '../ui'

export default function IosView() {
  const toast = useToast()
  const [root, setRoot] = useState('')
  const [backups, setBackups] = useState([])
  const [selected, setSelected] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [busy, setBusy] = useState('')

  const loadBackups = async (r) => {
    try {
      const list = await call(window.api.ios.listBackups(r))
      setBackups(list)
    } catch (e) {
      toast(e.message, 'bad')
    }
  }

  const init = async () => {
    try {
      const r = await call(window.api.ios.defaultBackupRoot())
      setRoot(r)
      await loadBackups(r)
    } catch (e) {
      toast(e.message, 'bad')
    }
  }
  useEffect(() => {
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickRoot = async () => {
    const d = await window.api.openDir()
    if (!d || !d.ok || !d.data) return
    setRoot(d.data)
    setSelected(null)
    setParsed(null)
    await loadBackups(d.data)
  }

  const openBackup = async (b) => {
    setSelected(b)
    setParsed(null)
    setBusy('백업 파싱 중 (Manifest.db·메시지·연락처·통화)…')
    try {
      const p = await call(window.api.ios.parse(b.path))
      setParsed(p)
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <div className="toolbar">
        <div style={{ marginLeft: 8 }}>
          <div className="title">iOS 백업 분석</div>
          <div className="subtitle truncate" style={{ maxWidth: 480 }}>
            {root || '백업 폴더 없음'}
          </div>
        </div>
        <div className="spacer" />
        <div className="toolbar-actions">
          {busy && <Spinner label={busy} />}
          <button className="btn btn-sm" onClick={() => loadBackups(root)} title="새로고침">
            <Icon.refresh />
          </button>
          <button className="btn btn-sm" onClick={pickRoot}>
            폴더 선택…
          </button>
        </div>
      </div>

      <div className="content pad-0" style={{ display: 'grid', gridTemplateColumns: '300px 1fr' }}>
        <div
          style={{
            borderRight: '0.5px solid var(--sep)',
            overflow: 'auto',
            padding: 12,
            background: 'var(--bg)'
          }}
        >
          <div className="side-group-label" style={{ paddingLeft: 4 }}>
            백업
          </div>
          {backups.length === 0 && (
            <Empty
              icon="💾"
              msg="백업을 찾을 수 없습니다"
              sub="비암호화 iTunes/Finder 백업이 있는 폴더를 선택하세요."
            />
          )}
          {backups.map((b) => (
            <div
              key={b.id}
              className={'list-row' + (selected?.id === b.id ? ' active' : '')}
              style={{ borderRadius: 8, marginBottom: 4, border: '0.5px solid var(--sep)' }}
              onClick={() => openBackup(b)}
            >
              <span className="ic" style={{ color: 'var(--accent)' }}>
                <Icon.ios />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate">
                  <strong>{b.deviceName || b.id.slice(0, 12)}</strong>
                </div>
                <div className="hint truncate">
                  {b.productType || '기기'} · iOS {b.iosVersion || '?'}
                </div>
              </div>
              {b.encrypted && <span className="badge warn">암호화</span>}
            </div>
          ))}
        </div>

        <div style={{ overflow: 'auto', padding: 18 }}>
          {!selected ? (
            <Empty icon="📦" msg="백업을 선택하세요" />
          ) : busy ? (
            <Spinner label={busy} />
          ) : selected.encrypted ? (
            <Empty
              icon="🔒"
              msg="암호화된 백업"
              sub="이 도구는 비암호화 백업만 파싱합니다. Finder/iTunes에서 백업 암호화를 해제하세요."
            />
          ) : !parsed ? (
            <Empty icon="⏳" msg="파싱 중…" />
          ) : (
            <ParsedView selected={selected} parsed={parsed} />
          )}
        </div>
      </div>
    </>
  )
}

function ParsedView({ selected, parsed }) {
  return (
    <>
      <h2 className="sec-title">{selected.deviceName || 'iOS 백업'}</h2>
      <p className="sec-sub">
        {selected.productType} · iOS {selected.iosVersion} · 최근 백업{' '}
        {fmtDate(selected.lastBackup)}
      </p>

      <div className="grid2">
        <div className="card" style={{ margin: 0 }}>
          <h3>백업 매니페스트</h3>
          <div className="kv">
            <div className="k">백업 내 파일 수</div>
            <div className="v">{(parsed.fileCount || 0).toLocaleString()}</div>
            <div className="k">경로</div>
            <div className="v mono" style={{ fontSize: 11 }}>
              {parsed.backupPath}
            </div>
          </div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h3>상위 도메인</h3>
          <div style={{ maxHeight: 150, overflow: 'auto' }}>
            <table className="table">
              <tbody>
                {(parsed.domains || []).map((d) => (
                  <tr key={d.domain}>
                    <td className="mono truncate" style={{ fontSize: 11 }}>
                      {d.domain}
                    </td>
                    <td className="num">{d.c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {parsed.warnings?.length > 0 && (
        <div className="card">
          <h3>참고</h3>
          {parsed.warnings.map((w, i) => (
            <div key={i} className="hint">
              • {w}
            </div>
          ))}
        </div>
      )}

      {Object.entries(parsed.tables || {}).map(([label, t]) => (
        <TableCard key={label} label={label} data={t} />
      ))}
    </>
  )
}

function TableCard({ label, data }) {
  const rows = data.sample || []
  const cols = rows.length ? Object.keys(rows[0]) : []
  return (
    <div className="card">
      <h3>
        {label} ({data.count?.toLocaleString?.() ?? data.count})
      </h3>
      {rows.length === 0 ? (
        <p className="hint">샘플 행이 없습니다.</p>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: 360 }}>
          <table className="table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map((c) => (
                    <td key={c} className="truncate" title={String(r[c] ?? '')}>
                      {String(r[c] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
