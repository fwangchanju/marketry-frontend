import { useState } from 'react'

const STORAGE_KEY = 'marketry:japan-graph-settings'
const DEFAULTS = { graphMode: 'current' as 'current' | 'delta', groupDepth: 1, avgChangeRateUseSimple: false, beforeMinutes: 15 }
export type JapanGraphPreferences = typeof DEFAULTS

function read(): JapanGraphPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<JapanGraphPreferences>
    return {
      graphMode: parsed.graphMode === 'delta' ? 'delta' : 'current',
      groupDepth: parsed.groupDepth === 2 || parsed.groupDepth === 3 ? parsed.groupDepth : DEFAULTS.groupDepth,
      avgChangeRateUseSimple: parsed.avgChangeRateUseSimple === true,
      beforeMinutes: typeof parsed.beforeMinutes === 'number' ? parsed.beforeMinutes : DEFAULTS.beforeMinutes,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

// 일본 그래프의 표시 설정 — 일본 지도처럼 서버에 저장하지 않고 이 브라우저에만 둔다.
export function useJapanGraphPreferences() {
  const [preferences, setPreferences] = useState(read)
  const update = (changes: Partial<JapanGraphPreferences>) => setPreferences(previous => {
    const next = { ...previous, ...changes }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* 저장소 접근이 막혀도 화면 변경은 유지한다. */ }
    return next
  })
  return { preferences, update }
}
