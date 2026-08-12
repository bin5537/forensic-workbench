import React, { useEffect, useState } from 'react'
import { Icon } from '../ui'

export default function HomeView({ goto, activeCaseId }) {
  const [adb, setAdb] = useState(null)
  const [recycle, setRecycle] = useState(null)
  const [caseCount, setCaseCount] = useState(0)

  useEffect(() => {
    window.api?.adb.available().then((r) => r.ok && setAdb(r.data))
    window.api?.adb.devices().then((r) => r.ok && setAdb((a) => ({ ...(a || {}), count: r.data.length })))
    window.api?.recover.recycleBin().then((r) => r.ok && setRecycle(r.data.count))
    window.api?.cases.list().then((r) => r.ok && setCaseCount(r.data.length))
  }, [])

  const tiles = [
    {
      id: 'analyze',
      grad: 'g-pink',
      icon: Icon.clock,
      title: 'PC 분석 · 디지털 발자국',
      desc: '브라우저 기록을 분석해 다운로드·방문·검색어를 한눈에 보여주고, 지금은 사라진(삭제된) 다운로드까지 찾아냅니다.',
      stat: '지금 분석하기'
    },
    {
      id: 'recover',
      grad: 'g-purple',
      icon: Icon.recover || Icon.hash,
      title: '삭제된 파일 복구',
      desc: '휴지통에서 지워졌거나, 메모리카드·USB에서 사라진 사진·문서를 찾아 되살립니다.',
      stat: recycle != null ? `휴지통에 복구 가능 ${recycle}건` : '휴지통 확인'
    },
    {
      id: 'shadow',
      grad: 'g-gray',
      icon: Icon.history,
      title: '이전 버전에서 복구',
      desc: '오래 전에 지운 파일도, Windows 복원 지점에 남아 있으면 이름 그대로 되찾습니다.',
      stat: '복원 지점 열기'
    },
    {
      id: 'android',
      grad: 'g-green',
      icon: Icon.android,
      title: '안드로이드 폰 분석',
      desc: '연결된 안드로이드폰에서 통화·메시지·연락처·사진을 안전하게 살펴봅니다.',
      stat: adb?.available
        ? adb?.count
          ? `기기 ${adb.count}대 연결됨`
          : '연결된 기기 없음'
        : 'USB로 폰 연결'
    },
    {
      id: 'ios',
      grad: 'g-blue',
      icon: Icon.ios,
      title: '아이폰 백업 열기',
      desc: 'PC에 저장된 아이폰 백업에서 메시지·연락처·통화 기록을 열어봅니다.',
      stat: '백업 폴더 열기'
    },
    {
      id: 'pc',
      grad: 'g-orange',
      icon: Icon.pc,
      title: '컴퓨터 검사',
      desc: '폴더나 디스크를 훑어 큰 파일·의심 파일을 찾고, 파일 지문(해시)을 확인합니다.',
      stat: '폴더 선택'
    },
    {
      id: 'cases',
      grad: 'g-purple',
      icon: Icon.cases,
      title: '케이스 & 보고서',
      desc: '찾은 증거를 사건별로 모아 무결성을 기록하고, 보고서를 한 번에 만듭니다.',
      stat: caseCount ? `케이스 ${caseCount}건` : '새 케이스 만들기'
    }
  ]

  return (
    <>
      <div className="toolbar">
        <div style={{ marginLeft: 8 }}>
          <div className="title">홈</div>
          <div className="subtitle">무엇을 도와드릴까요?</div>
        </div>
      </div>
      <div className="content">
        <div className="hero">
          <h1>안녕하세요 👋</h1>
          <p>아래에서 하고 싶은 작업을 골라주세요. 각 단계는 차근차근 안내해 드립니다.</p>
        </div>

        <div className="tile-grid">
          {tiles.map((t) => {
            const IconC = t.icon
            return (
              <div key={t.id} className="tile" onClick={() => goto(t.id)}>
                <div className={'tile-ic ' + t.grad}>
                  <IconC />
                </div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
                <div className="tile-stat">{t.stat} ›</div>
              </div>
            )
          })}
        </div>

        <div className="notice">
          <span className="notice-ic">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
          </span>
          <div>
            <strong>안전하게 사용하기</strong>
            <p>
              본인 소유이거나 소유자의 동의를 받은 기기·데이터만 분석하세요. 케이스를 만들면 권한
              근거와 모든 작업이 자동으로 기록되어 보고서로 정리됩니다.
              {activeCaseId ? ' 현재 활성 케이스가 설정되어 있습니다.' : ''}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
