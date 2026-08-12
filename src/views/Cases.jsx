import React, { useEffect, useState } from 'react'
import { call, fmtDate, fmtSize, shortHash, useToast, Empty, Spinner, Icon } from '../ui'

export default function CasesView({ activeCaseId, setActiveCaseId, refreshCaseCount }) {
  const toast = useToast()
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(null) // full case object
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const list = await call(window.api.cases.list())
      setCases(list)
      refreshCaseCount?.()
      if (activeCaseId && (!selected || selected.id === activeCaseId)) {
        openCase(activeCaseId)
      }
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

  const openCase = async (id) => {
    try {
      const c = await call(window.api.cases.get(id))
      setSelected(c)
    } catch (e) {
      toast(e.message, 'bad')
    }
  }

  const createCase = async (meta) => {
    try {
      const c = await call(window.api.cases.create(meta))
      setShowNew(false)
      await load()
      setActiveCaseId(c.id)
      setSelected(c)
      toast('케이스를 생성했습니다')
    } catch (e) {
      toast(e.message, 'bad')
    }
  }

  const addEvidence = async () => {
    if (!selected) return
    const file = await window.api.openFile()
    if (!file || !file.ok || !file.data) return
    setBusy('증거 해싱 및 저장 중…')
    try {
      await call(window.api.cases.addEvidence(selected.id, file.data, ''))
      await openCase(selected.id)
      await load()
      toast('증거를 추가하고 해시를 기록했습니다')
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const verify = async (evId) => {
    setBusy('SHA-256 재검증 중…')
    try {
      const r = await call(window.api.cases.verifyEvidence(selected.id, evId))
      await openCase(selected.id)
      toast(r.ok ? '무결성 검증 완료 ✓' : '무결성 불일치 ✗', r.ok ? 'info' : 'bad')
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const removeEvidence = async (evId) => {
    try {
      await call(window.api.cases.removeEvidence(selected.id, evId))
      await openCase(selected.id)
      await load()
    } catch (e) {
      toast(e.message, 'bad')
    }
  }

  const makeReport = async () => {
    setBusy('보고서 생성 중…')
    try {
      const r = await call(window.api.cases.report(selected.id))
      await window.api.openPath(r.path)
      toast('보고서를 생성하고 열었습니다')
    } catch (e) {
      toast(e.message, 'bad')
    } finally {
      setBusy('')
    }
  }

  const setActive = () => {
    setActiveCaseId(selected.id)
    toast(`"${selected.name}"을(를) 활성 케이스로 설정했습니다`)
  }

  const deleteCase = async () => {
    if (!selected) return
    if (!confirm(`케이스 "${selected.name}"과(와) 저장된 모든 증거를 삭제할까요? 되돌릴 수 없습니다.`))
      return
    try {
      await call(window.api.cases.remove(selected.id))
      if (activeCaseId === selected.id) setActiveCaseId(null)
      setSelected(null)
      await load()
      toast('케이스를 삭제했습니다')
    } catch (e) {
      toast(e.message, 'bad')
    }
  }

  return (
    <>
      <div className="toolbar">
        <div style={{ marginLeft: 8 }}>
          <div className="title">케이스</div>
          <div className="subtitle">
            {activeCaseId ? '활성 케이스 설정됨 · ' : ''}
            케이스 {cases.length}건
          </div>
        </div>
        <div className="spacer" />
        <div className="toolbar-actions">
          {busy && <Spinner label={busy} />}
          <button className="btn btn-sm" onClick={load} title="새로고침">
            <Icon.refresh />
          </button>
          <button className="btn primary btn-sm" onClick={() => setShowNew(true)}>
            + 새 케이스
          </button>
        </div>
      </div>

      <div className="content pad-0" style={{ display: 'grid', gridTemplateColumns: '300px 1fr' }}>
        {/* case list */}
        <div
          style={{
            borderRight: '0.5px solid var(--sep)',
            overflow: 'auto',
            padding: 12,
            background: 'var(--bg)'
          }}
        >
          {loading && <Spinner label="불러오는 중…" />}
          {!loading && cases.length === 0 && (
            <Empty icon="🗂️" msg="케이스가 없습니다" sub="새 케이스를 만들어 증거 수집을 시작하세요." />
          )}
          {cases.map((c) => (
            <div
              key={c.id}
              className={'list-row' + (selected?.id === c.id ? ' active' : '')}
              style={{ borderRadius: 8, marginBottom: 4, border: '0.5px solid var(--sep)' }}
              onClick={() => openCase(c.id)}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row" style={{ gap: 6 }}>
                  <strong className="truncate" style={{ maxWidth: 180 }}>
                    {c.name}
                  </strong>
                  {activeCaseId === c.id && <span className="badge ok">활성</span>}
                </div>
                <div className="hint truncate" style={{ maxWidth: 230 }}>
                  {c.subject || '대상 없음'} · 증거 {c.evidenceCount}건
                </div>
                <div className="hint" style={{ fontSize: 11 }}>
                  {fmtDate(c.updatedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* detail */}
        <div style={{ overflow: 'auto', padding: 20 }}>
          {!selected ? (
            <Empty icon="📁" msg="케이스를 선택하세요" sub="또는 새 케이스를 만드세요." />
          ) : (
            <CaseDetail
              c={selected}
              isActive={activeCaseId === selected.id}
              onAddEvidence={addEvidence}
              onVerify={verify}
              onRemoveEvidence={removeEvidence}
              onReport={makeReport}
              onSetActive={setActive}
              onDelete={deleteCase}
              onEdited={() => openCase(selected.id)}
              toast={toast}
            />
          )}
        </div>
      </div>

      {showNew && <NewCaseModal onClose={() => setShowNew(false)} onCreate={createCase} />}
    </>
  )
}

function CaseDetail({
  c,
  isActive,
  onAddEvidence,
  onVerify,
  onRemoveEvidence,
  onReport,
  onSetActive,
  onDelete,
  onEdited,
  toast
}) {
  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h2 className="sec-title">{c.name}</h2>
          <p className="sec-sub" style={{ marginBottom: 10 }}>
            <span className="mono">{c.id}</span> · <span className="badge">{c.status}</span>
          </p>
        </div>
        <div className="row">
          {!isActive && (
            <button className="btn btn-sm" onClick={onSetActive}>
              활성으로 설정
            </button>
          )}
          <button className="btn btn-sm" onClick={onReport}>
            <span className="row" style={{ gap: 5 }}>
              <Icon.report /> 보고서
            </span>
          </button>
          <button className="btn btn-sm danger" onClick={onDelete}>
            삭제
          </button>
        </div>
      </div>

      <div className="card">
        <div className="kv">
          <div className="k">조사자</div>
          <div className="v">{c.investigator || '—'}</div>
          <div className="k">대상 / 기기</div>
          <div className="v">{c.subject || '—'}</div>
          <div className="k">권한 근거</div>
          <div className="v">{c.authorization || '—'}</div>
          <div className="k">생성일</div>
          <div className="v">{fmtDate(c.createdAt)}</div>
          {c.notes ? (
            <>
              <div className="k">메모</div>
              <div className="v" style={{ whiteSpace: 'pre-wrap' }}>
                {c.notes}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>증거 ({c.evidence?.length || 0})</h3>
          <button className="btn primary btn-sm" onClick={onAddEvidence}>
            + 파일 추가
          </button>
        </div>
        {!c.evidence?.length ? (
          <p className="hint" style={{ marginTop: 12 }}>
            아직 증거가 없습니다. 파일을 추가하면 케이스 저장소로 복사되고 SHA-256 + MD5 해시가
            기록됩니다.
          </p>
        ) : (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th className="num">크기</th>
                  <th>SHA-256</th>
                  <th>무결성</th>
                  <th>수집일</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {c.evidence.map((e) => (
                  <tr key={e.id}>
                    <td className="truncate" title={e.originalPath}>
                      {e.originalName}
                    </td>
                    <td className="num">{fmtSize(e.size)}</td>
                    <td className="mono" title={e.sha256}>
                      {shortHash(e.sha256)}
                    </td>
                    <td>
                      {e.lastVerify?.ok ? (
                        <span className="badge ok">✓ 검증됨</span>
                      ) : (
                        <span className="badge bad">✗ 불일치</span>
                      )}
                    </td>
                    <td className="hint">{fmtDate(e.acquiredAt)}</td>
                    <td className="num">
                      <button className="btn btn-sm ghost" onClick={() => onVerify(e.id)}>
                        검증
                      </button>
                      <button className="btn btn-sm ghost danger" onClick={() => onRemoveEvidence(e.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>활동 로그</h3>
        <div style={{ maxHeight: 220, overflow: 'auto' }}>
          <table className="table">
            <tbody>
              {(c.log || [])
                .slice()
                .reverse()
                .map((l, i) => (
                  <tr key={i}>
                    <td className="hint mono" style={{ whiteSpace: 'nowrap' }}>
                      {fmtDate(l.ts)}
                    </td>
                    <td>
                      <span className="badge">{l.action}</span>
                    </td>
                    <td className="hint">{l.detail}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function NewCaseModal({ onClose, onCreate }) {
  const [f, setF] = useState({
    name: '',
    investigator: '',
    subject: '',
    authorization: '',
    notes: ''
  })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <h3>새 케이스</h3>
        <div className="stack">
          <div>
            <label className="lbl">케이스 이름 *</label>
            <input className="field" value={f.name} onChange={set('name')} autoFocus />
          </div>
          <div className="grid2">
            <div>
              <label className="lbl">조사자</label>
              <input className="field" value={f.investigator} onChange={set('investigator')} />
            </div>
            <div>
              <label className="lbl">대상 / 기기</label>
              <input className="field" value={f.subject} onChange={set('subject')} />
            </div>
          </div>
          <div>
            <label className="lbl">권한 근거 (동의 / 소유 / 영장 메모)</label>
            <input
              className="field"
              value={f.authorization}
              onChange={set('authorization')}
              placeholder="예: 본인 소유 기기 · 소유자 서면 동의"
            />
          </div>
          <div>
            <label className="lbl">메모</label>
            <textarea className="field" value={f.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" disabled={!f.name.trim()} onClick={() => onCreate(f)}>
            생성
          </button>
        </div>
      </div>
    </div>
  )
}
