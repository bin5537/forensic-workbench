import React, { useEffect, useMemo, useState } from 'react'
import { call, fmtSize, fmtDate, useToast, Empty, Spinner, Loading, Icon } from '../ui'

export default function AnalyzeView() {
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('downloads')
  const [onlyDeleted, setOnlyDeleted] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setData(await call(window.api.analyze.footprint()))
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const downloads = useMemo(() => {
    if (!data) return []
    const all = data.browsers.flatMap((b) =>
      (b.downloads || []).map((d) => ({ ...d, browser: b.browser }))
    )
    all.sort((a, b) => (a.time < b.time ? 1 : -1))
    return onlyDeleted ? all.filter((d) => d.path && !d.exists) : all
  }, [data, onlyDeleted])

  const sites = useMemo(() => {
    if (!data) return []
    return data.browsers
      .flatMap((b) => (b.topSites || []).map((s) => ({ ...s, browser: b.browser })))
      .sort((a, b) => b.visits - a.visits)
  }, [data])

  const searches = useMemo(() => {
    if (!data) return []
    return data.browsers
      .flatMap((b) => (b.searches || []).map((s) => ({ ...s, browser: b.browser })))
      .sort((a, b) => (a.time < b.time ? 1 : -1))
  }, [data])

  const s = data?.summary

  return (
    <>
      <div className="toolbar">
        <div style={{ marginLeft: 8 }}>
          <div className="title">PC 분석 · 디지털 발자국</div>
          <div className="subtitle">
            {loading ? '분석 중…' : `브라우저 프로필 ${s?.profiles || 0}개`}
          </div>
        </div>
        <div className="spacer" />
        <div className="toolbar-actions">
          <button className="btn btn-sm" onClick={load} title="다시 분석">
            <Icon.refresh />
          </button>
        </div>
      </div>

      <div className="content">
        {loading ? (
          <Loading label="브라우저 기록을 읽는 중… (다운로드·방문·검색어)" />
        ) : !data ? (
          <Empty icon="🔎" msg="분석할 데이터가 없어요" />
        ) : (
          <>
            {/* headline numbers */}
            <div className="kpi-grid" style={{ marginBottom: 18 }}>
              <Kpi accent big={s.deletedDownloads} label="삭제된 다운로드" sub={`전체 ${s.downloads}건 중`} />
              <Kpi big={s.downloads} label="다운로드 기록" />
              <Kpi big={s.sites} label="방문 사이트" />
              <Kpi big={s.searches} label="검색어" />
            </div>

            <div className="row" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
              <div className="seg">
                {[
                  ['downloads', `다운로드 (${downloads.length})`],
                  ['sites', `방문 사이트 (${sites.length})`],
                  ['searches', `검색어 (${searches.length})`],
                  ['recent', `최근 연 파일 (${data.recent.length})`]
                ].map(([k, l]) => (
                  <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                    {l}
                  </button>
                ))}
              </div>
              {tab === 'downloads' && (
                <label className="row" style={{ gap: 6, cursor: 'default' }}>
                  <input
                    type="checkbox"
                    checked={onlyDeleted}
                    onChange={(e) => setOnlyDeleted(e.target.checked)}
                  />
                  <span className="hint">삭제된 것만 보기</span>
                </label>
              )}
            </div>

            {data.browsers.some((b) => b.error) && (
              <div className="card" style={{ borderLeft: '3px solid var(--warn)' }}>
                <div className="hint">
                  일부 브라우저 기록을 읽지 못했어요(실행 중이면 잠길 수 있습니다). 해당 브라우저를
                  닫고 다시 분석해 보세요.
                </div>
              </div>
            )}

            {tab === 'downloads' && <Downloads rows={downloads} />}
            {tab === 'sites' && <Sites rows={sites} />}
            {tab === 'searches' && <Searches rows={searches} />}
            {tab === 'recent' && <Recent rows={data.recent} />}
          </>
        )}
      </div>
    </>
  )
}

function Kpi({ accent, big, label, sub }) {
  return (
    <div className={'kpi' + (accent ? ' accent' : '')}>
      <div className="kpi-num">{(big || 0).toLocaleString()}</div>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

function Downloads({ rows }) {
  if (!rows.length) return <Empty icon="📥" msg="다운로드 기록이 없어요" />
  return (
    <div className="list-card">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 68 }}>상태</th>
            <th>파일 이름</th>
            <th className="num">크기</th>
            <th>출처</th>
            <th>받은 시각</th>
            <th>브라우저</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr key={i}>
              <td>
                {d.path && !d.exists ? (
                  <span className="badge bad">삭제됨</span>
                ) : (
                  <span className="badge ok">있음</span>
                )}
              </td>
              <td>
                <strong>{d.name}</strong>
                <div className="hint mono truncate" style={{ fontSize: 10, maxWidth: 320 }} title={d.path}>
                  {d.path}
                </div>
              </td>
              <td className="num">{d.size ? fmtSize(d.size) : '—'}</td>
              <td className="truncate hint" style={{ maxWidth: 260 }} title={d.url}>
                {hostOf(d.url)}
              </td>
              <td className="hint mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {fmtDate(d.time)}
              </td>
              <td className="hint">{d.browser}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Sites({ rows }) {
  if (!rows.length) return <Empty icon="🌐" msg="방문 기록이 없어요" />
  return (
    <div className="list-card">
      <table className="table">
        <thead>
          <tr>
            <th className="num">방문</th>
            <th>제목</th>
            <th>주소</th>
            <th>마지막 방문</th>
            <th>브라우저</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={i}>
              <td className="num">
                <strong>{s.visits}</strong>
              </td>
              <td className="truncate" style={{ maxWidth: 280 }} title={s.title}>
                {s.title || '(제목 없음)'}
              </td>
              <td className="truncate hint mono" style={{ maxWidth: 260, fontSize: 11 }} title={s.url}>
                {s.url}
              </td>
              <td className="hint mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {fmtDate(s.lastVisit)}
              </td>
              <td className="hint">{s.browser}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Searches({ rows }) {
  if (!rows.length) return <Empty icon="🔍" msg="검색어 기록이 없어요" />
  return (
    <div className="list-card">
      <table className="table">
        <thead>
          <tr>
            <th>검색어</th>
            <th>시각</th>
            <th>브라우저</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={i}>
              <td>
                <strong>{s.term}</strong>
              </td>
              <td className="hint mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {fmtDate(s.time)}
              </td>
              <td className="hint">{s.browser}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Recent({ rows }) {
  if (!rows.length) return <Empty icon="🕘" msg="최근 연 파일 기록이 없어요" />
  return (
    <div className="list-card">
      <table className="table">
        <thead>
          <tr>
            <th>파일</th>
            <th>마지막 사용</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td className="hint mono" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                {fmtDate(r.openedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function hostOf(url) {
  if (!url) return ''
  try {
    return new URL(url).host
  } catch {
    return url.slice(0, 40)
  }
}
