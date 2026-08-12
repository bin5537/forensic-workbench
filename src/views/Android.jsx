import React, { useEffect, useState } from 'react'
import { call, fmtDate, useToast, Empty, Spinner, Icon } from '../ui'

export default function AndroidView({ activeCaseId }) {
  const toast = useToast()
  const [adb, setAdb] = useState(null)
  const [devices, setDevices] = useState([])
  const [serial, setSerial] = useState(null)
  const [tab, setTab] = useState('info')
  const [busy, setBusy] = useState('')

  const [info, setInfo] = useState(null)
  const [packages, setPackages] = useState(null)
  const [logcat, setLogcat] = useState('')
  const [query, setQuery] = useState({ kind: null, data: null })
  const [shot, setShot] = useState(null)

  const checkAdb = async () => {
    try {
      const a = await call(window.api.adb.available())
      setAdb(a)
      if (a.available) refreshDevices()
    } catch (e) {
      setAdb({ available: false, error: e.message })
    }
  }
  useEffect(() => {
    checkAdb()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshDevices = async () => {
    try {
      const d = await call(window.api.adb.devices())
      setDevices(d)
      if (d.length && !serial) selectDevice(d[0])
      if (!d.length) setSerial(null)
    } catch (e) {
      toast(e.message, 'bad')
    }
  }

  const selectDevice = (d) => {
    setSerial(d.serial)
    setInfo(null)
    setPackages(null)
    setLogcat('')
    setQuery({ kind: null, data: null })
    setShot(null)
    if (d.state === 'device') loadInfo(d.serial)
  }

  const loadInfo = async (s) => {
    setBusy('기기 속성 읽는 중…')
    try {
      setInfo(await call(window.api.adb.info(s)))
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const loadPackages = async () => {
    setBusy('설치된 앱 목록 불러오는 중…')
    try {
      setPackages(await call(window.api.adb.packages(serial)))
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const loadLogcat = async () => {
    setBusy('logcat 가져오는 중…')
    try {
      setLogcat(await call(window.api.adb.logcat(serial, 800)))
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const runQuery = async (kind) => {
    setBusy(`${kind} 조회 중…`)
    try {
      const data = await call(window.api.adb.query(serial, kind))
      setQuery({ kind, data })
    } catch (e) {
      toast(`${kind}: ${e.message}`, 'bad')
      setQuery({ kind, data: { error: e.message, rows: [] } })
    } finally {
      setBusy('')
    }
  }

  const takeScreenshot = async () => {
    const dir = await window.api.openDir()
    if (!dir || !dir.ok || !dir.data) return
    setBusy('화면 캡처 중…')
    try {
      const r = await call(window.api.adb.screenshot(serial, dir.data))
      setShot(r)
      toast('스크린샷을 저장했습니다')
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const acquire = async () => {
    const dir = await window.api.openDir()
    if (!dir || !dir.ok || !dir.data) return
    setBusy('논리적 수집 중… (기기정보·앱·logcat·스크린샷·통화/SMS/연락처)')
    try {
      const r = await call(window.api.adb.acquire(serial, dir.data))
      toast(`아티팩트 ${r.written.length}건을 수집했습니다`)
      await window.api.openPath(r.dir)
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const dev = devices.find((d) => d.serial === serial)
  const ready = dev && dev.state === 'device'

  if (adb && !adb.available) {
    return (
      <>
        <Toolbar title="안드로이드" subtitle="ADB를 찾을 수 없음" busy={busy} onRefresh={checkAdb} />
        <div className="content">
          <Empty
            icon="🤖"
            msg="ADB를 사용할 수 없습니다"
            sub="Android platform-tools를 설치하고 adb를 PATH에 추가하세요."
          />
          <div className="card">
            <div className="hint mono">{adb.error}</div>
            <div className="hint" style={{ marginTop: 8 }}>
              adb 탐색 경로: <span className="mono">{adb.path}</span>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Toolbar
        title="안드로이드 수집"
        subtitle={
          adb ? `adb ${adb.version} · 기기 ${devices.length}대` : 'adb 확인 중…'
        }
        busy={busy}
        onRefresh={refreshDevices}
        right={
          ready && (
            <button className="btn primary btn-sm" onClick={acquire}>
              논리적 수집
            </button>
          )
        }
      />

      <div className="content pad-0" style={{ display: 'grid', gridTemplateColumns: '260px 1fr' }}>
        {/* devices */}
        <div
          style={{
            borderRight: '0.5px solid var(--sep)',
            overflow: 'auto',
            padding: 12,
            background: 'var(--bg)'
          }}
        >
          <div className="side-group-label" style={{ paddingLeft: 4 }}>
            연결된 기기
          </div>
          {devices.length === 0 && (
            <Empty
              icon="🔌"
              msg="기기 없음"
              sub="USB 디버깅을 켜고 이 컴퓨터를 신뢰한 뒤 새로고침하세요."
            />
          )}
          {devices.map((d) => (
            <div
              key={d.serial}
              className={'list-row' + (serial === d.serial ? ' active' : '')}
              style={{ borderRadius: 8, marginBottom: 4, border: '0.5px solid var(--sep)' }}
              onClick={() => selectDevice(d)}
            >
              <span className="ic" style={{ color: 'var(--accent)' }}>
                <Icon.android />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="truncate">
                  <strong>{d.model || d.serial}</strong>
                </div>
                <div className="hint mono truncate">{d.serial}</div>
              </div>
              <span className={'pill-state ' + (d.state === 'device' ? 'device' : d.state)}>
                {d.state}
              </span>
            </div>
          ))}
          {activeCaseId && (
            <div className="hint" style={{ marginTop: 10, padding: '0 4px' }}>
              팁: 저장한 아티팩트는 케이스 탭에서 활성 케이스에 첨부할 수 있습니다.
            </div>
          )}
        </div>

        {/* detail */}
        <div style={{ overflow: 'auto', padding: 18 }}>
          {!serial ? (
            <Empty icon="📱" msg="기기를 선택하세요" />
          ) : !ready ? (
            <Empty
              icon="⚠️"
              msg={`기기 상태: "${dev?.state}"`}
              sub="기기의 USB 디버깅 허용 창을 승인한 뒤 새로고침하세요."
            />
          ) : (
            <>
              <div className="seg" style={{ marginBottom: 16 }}>
                {[
                  ['info', '개요'],
                  ['data', '통화 / SMS / 연락처'],
                  ['packages', '앱'],
                  ['logcat', 'Logcat'],
                  ['screen', '스크린샷']
                ].map(([k, label]) => (
                  <button
                    key={k}
                    className={tab === k ? 'on' : ''}
                    onClick={() => {
                      setTab(k)
                      if (k === 'packages' && !packages) loadPackages()
                      if (k === 'logcat' && !logcat) loadLogcat()
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'info' && <Overview info={info} />}
              {tab === 'data' && (
                <DataTab query={query} runQuery={runQuery} />
              )}
              {tab === 'packages' && <Packages packages={packages} reload={loadPackages} />}
              {tab === 'logcat' && <Logcat logcat={logcat} reload={loadLogcat} />}
              {tab === 'screen' && <Screenshot shot={shot} take={takeScreenshot} />}
            </>
          )}
        </div>
      </div>
    </>
  )
}

function Toolbar({ title, subtitle, busy, onRefresh, right }) {
  return (
    <div className="toolbar">
      <div style={{ marginLeft: 8 }}>
        <div className="title">{title}</div>
        <div className="subtitle">{subtitle}</div>
      </div>
      <div className="spacer" />
      <div className="toolbar-actions">
        {busy && <Spinner label={busy} />}
        <button className="btn btn-sm" onClick={onRefresh} title="새로고침">
          <Icon.refresh />
        </button>
        {right}
      </div>
    </div>
  )
}

function Overview({ info }) {
  if (!info) return <Spinner label="기기 정보 불러오는 중…" />
  const s = info.summary
  return (
    <div className="card">
      <h3>기기 개요</h3>
      <div className="kv">
        {[
          ['제조사', s.manufacturer],
          ['모델', s.model],
          ['안드로이드', `${s.androidVersion} (SDK ${s.sdk})`],
          ['보안 패치', s.securityPatch],
          ['빌드', s.buildId],
          ['시리얼', s.serialno],
          ['하드웨어', s.hardware],
          ['부트로더', s.bootloader],
          ['시간대', s.timezone],
          ['로케일', s.locale],
          ['핑거프린트', s.fingerprint]
        ].map(([k, v]) => (
          <React.Fragment key={k}>
            <div className="k">{k}</div>
            <div className="v mono" style={{ fontSize: 12 }}>
              {v || '—'}
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="hint" style={{ marginTop: 10 }}>
        <span className="mono">getprop</span>으로 시스템 속성 {info.propCount}개를 읽었습니다.
      </div>
    </div>
  )
}

function DataTab({ query, runQuery }) {
  const kinds = [
    ['calls', '통화 기록', Icon.phone],
    ['sms', '메시지', Icon.message],
    ['contacts', '연락처', Icon.cases]
  ]
  const rows = query.data?.rows || []
  const cols = rows.length ? Object.keys(rows[0]).slice(0, 8) : []
  return (
    <>
      <div className="card">
        <h3>콘텐츠 프로바이더</h3>
        <p className="hint" style={{ marginBottom: 12 }}>
          <span className="mono">adb shell content query</span>로 읽습니다. 기기에 따라 접근이
          제한되어 일부 프로바이더는 오류를 반환할 수 있습니다.
        </p>
        <div className="row">
          {kinds.map(([k, label, IconC]) => (
            <button
              key={k}
              className={'btn btn-sm' + (query.kind === k ? ' primary' : '')}
              onClick={() => runQuery(k)}
            >
              <span className="row" style={{ gap: 6 }}>
                <IconC /> {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {query.data && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>
              {{ calls: '통화 기록', sms: '메시지', contacts: '연락처' }[query.kind] || query.kind}{' '}
              {query.data.error ? '' : `(${query.data.count})`}
            </h3>
          </div>
          {query.data.error ? (
            <div className="badge bad" style={{ marginTop: 10 }}>
              {query.data.error}
            </div>
          ) : rows.length === 0 ? (
            <p className="hint" style={{ marginTop: 10 }}>
              반환된 행이 없습니다.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 12, maxHeight: 420 }}>
              <table className="table">
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 300).map((r, i) => (
                    <tr key={i}>
                      {cols.map((c) => (
                        <td key={c} className="truncate" title={r[c]}>
                          {r[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Packages({ packages, reload }) {
  const [q, setQ] = useState('')
  if (!packages) return <Spinner label="앱 목록 불러오는 중…" />
  const filt = (arr) => arr.filter((p) => p.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>
          앱 — 사용자 {packages.thirdParty.length} · 시스템 {packages.system.length}
        </h3>
        <input
          className="field"
          style={{ width: 200 }}
          placeholder="검색…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="grid2">
        <div>
          <div className="side-group-label">서드파티</div>
          <div style={{ maxHeight: 380, overflow: 'auto' }}>
            {filt(packages.thirdParty).map((p) => (
              <div key={p} className="mono" style={{ padding: '3px 0', fontSize: 12 }}>
                {p}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="side-group-label">시스템</div>
          <div style={{ maxHeight: 380, overflow: 'auto' }}>
            {filt(packages.system).map((p) => (
              <div key={p} className="mono hint" style={{ padding: '3px 0', fontSize: 12 }}>
                {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Logcat({ logcat, reload }) {
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Logcat (최근 800줄)</h3>
        <button className="btn btn-sm" onClick={reload}>
          다시 불러오기
        </button>
      </div>
      <pre
        className="mono"
        style={{
          maxHeight: 480,
          overflow: 'auto',
          background: 'var(--field)',
          border: '0.5px solid var(--sep)',
          borderRadius: 8,
          padding: 12,
          fontSize: 11,
          whiteSpace: 'pre',
          userSelect: 'text'
        }}
      >
        {logcat || '(empty)'}
      </pre>
    </div>
  )
}

function Screenshot({ shot, take }) {
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>실시간 스크린샷</h3>
        <button className="btn primary btn-sm" onClick={take}>
          <span className="row" style={{ gap: 6 }}>
            <Icon.camera /> 캡처
          </span>
        </button>
      </div>
      {shot ? (
        <>
          <img
            src={shot.dataUrl}
            alt="device screenshot"
            style={{ maxWidth: '100%', borderRadius: 8, border: '0.5px solid var(--sep)' }}
          />
          <div className="hint mono" style={{ marginTop: 8 }}>
            {shot.path}
          </div>
        </>
      ) : (
        <p className="hint">
          <span className="mono">screencap</span>으로 기기 화면을 PNG로 바로 캡처합니다.
        </p>
      )}
    </div>
  )
}
