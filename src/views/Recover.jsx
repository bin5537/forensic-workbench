import React, { useEffect, useState } from 'react'
import { call, fmtSize, fmtDate, useToast, Empty, Spinner, Loading, Icon } from '../ui'

export default function RecoverView() {
  const [mode, setMode] = useState(null) // null | 'recycle' | 'auto' | 'carve'
  const titles = {
    recycle: '휴지통에서 되살리기',
    auto: '내 PC에서 삭제된 사진 찾기',
    carve: '파일·이미지에서 되살리기'
  }
  return (
    <>
      <div className="toolbar">
        <div style={{ marginLeft: 8 }}>
          <div className="title">삭제된 파일 복구</div>
          <div className="subtitle">{mode ? titles[mode] : '되살리는 방법을 골라주세요'}</div>
        </div>
        <div className="spacer" />
        {mode && (
          <div className="toolbar-actions">
            <button className="btn btn-sm" onClick={() => setMode(null)}>
              ← 처음으로
            </button>
          </div>
        )}
      </div>

      <div className="content">
        {!mode && <Chooser setMode={setMode} />}
        {mode === 'recycle' && <RecycleFlow />}
        {mode === 'auto' && <AutoFlow />}
        {mode === 'carve' && <CarveFlow />}
      </div>
    </>
  )
}

function Chooser({ setMode }) {
  return (
    <>
      <div className="hero" style={{ paddingTop: 0 }}>
        <h1>어떤 파일을 되살릴까요?</h1>
        <p>상황에 맞는 방법을 고르면 차근차근 안내해 드려요.</p>
      </div>
      <div className="tile-grid">
        <div className="tile" onClick={() => setMode('auto')}>
          <div className="tile-ic g-pink">
            <Icon.wand />
          </div>
          <h3>내 PC에서 삭제된 사진 찾기</h3>
          <p>
            윈도우 썸네일·브라우저·메신저 캐시를 자동으로 뒤져, 지웠던 사진의 남은 흔적을 한 번에
            찾아냅니다. 관리자 권한 없이 바로 됩니다.
          </p>
          <div className="tile-stat">가장 추천 · 원클릭 ›</div>
        </div>
        <div className="tile" onClick={() => setMode('recycle')}>
          <div className="tile-ic g-blue">
            <Icon.trash />
          </div>
          <h3>휴지통에서 되살리기</h3>
          <p>휴지통에서 삭제했지만 아직 완전히 지워지지 않은 파일을 원래대로 복구합니다.</p>
          <div className="tile-stat">원본 그대로 ›</div>
        </div>
        <div className="tile" onClick={() => setMode('carve')}>
          <div className="tile-ic g-purple">
            <Icon.disk />
          </div>
          <h3>파일·이미지에서 되살리기</h3>
          <p>메모리카드·USB에서 만든 이미지 파일(.dd/.img)을 직접 훑어 사진·문서를 찾아냅니다.</p>
          <div className="tile-stat">고급 · 디스크 이미지 ›</div>
        </div>
      </div>
    </>
  )
}

