import React, { useEffect, useState } from 'react'
import { call, fmtSize, fmtDate, shortHash, useToast, Empty, Spinner, Icon } from '../ui'

export default function PcView({ activeCaseId }) {
  const toast = useToast()
  const [drives, setDrives] = useState([])
  const [browse, setBrowse] = useState(null)
  const [tab, setTab] = useState('browse')
  const [busy, setBusy] = useState('')
  const [scan, setScan] = useState(null)
  const [timeline, setTimeline] = useState(null)
  const [hashResult, setHashResult] = useState(null)

  const loadDrives = async () => {
    try {
      setDrives(await call(window.api.pc.drives()))
    } catch (e) {
      toast(e.message, 'bad')
    }
  }
  useEffect(() => {
    loadDrives()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = async (dir) => {
    setBusy('디렉터리 읽는 중…')
    try {
      const b = await call(window.api.pc.browse(dir))
      setBrowse(b)
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const pickFolder = async () => {
    const d = await window.api.openDir()
    if (d?.ok && d.data) go(d.data)
  }

  const hashOne = async (filePath) => {
    setBusy('파일 해싱 중…')
    setHashResult(null)
    try {
      const r = await call(window.api.pc.hash(filePath))
      setHashResult(r)
      setTab('hash')
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const runScan = async () => {
    if (!browse) return
    setBusy('스캔 중 (파일 유형·최대 파일·관심 아티팩트)…')
    setTab('scan')
    try {
      setScan(await call(window.api.pc.scan(browse.dir)))
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const runTimeline = async () => {
    if (!browse) return
    setBusy('MACB 타임라인 생성 중…')
    setTab('timeline')
    try {
      setTimeline(await call(window.api.pc.timeline(browse.dir, { maxEntries: 5000 })))
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
          <div className="title">PC / 디스크 포렌식</div>
          <div className="subtitle truncate" style={{ maxWidth: 520 }}>
            {browse?.dir || '위치를 선택하세요'}
          </div>
        </div>
        <div className="spacer" />
        <div className="toolbar-actions">
          {busy && <Spinner label={busy} />}
          <button className="btn btn-sm" onClick={pickFolder}>
            폴더 열기…
          </button>
          {browse && (
            <>
              <button className="btn btn-sm" onClick={runScan}>
                빠른 스캔
              </button>
              <button className="btn btn-sm" onClick={runTimeline}>
                타임라인
              </button>
            </>
          )}
        </div>
      </div>

      <div className="content pad-0" style={{ display: 'grid', gridTemplateColumns: '220px 1fr' }}>
        <div
          style={{
            borderRight: '0.5px solid var(--sep)',
            overflow: 'auto',
            padding: 12,
            background: 'var(--bg)'
          }}
        >
          <div className="side-group-label" style={{ paddingLeft: 4 }}>
            볼륨
          </div>
          {drives.map((d) => (
            <div
              key={d.path}
              className="list-row"
              style={{ borderRadius: 8, marginBottom: 4, border: '0.5px solid var(--sep)' }}
              onClick={() => go(d.path)}
            >
              <span className="ic" style={{ color: 'var(--accent)' }}>
                <Icon.pc />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate">
                  <strong>{d.path}</strong> {d.label ? <span className="hint">{d.label}</span> : ''}
                </div>
                {d.size != null && (
                  <div className="hint">
                    여유 {fmtSize(d.free)} / {fmtSize(d.size)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ overflow: 'auto', padding: 0 }}>
          {!browse ? (
            <div style={{ padding: 18 }}>
              <Empty icon="🗄️" msg="볼륨이나 폴더를 선택하세요" sub="탐색·해시·스캔·타임라인을 실행할 수 있습니다." />
            </div>
          ) : (
            <>
              <div
                className="row"
                style={{
                  padding: '10px 16px',
                  borderBottom: '0.5px solid var(--sep)',
                  gap: 10,
                  position: 'sticky',
                  top: 0,
                  background: 'var(--bg-content)',
                  zIndex: 2
                }}
              >
                <div className="seg">
                  {[
                    ['browse', '탐색'],
                    ['scan', '스캔'],
                    ['timeline', '타임라인'],
                    ['hash', '해시']
                  ].map(([k, l]) => (
                    <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="spacer" />
                <button className="btn btn-sm" onClick={() => go(browse.parent)}>
                  ↑ 상위
                </button>
              </div>

              <div style={{ padding: 18 }}>
                {tab === 'browse' && (
                  <Browser browse={browse} go={go} hashOne={hashOne} />
                )}
                {tab === 'scan' && <ScanView scan={scan} busy={busy} />}
                {tab === 'timeline' && <TimelineView timeline={timeline} busy={busy} />}
                {tab === 'hash' && <HashView hashResult={hashResult} busy={busy} />}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Browser({ browse, go, hashOne }) {
  return (
    <div className="list-card">
      <table className="table">
        <thead>
          <tr>
            <th>이름</th>
            <th className="num">크기</th>
            <th>수정일</th>
            <th>생성일</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {browse.entries.map((e) => (
            <tr key={e.path}>
              <td>
                <span
                  className="row"
                  style={{ gap: 8, cursor: 'default' }}
                  onDoubleClick={() => e.type === 'dir' && go(e.path)}
                >
                  <span style={{ color: 'var(--accent)', display: 'flex' }}>
                    {e.type === 'dir' ? <Icon.folder /> : <Icon.file />}
                  </span>
                  {e.type === 'dir' ? (
                    <a
                      style={{ color: 'var(--text)', cursor: 'default' }}
                      onClick={() => go(e.path)}
                    >
                      <strong>{e.name}</strong>
                    </a>
                  ) : (
                    <span>{e.name}</span>
                  )}
                </span>
              </td>
              <td className="num">{e.type === 'file' ? fmtSize(e.size) : '—'}</td>
              <td className="hint mono" style={{ fontSize: 11 }}>
                {fmtDate(e.mtime)}
              </td>
              <td className="hint mono" style={{ fontSize: 11 }}>
                {fmtDate(e.birthtime || e.ctime)}
              </td>
              <td className="num">
                {e.type === 'file' && (
                  <button className="btn btn-sm ghost" onClick={() => hashOne(e.path)}>
                    <span className="row" style={{ gap: 4 }}>
                      <Icon.hash /> 해시
                    </span>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScanView({ scan, busy }) {
  if (busy && !scan) return <Spinner label="스캔 중…" />
  if (!scan) return <Empty icon="🔬" msg="빠른 스캔 실행" sub="툴바에서 빠른 스캔을 누르세요." />
  return (
    <>
      <div className="grid2">
        <div className="card" style={{ margin: 0 }}>
          <h3>요약</h3>
          <div className="kv">
            <div className="k">파일</div>
            <div className="v">{scan.files.toLocaleString()}</div>
            <div className="k">폴더</div>
            <div className="v">{scan.dirs.toLocaleString()}</div>
            <div className="k">전체 크기</div>
            <div className="v">{fmtSize(scan.bytes)}</div>
            {scan.truncated && (
              <>
                <div className="k">참고</div>
                <div className="v badge warn">한도에서 스캔이 잘렸습니다</div>
              </>
            )}
          </div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h3>파일 유형</h3>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            <table className="table">
              <tbody>
                {scan.extTable.map((r) => (
                  <tr key={r.ext}>
                    <td className="mono">{r.ext}</td>
                    <td className="num">{r.count}</td>
                    <td className="num hint">{fmtSize(r.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {scan.interesting.length > 0 && (
        <div className="card">
          <h3>관심 아티팩트 ({scan.interesting.length})</h3>
          <p className="hint" style={{ marginBottom: 8 }}>
            데이터베이스·로그·메일 저장소·디스크 이미지·키, 그리고 크리덴셜 관련 이름의 파일.
          </p>
          <div style={{ maxHeight: 260, overflow: 'auto' }}>
            <table className="table">
              <tbody>
                {scan.interesting.map((f) => (
                  <tr key={f.path}>
                    <td className="truncate mono" style={{ fontSize: 11 }} title={f.path}>
                      {f.path}
                    </td>
                    <td className="num">{fmtSize(f.size)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h3>최대 파일</h3>
        <table className="table">
          <tbody>
            {scan.largest.map((f) => (
              <tr key={f.path}>
                <td className="truncate mono" style={{ fontSize: 11 }} title={f.path}>
                  {f.path}
                </td>
                <td className="num">{fmtSize(f.size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function TimelineView({ timeline, busy }) {
  if (busy && !timeline) return <Spinner label="타임라인 생성 중…" />
  if (!timeline) return <Empty icon="🕰️" msg="타임라인 실행" sub="툴바에서 타임라인을 누르세요." />
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>
          MACB 타임라인 — 파일 {timeline.count.toLocaleString()}개 (수정일 기준)
        </h3>
        {timeline.truncated && <span className="badge warn">잘림</span>}
      </div>
      <div style={{ maxHeight: 520, overflow: 'auto', marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>수정</th>
              <th>생성</th>
              <th>접근</th>
              <th className="num">크기</th>
              <th>경로</th>
            </tr>
          </thead>
          <tbody>
            {timeline.events.slice(0, 2000).map((e, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                  {fmtDate(e.modified)}
                </td>
                <td className="mono hint" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                  {fmtDate(e.born || e.changed)}
                </td>
                <td className="mono hint" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                  {fmtDate(e.accessed)}
                </td>
                <td className="num">{fmtSize(e.size)}</td>
                <td className="truncate mono" style={{ fontSize: 11 }} title={e.path}>
                  {e.name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HashView({ hashResult, busy }) {
  if (busy && !hashResult) return <Spinner label="해싱 중…" />
  if (!hashResult)
    return <Empty icon="#️⃣" msg="해시 없음" sub="탐색 탭에서 파일의 해시 버튼을 누르세요." />
  return (
    <div className="card">
      <h3>파일 해시</h3>
      <div className="kv">
        <div className="k">경로</div>
        <div className="v mono" style={{ fontSize: 11 }}>
          {hashResult.path}
        </div>
        <div className="k">크기</div>
        <div className="v">{fmtSize(hashResult.size)}</div>
        <div className="k">수정일</div>
        <div className="v">{fmtDate(hashResult.mtime)}</div>
        <div className="k">SHA-256</div>
        <div className="v mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
          {hashResult.sha256}
        </div>
        <div className="k">MD5</div>
        <div className="v mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
          {hashResult.md5}
        </div>
      </div>
    </div>
  )
}
