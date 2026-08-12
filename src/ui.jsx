import React, { createContext, useContext, useState, useCallback } from 'react'

/* ---- formatting helpers ---------------------------------------------- */
export function fmtSize(n) {
  if (n == null || isNaN(n)) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = 0
  let v = Number(n)
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i ? 1 : 0)} ${u[i]}`
}
export function fmtDate(iso) {
  if (!iso) return '—'
  return String(iso).replace('T', ' ').replace(/\.\d+Z?$/, '').replace('Z', '')
}
export function shortHash(h) {
  if (!h) return ''
  return h.slice(0, 10) + '…' + h.slice(-6)
}

/* ---- toast ------------------------------------------------------------ */
const ToastCtx = createContext(() => {})
export function useToast() {
  return useContext(ToastCtx)
}
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const push = useCallback((msg, kind = 'info') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {toast && <div className={'toast ' + (toast.kind === 'bad' ? 'bad' : '')}>{toast.msg}</div>}
    </ToastCtx.Provider>
  )
}

/* Unwrap the {ok,data,error} envelope from IPC, throwing on failure. */
export async function call(promise) {
  const r = await promise
  if (r && r.ok) return r.data
  throw new Error(r ? r.error : 'Unknown IPC error')
}

/* ---- inline SF-style icons ------------------------------------------- */
const I = (p) => (
  <svg
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  />
)
export const Icon = {
  cases: (p) => (
    <I {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </I>
  ),
  android: (p) => (
    <I {...p}>
      <rect x="6" y="8" width="12" height="10" rx="1.5" />
      <path d="M6 8a6 6 0 0 1 12 0M9 4l-1.2-1.8M15 4l1.2-1.8M4 11v4M20 11v4M9 18v2.5M15 18v2.5" />
    </I>
  ),
  ios: (p) => (
    <I {...p}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.4" />
      <path d="M11 18.5h2" />
    </I>
  ),
  pc: (p) => (
    <I {...p}>
      <rect x="3" y="4" width="18" height="12" rx="1.6" />
      <path d="M8 20h8M12 16v4" />
    </I>
  ),
  report: (p) => (
    <I {...p}>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M13 3v5h5M9 13h6M9 17h6" />
    </I>
  ),
  hash: (p) => (
    <I {...p}>
      <path d="M9 3 7 21M17 3l-2 18M4 8h16M3 16h16" />
    </I>
  ),
  clock: (p) => (
    <I {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </I>
  ),
  refresh: (p) => (
    <I {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 4v4h-4" />
    </I>
  ),
  folder: (p) => (
    <I {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </I>
  ),
  file: (p) => (
    <I {...p}>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M13 3v5h5" />
    </I>
  ),
  plus: (p) => (
    <I {...p}>
      <path d="M12 5v14M5 12h14" />
    </I>
  ),
  camera: (p) => (
    <I {...p}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.2" />
    </I>
  ),
  gear: (p) => (
    <I {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </I>
  ),
  chip: (p) => (
    <I {...p}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" />
    </I>
  ),
  message: (p) => (
    <I {...p}>
      <path d="M21 12a8 8 0 0 1-11.3 7.3L3 21l1.7-6.7A8 8 0 1 1 21 12z" />
    </I>
  ),
  phone: (p) => (
    <I {...p}>
      <path d="M5 3h3l2 5-2.5 1.5a12 12 0 0 0 5 5L19 16l2 3v3a1 1 0 0 1-1 1C10 23 1 14 1 4a1 1 0 0 1 1-1" />
    </I>
  ),
  recover: (p) => (
    <I {...p}>
      <path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M13 3v5h5" />
      <path d="M9 15l2.2 2.2L15 13" />
    </I>
  ),
  trash: (p) => (
    <I {...p}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </I>
  ),
  wand: (p) => (
    <I {...p}>
      <path d="M15 4V2M15 10V8M12 7h-2M20 7h-2M4 20l10-10M17 5l2 2" />
      <path d="M13.5 8.5 5 17l2 2 8.5-8.5z" />
    </I>
  ),
  disk: (p) => (
    <I {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </I>
  ),
  history: (p) => (
    <I {...p}>
      <path d="M3 3v5h5" />
      <path d="M3.5 8a9 9 0 1 0 2.3-3.3L3 8" />
      <path d="M12 8v4l3 2" />
    </I>
  )
}

/* ---- small building blocks ------------------------------------------- */
export function Empty({ icon = '🔎', msg, sub }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div className="msg">{msg}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function Spinner({ label }) {
  return (
    <span className="row" style={{ gap: 8 }}>
      <span className="spinner" />
      {label && <span className="hint">{label}</span>}
    </span>
  )
}

// Full-view centered loading state.
export function Loading({ label }) {
  return (
    <div className="loading-center">
      <span className="spinner" />
      {label && <span className="lbl">{label}</span>}
    </div>
  )
}
