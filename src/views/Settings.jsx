import React from 'react'

export default function SettingsView({ theme, setTheme, platform }) {
  return (
    <>
      <div className="toolbar">
        <div style={{ marginLeft: 8 }}>
          <div className="title">설정</div>
          <div className="subtitle">모양 및 정보</div>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ maxWidth: 560 }}>
          <h3>모양</h3>
          <label className="lbl">테마</label>
          <div className="seg">
            {[
              ['system', '시스템'],
              ['light', '라이트'],
              ['dark', '다크']
            ].map(([k, l]) => (
              <button key={k} className={theme === k ? 'on' : ''} onClick={() => setTheme(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ maxWidth: 560 }}>
          <h3>정보</h3>
          <div className="kv">
            <div className="k">앱</div>
            <div className="v">Forensic Workbench 0.1.0</div>
            <div className="k">플랫폼</div>
            <div className="v mono">{platform.platform}</div>
            <div className="k">모드</div>
            <div className="v">{platform.isDev ? '개발' : '프로덕션'}</div>
          </div>
          <p className="hint" style={{ marginTop: 12 }}>
            본인이 소유했거나 문서화된 권한이 있는 기기의 분석을 위한 도구입니다. 각 케이스에 권한
            근거를 기록하세요. 증거는 케이스별 저장소로 복사되어 SHA-256 + MD5로 지문화되며, 언제든
            무결성을 재검증할 수 있습니다.
          </p>
        </div>
      </div>
    </>
  )
}
