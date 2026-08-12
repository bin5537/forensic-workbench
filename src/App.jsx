import React, { useEffect, useMemo, useState } from 'react'
import { Icon, ToastProvider } from './ui'
import HomeView from './views/Home'
import RecoverView from './views/Recover'
import ShadowView from './views/Shadow'
import AnalyzeView from './views/Analyze'
import CasesView from './views/Cases'
import AndroidView from './views/Android'
import IosView from './views/Ios'
import PcView from './views/Pc'
import SettingsView from './views/Settings'

const NAV = [
  { group: '시작', items: [{ id: 'home', label: '홈', icon: Icon.folder }] },
  {
    group: '복구 · 분석',
    items: [
      { id: 'analyze', label: 'PC 분석 · 발자국', icon: Icon.clock },
      { id: 'recover', label: '삭제 파일 복구', icon: Icon.recover },
      { id: 'shadow', label: '이전 버전 복구', icon: Icon.history },
      { id: 'android', label: '안드로이드 폰', icon: Icon.android },
      { id: 'ios', label: '아이폰 백업', icon: Icon.ios },
      { id: 'pc', label: '컴퓨터 검사', icon: Icon.pc }
    ]
  },
  { group: '기록', items: [{ id: 'cases', label: '케이스 · 보고서', icon: Icon.cases }] },
  { group: '앱', items: [{ id: 'settings', label: '설정', icon: Icon.gear }] }
]

export default function App() {
  const [view, setView] = useState('home')
  const [platform, setPlatform] = useState({ platform: 'win32', isDev: false })
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'system'
  )
  const [activeCaseId, setActiveCaseId] = useState(
    () => localStorage.getItem('activeCase') || null
  )
  const [caseCount, setCaseCount] = useState(0)

  useEffect(() => {
    window.api?.onPlatform((info) => setPlatform(info))
    window.api?.cases.list().then((r) => r.ok && setCaseCount(r.data.length))
  }, [])

  // Apply theme: 'system' follows OS via matchMedia; explicit overrides win.
  useEffect(() => {
    const mm = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mm.matches)
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()
    mm.addEventListener('change', apply)
    window.api?.setTheme(theme)
    localStorage.setItem('theme', theme)
    return () => mm.removeEventListener('change', apply)
  }, [theme])

  useEffect(() => {
    if (activeCaseId) localStorage.setItem('activeCase', activeCaseId)
    else localStorage.removeItem('activeCase')
  }, [activeCaseId])

  const isMac = platform.platform === 'darwin'

  useEffect(() => {
    document.documentElement.setAttribute('data-os', isMac ? 'mac' : 'win')
  }, [isMac])

  const shared = {
    activeCaseId,
    setActiveCaseId,
    goto: setView,
    refreshCaseCount: () =>
      window.api?.cases.list().then((r) => r.ok && setCaseCount(r.data.length))
  }

  const CurrentView = useMemo(() => {
    switch (view) {
      case 'home':
        return <HomeView {...shared} />
      case 'recover':
        return <RecoverView {...shared} />
      case 'shadow':
        return <ShadowView {...shared} />
      case 'analyze':
        return <AnalyzeView {...shared} />
      case 'cases':
        return <CasesView {...shared} />
      case 'android':
        return <AndroidView {...shared} />
      case 'ios':
        return <IosView {...shared} />
      case 'pc':
        return <PcView {...shared} />
      case 'settings':
        return <SettingsView theme={theme} setTheme={setTheme} platform={platform} />
      default:
        return null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeCaseId, theme, platform])

  return (
    <ToastProvider>
      <div className="app">
        <aside className="sidebar">
          {/* drag strip; on mac it sits under the native traffic lights */}
          <div className="sidebar-drag" />
          <div className="sidebar-scroll">
            {NAV.map((g) => (
              <div key={g.group}>
                <div className="side-group-label">{g.group}</div>
                {g.items.map((it) => {
                  const IconC = it.icon
                  return (
                    <div
                      key={it.id}
                      className={'side-item' + (view === it.id ? ' active' : '')}
                      onClick={() => setView(it.id)}
                    >
                      <span className="ic">
                        <IconC />
                      </span>
                      <span>{it.label}</span>
                      {it.id === 'cases' && caseCount > 0 && (
                        <span className="count">{caseCount}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </aside>

        <main className="main">{CurrentView}</main>

        {/* Windows-style caption buttons (mac shows native inset traffic lights) */}
        {!isMac && (
          <div className="wincaption">
            <button className="wc-btn" title="최소화" onClick={() => window.api?.win.minimize()}>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                <line x1="2" y1="6" x2="10" y2="6" />
              </svg>
            </button>
            <button className="wc-btn" title="최대화" onClick={() => window.api?.win.maximize()}>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2.5" y="2.5" width="7" height="7" />
              </svg>
            </button>
            <button className="wc-btn wc-close" title="닫기" onClick={() => window.api?.win.close()}>
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.1">
                <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" />
                <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}
