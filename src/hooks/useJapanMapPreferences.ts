import { useState } from 'react'
import { JAPAN_MAP_PREFERENCES_STORAGE, readJapanMapPreferences, type JapanMapPreferences } from '@/utils/japanMapSettings'

function readStored(): string | null {
  try {
    return localStorage.getItem(JAPAN_MAP_PREFERENCES_STORAGE)
  } catch {
    return null
  }
}

// 일본 지도의 표시 설정 — 서버에 저장하지 않고 이 브라우저에만 둔다. 국내 지도 설정과 저장 위치를 공유하지 않는다.
export function useJapanMapPreferences() {
  const [preferences, setPreferences] = useState(() => readJapanMapPreferences(readStored()))
  const update = (changes: Partial<JapanMapPreferences>) => setPreferences(previous => {
    const next = { ...previous, ...changes }
    try { localStorage.setItem(JAPAN_MAP_PREFERENCES_STORAGE, JSON.stringify(next)) } catch { /* 저장소 접근이 막혀도 화면 변경은 유지한다. */ }
    return next
  })
  return { preferences, update }
}