/* ---- Recycle Bin flow ------------------------------------------------- */
function RecycleFlow() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [sel, setSel] = useState(new Set())
  const [busy, setBusy] = useState('')

  const scan = async () => {
    setLoading(true)
    try {
      const r = await call(window.api.recover.recycleBin())
      setItems(r.items)
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    scan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (id) => {
    const n = new Set(sel)
    n.has(id) ? n.delete(id) : n.add(id)
    setSel(n)
  }
  const allRecoverable = items.filter((i) => i.recoverable)

  const restore = async (list) => {
    const targets = list.filter((i) => i.recoverable)
    if (!targets.length) return toast('복구 가능한 파일이 없습니다', 'bad')
    const dir = await window.api.openDir()
    if (!dir?.ok || !dir.data) return
    setBusy(`${targets.length}개 복구 중…`)
    let done = 0
    try {
      for (const it of targets) {
        await call(window.api.recover.restore(it.recyclePath, it.name, dir.data))
        done++
      }
      toast(`${done}개 파일을 복구했습니다`)
      await window.api.openPath(dir.data)
    } catch (e) {
      toast(`${done}개 복구 후 오류: ${e.message}`, 'bad')
    } finally {
      setBusy('')
    }
  }

  if (loading) return <Loading label="휴지통을 살펴보는 중…" />

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>휴지통에서 찾은 파일 {items.length}건</h3>
            <p className="hint" style={{ marginTop: 4 }}>
              복구 가능 {allRecoverable.length}건 · 원하는 파일을 선택해 되살리세요.
            </p>
          </div>
          <div className="row">
            {busy && <Spinner label={busy} />}
            <button className="btn btn-sm" onClick={scan} title="다시 검사">
              <Icon.refresh />
            </button>
            <button
              className="btn btn-sm"
              disabled={!sel.size}
              onClick={() => restore(items.filter((i) => sel.has(i.id)))}
            >
              선택 복구
            </button>
            <button
              className="btn primary btn-sm"
              disabled={!allRecoverable.length}
              onClick={() => restore(items)}
            >
              전체 복구
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <Empty icon="🗑️" msg="휴지통이 비어 있어요" sub="되살릴 수 있는 삭제 파일이 없습니다." />
      ) : (
        <div className="list-card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 34 }}></th>
                <th>파일 이름</th>
                <th>원래 위치</th>
                <th className="num">크기</th>
                <th>삭제 시각</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} onClick={() => it.recoverable && toggle(it.id)}>
                  <td>
                    <input
                      type="checkbox"
                      checked={sel.has(it.id)}
                      disabled={!it.recoverable}
                      onChange={() => toggle(it.id)}
                    />
                  </td>
                  <td>
                    <strong>{it.name}</strong>
                  </td>
                  <td className="truncate hint mono" style={{ fontSize: 11 }} title={it.originalPath}>
                    {it.originalPath}
                  </td>
                  <td className="num">{fmtSize(it.size)}</td>
                  <td className="hint">{fmtDate(it.deletedAt)}</td>
                  <td>
                    {it.recoverable ? (
                      <span className="badge ok">복구 가능</span>
                    ) : (
                      <span className="badge bad">데이터 없음</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

/* ---- Auto scan (thumbnail / browser / messenger caches) --------------- */
function AutoFlow() {
  const toast = useToast()
  const [sources, setSources] = useState(null)
  const [chosen, setChosen] = useState(new Set())
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, scanned: 0 })
  const [result, setResult] = useState(null)

  useEffect(() => {
    window.api.recover.autoSources().then((r) => {
      if (r.ok) {
        setSources(r.data)
        setChosen(new Set(r.data.map((_, i) => i)))
      }
    })
    const off = window.api.recover.onProgress((p) => setProgress(p))
    return off
  }, [])

  const toggle = (i) => {
    const n = new Set(chosen)
    n.has(i) ? n.delete(i) : n.add(i)
    setChosen(n)
  }

  const start = async () => {
    const picked = (sources || []).filter((_, i) => chosen.has(i))
    if (!picked.length) return toast('검사할 위치를 하나 이상 선택하세요', 'bad')
    const outDir = await window.api.openDir()
    if (!outDir?.ok || !outDir.data) return
    setRunning(true)
    setProgress({ pct: 0, scanned: 0 })
    setResult(null)
    try {
      const r = await call(
        window.api.recover.autoScan(picked, outDir.data, { imagesOnly: true })
      )
      setResult({ ...r, outDir: r.outDir || outDir.data })
      toast(r.aborted ? `중지됨 · 사진 ${r.images}장` : `사진 ${r.images}장을 찾았습니다`)
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18 }}>✨</span>
          <div className="hint" style={{ lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>어떻게 찾나요?</strong> — 사진을 열어봤거나
            받았을 때 윈도우와 앱들이 남긴 <strong>썸네일·캐시</strong>를 뒤집니다. 원본을 지웠어도
            이 흔적은 남아 있는 경우가 많아요. 관리자 권한이 필요 없고 빠릅니다.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="step">
          <div className="n">1</div>
          <div style={{ flex: 1 }}>
            <strong>검사할 위치</strong>
            <p className="hint" style={{ marginTop: 4 }}>
              이 PC에서 발견한 캐시 위치예요. 그대로 두고 시작해도 됩니다.
            </p>
            {!sources ? (
              <Spinner label="위치 찾는 중…" />
            ) : sources.length === 0 ? (
              <Empty icon="🤷" msg="검사할 캐시를 찾지 못했어요" sub="파일·이미지 모드를 이용해 보세요." />
            ) : (
              <div className="stack" style={{ marginTop: 10 }}>
                {sources.map((s, i) => (
                  <label key={i} className="row" style={{ gap: 8, cursor: 'default' }}>
                    <input type="checkbox" checked={chosen.has(i)} onChange={() => toggle(i)} />
                    <span style={{ minWidth: 130, fontWeight: 500 }}>{s.label}</span>
                    <span className="hint mono truncate" style={{ fontSize: 11, flex: 1 }} title={s.path}>
                      {s.path}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="step" style={{ marginTop: 16 }}>
          <div className="n">2</div>
          <div style={{ flex: 1 }}>
            <strong>찾기 시작</strong>
            <p className="hint" style={{ marginTop: 4 }}>
              찾은 사진을 저장할 폴더를 고르면 검사가 시작됩니다.
            </p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" disabled={running || !sources?.length} onClick={start}>
                {running ? '찾는 중…' : '삭제된 사진 찾기'}
              </button>
              {running && (
                <button className="btn btn-sm danger" onClick={() => window.api.recover.stop()}>
                  중지
                </button>
              )}
            </div>
          </div>
        </div>

        {running && (
          <div style={{ marginTop: 16 }}>
            <div className="pbar">
              <div style={{ width: (progress.pct > 0 ? progress.pct : 3) + '%' }} />
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              캐시를 뒤지는 중… {fmtSize(progress.scanned)} 검사함
              {progress.pct > 0 ? ` (${progress.pct}%)` : ''}
            </div>
          </div>
        )}
      </div>

      {result && <CarveResult result={result} />}
    </>
  )
}

/* ---- Carving a chosen file / disk image ------------------------------- */
const TYPE_LABELS = {
  jpg: 'JPEG 사진',
  png: 'PNG 이미지',
  gif: 'GIF',
  pdf: 'PDF 문서',
  'zip/office': 'ZIP · Office 문서'
}

function CarveFlow() {
  const toast = useToast()
  const [types, setTypes] = useState(null)
  const [chosen, setChosen] = useState(new Set())
  const [target, setTarget] = useState(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ pct: 0, scanned: 0 })
  const [result, setResult] = useState(null)

  useEffect(() => {
    window.api.recover.sigTypes().then((r) => {
      if (r.ok) {
        setTypes(r.data)
        setChosen(new Set(r.data.map((t) => t.type)))
      }
    })
    const off = window.api.recover.onProgress((p) => setProgress(p))
    return off
  }, [])

  const pickTarget = async () => {
    const f = await window.api.openFile([{ name: '디스크 이미지 · 모든 파일', extensions: ['*'] }])
    if (f?.ok && f.data) setTarget(f.data)
  }
  const toggleType = (t) => {
    const n = new Set(chosen)
    n.has(t) ? n.delete(t) : n.add(t)
    setChosen(n)
  }

  const start = async () => {
    if (!target) return toast('먼저 검사할 파일을 선택하세요', 'bad')
    if (!chosen.size) return toast('찾을 파일 종류를 하나 이상 선택하세요', 'bad')
    const outDir = await window.api.openDir()
    if (!outDir?.ok || !outDir.data) return
    setRunning(true)
    setProgress({ pct: 0, scanned: 0 })
    setResult(null)
    try {
      const r = await call(window.api.recover.carve(target, outDir.data, { types: [...chosen] }))
      setResult({ ...r, outDir: r.outDir || outDir.data })
      toast(r.aborted ? `중지됨 · ${r.count}개 찾음` : `${r.count}개 파일을 복구했습니다`)
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <div className="card">
        <div className="step" style={{ marginBottom: 14 }}>
          <div className="n">1</div>
          <div style={{ flex: 1 }}>
            <strong>검사할 파일 선택</strong>
            <p className="hint" style={{ marginTop: 4 }}>
              메모리카드·USB에서 통째로 복사한 이미지 파일(.dd/.img)이나 훑어볼 큰 파일을
              고르세요.
            </p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btn-sm" onClick={pickTarget}>
                <span className="row" style={{ gap: 6 }}>
                  <Icon.disk /> 파일 선택…
                </span>
              </button>
              {target && (
                <span className="hint mono truncate" style={{ maxWidth: 420 }}>
                  {target}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="step" style={{ marginBottom: 14 }}>
          <div className="n">2</div>
          <div style={{ flex: 1 }}>
            <strong>찾을 파일 종류</strong>
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
              {!types ? (
                <Spinner />
              ) : (
                types.map((t) => (
                  <button
                    key={t.type}
                    className={'btn btn-sm' + (chosen.has(t.type) ? ' primary' : '')}
                    onClick={() => toggleType(t.type)}
                  >
                    {TYPE_LABELS[t.type] || t.type}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="step">
          <div className="n">3</div>
          <div style={{ flex: 1 }}>
            <strong>복구 시작</strong>
            <p className="hint" style={{ marginTop: 4 }}>
              찾은 파일을 저장할 폴더를 고르면 검사를 시작합니다.
            </p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary" disabled={running || !target} onClick={start}>
                {running ? '검사 중…' : '복구 시작'}
              </button>
              {running && (
                <button className="btn btn-sm danger" onClick={() => window.api.recover.stop()}>
                  중지
                </button>
              )}
            </div>
          </div>
        </div>

        {running && (
          <div style={{ marginTop: 16 }}>
            <div className="pbar">
              <div style={{ width: (progress.pct > 0 ? progress.pct : 3) + '%' }} />
            </div>
            <div className="hint" style={{ marginTop: 6 }}>
              훑는 중… {fmtSize(progress.scanned)} 검사함
              {progress.pct > 0 ? ` (${progress.pct}%)` : ''}
            </div>
          </div>
        )}
      </div>

      {result && <CarveResult result={result} />}
    </>
  )
}

function CarveResult({ result }) {
  const images = result.hits.filter((h) => h.thumb)
  const others = result.hits.filter((h) => !h.thumb)
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0 }}>
              {result.aborted ? '검사 중지됨' : '복구 완료'} — {result.count}개 파일을 찾았어요
              {result.count ? ' 🎉' : ''}
            </h3>
            <p className="hint" style={{ marginTop: 4 }}>
              {fmtSize(result.scanned)} 검사함{result.images ? ` · 사진 ${result.images}장` : ''}
              {result.reachedLimit ? ' · 최대 개수 도달' : ''} · 저장 위치 아래
            </p>
          </div>
          <button className="btn primary btn-sm" onClick={() => window.api.openPath(result.outDir)}>
            폴더 열기
          </button>
        </div>
        <div className="hint mono" style={{ marginTop: 8, fontSize: 11 }}>
          {result.outDir}
        </div>
      </div>

      {result.count === 0 && (
        <Empty
          icon="🔍"
          msg="찾은 파일이 없어요"
          sub="다른 위치를 선택하거나 다른 방법으로 다시 시도해 보세요."
        />
      )}

      {images.length > 0 && (
        <div className="card">
          <h3>사진 미리보기 ({images.length})</h3>
          <div className="rgrid" style={{ marginTop: 12 }}>
            {images.map((h) => (
              <div key={h.path} className="rcard" onDoubleClick={() => window.api.openPath(h.path)}>
                <img className="thumb" src={h.thumb} alt={h.name} />
                <div className="hint" style={{ marginTop: 6, fontSize: 11 }}>
                  {h.name}
                </div>
                <div className="hint" style={{ fontSize: 10 }}>
                  {fmtSize(h.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="card">
          <h3>문서 · 기타 ({others.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>종류</th>
                  <th className="num">크기</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {others.map((h) => (
                  <tr key={h.path}>
                    <td>{h.name}</td>
                    <td>
                      <span className="badge">{TYPE_LABELS[h.type] || h.type}</span>
                    </td>
                    <td className="num">{fmtSize(h.size)}</td>
                    <td className="num">
                      <button className="btn btn-sm ghost" onClick={() => window.api.showItem(h.path)}>
                        위치 보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
