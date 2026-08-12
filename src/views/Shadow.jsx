import React, { useEffect, useState } from 'react'
import { call, fmtSize, fmtDate, useToast, Empty, Spinner, Loading, Icon } from '../ui'

export default function ShadowView() {
  const toast = useToast()
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [snaps, setSnaps] = useState([])
  const [error, setError] = useState(null)
  const [snap, setSnap] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const isAdmin = await call(window.api.isAdmin())
      setAdmin(isAdmin)
      if (isAdmin) {
        const r = await call(window.api.vss.list())
        setSnaps(r.snapshots || [])
        setError(r.error || null)
        if (r.snapshots?.length) setSnap(r.snapshots[0])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="toolbar">
        <div style={{ marginLeft: 8 }}>
          <div className="title">이전 버전에서 복구</div>
          <div className="subtitle">
            {admin === false ? '관리자 권한 필요' : `복원 지점 ${snaps.length}개`}
          </div>
        </div>
        <div className="spacer" />
        <div className="toolbar-actions">
          <button className="btn btn-sm" onClick={load} title="새로고침">
            <Icon.refresh />
          </button>
        </div>
      </div>

      {(loading || admin === false || snaps.length === 0) && (
        <div className="content">
          {loading ? (
            <Loading label="복원 지점을 확인하는 중…" />
          ) : admin === false ? (
            <AdminGate toast={toast} />
          ) : (
            <Empty
              icon="🕰️"
              msg="복원 지점이 없어요"
              sub="Windows '시스템 보호'가 켜져 있어야 예전 파일 버전을 찾을 수 있습니다."
            />
          )}
        </div>
      )}

      {!loading && admin && snaps.length > 0 && (
        <div className="content pad-0" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', flex: 1 }}>
          <div
            style={{
              borderRight: '0.5px solid var(--sep)',
              overflow: 'auto',
              padding: 12,
              background: 'var(--bg)'
            }}
          >
            <div className="side-group-label" style={{ paddingLeft: 4 }}>
              복원 지점 (최신순)
            </div>
            {snaps.map((s) => (
              <div
                key={s.id}
                className={'list-row' + (snap?.id === s.id ? ' active' : '')}
                style={{ borderRadius: 8, marginBottom: 4, border: '0.5px solid var(--sep)' }}
                onClick={() => setSnap(s)}
              >
                <span className="ic" style={{ color: 'var(--accent)' }}>
                  <Icon.clock />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="truncate" style={{ fontWeight: 500 }}>
                    {fmtDate(s.installedAt)}
                  </div>
                  <div className="hint truncate" style={{ fontSize: 11 }}>
                    {s.volume || '스냅샷'}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ overflow: 'auto', padding: 18 }}>
            {snap ? <Browser snap={snap} toast={toast} /> : <Empty icon="📅" msg="복원 지점을 선택하세요" />}
          </div>
        </div>
      )}
    </>
  )
}

function AdminGate({ toast }) {
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <h3>관리자 권한이 필요해요</h3>
      <p className="hint" style={{ lineHeight: 1.7 }}>
        Windows의 <strong>복원 지점(볼륨 섀도 복사본)</strong>을 읽으려면 관리자 권한으로 실행해야
        합니다. 아래 버튼을 누르면 권한 요청 후 앱이 다시 시작됩니다. 여기서는 예전에 지운 파일을
        <strong> 이름 그대로 </strong>되찾을 수 있어요.
      </p>
      <button
        className="btn primary"
        style={{ marginTop: 12 }}
        onClick={() => {
          toast('권한 요청 중…')
          window.api.relaunchElevated()
        }}
      >
        관리자 권한으로 다시 실행
      </button>
    </div>
  )
}

function Browser({ snap, toast }) {
  const [sub, setSub] = useState('')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [quick, setQuick] = useState([])

  const go = async (path) => {
    setBusy(true)
    try {
      const r = await call(window.api.vss.browse(snap.device, path))
      setData(r)
      setSub(r.sub)
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    window.api.vss.quickPaths().then((r) => r.ok && setQuick(r.data))
    go('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.id])

  const up = () => {
    const parts = sub.split('\\').filter(Boolean)
    parts.pop()
    go(parts.join('\\'))
  }

  const restore = async (file) => {
    const dir = await window.api.openDir()
    if (!dir?.ok || !dir.data) return
    try {
      const r = await call(window.api.vss.restore(snap.device, file.sub, dir.data))
      toast('복구했습니다: ' + r.path.split('\\').pop())
      await window.api.showItem(r.path)
    } catch (e) {
      toast(e.message, 'bad')
    }
  }

  const crumbs = ['(루트)', ...sub.split('\\').filter(Boolean)]

  return (
    <>
      <div className="row" style={{ marginBottom: 4 }}>
        <div className="seg">
          {quick.map((q) => (
            <button key={q.sub} onClick={() => go(q.sub)}>
              {q.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button className="btn btn-sm" disabled={!sub} onClick={up}>
          ↑ 상위
        </button>
      </div>

      <div className="hint mono" style={{ margin: '4px 2px 12px', fontSize: 11 }}>
        {crumbs.join(' / ')}
      </div>

      {busy ? (
        <Spinner label="여는 중…" />
      ) : !data ? (
        <Empty icon="📂" msg="폴더를 선택하세요" />
      ) : (
        <div className="list-card">
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th className="num">크기</th>
                <th>수정일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.dirs.map((d) => (
                <tr key={d.sub} onDoubleClick={() => go(d.sub)} style={{ cursor: 'default' }}>
                  <td>
                    <span className="row" style={{ gap: 8 }}>
                      <Icon.folder /> <strong>{d.name}</strong>
                    </span>
                  </td>
                  <td className="num hint">폴더</td>
                  <td className="hint">{fmtDate(d.mtime)}</td>
                  <td className="num">
                    <button className="btn btn-sm ghost" onClick={() => go(d.sub)}>
                      열기
                    </button>
                  </td>
                </tr>
              ))}
              {data.files.map((f) => (
                <tr key={f.sub}>
                  <td className="truncate" style={{ maxWidth: 360 }}>
                    {f.name}
                  </td>
                  <td className="num">{fmtSize(f.size)}</td>
                  <td className="hint">{fmtDate(f.mtime)}</td>
                  <td className="num">
                    <button className="btn btn-sm" onClick={() => restore(f)}>
                      복구
                    </button>
                  </td>
                </tr>
              ))}
              {!data.dirs.length && !data.files.length && (
                <tr>
                  <td colSpan={4} className="hint" style={{ textAlign: 'center', padding: 24 }}>
                    빈 폴더입니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
