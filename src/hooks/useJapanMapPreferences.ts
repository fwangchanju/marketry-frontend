import { useMemo, useState } from 'react'
import { useDefaultPreferences } from './useDefaultPreferences'
import {
  JAPAN_MAP_PREFERENCES_STORAGE,
  isJapanMapCapture,
  japanMapManagedDefaults,
  readJapanMapOverrides,
  type JapanMapPreferences,
} from '@/utils/japanMapSettings'

function readStored(): string | null {
  try {
    return localStorage.getItem(JAPAN_MAP_PREFERENCES_STORAGE)
  } catch {
    return null
  }
}

// 일본 지도의 표시 설정 — 코드 기본값 위에 관리자가 정한 기본값(서버)을 얹고, 그 위에 이 브라우저에서 바꾼 값만 얹는다.
// 텔레그램 렌더러는 이 브라우저의 저장값을 쓰지 않고 관리자가 정한 기본값만 쓴다. 국내 지도 설정과 저장 위치를 공유하지 않는다.
export function useJapanMapPreferences() {
  const defaults = useDefaultPreferences()
  const isCapture = isJapanMapCapture()
  const base = useMemo(() => japanMapManagedDefaults(defaults.data), [defaults.data])
  const [overrides, setOverrides] = useState<Partial<JapanMapPreferences>>(() => (isCapture ? {} : readJapanMapOverrides(readStored())))
  const preferences = useMemo(() => ({ ...base, ...overrides }), [base, overrides])
  const update = (changes: Partial<JapanMapPreferences>) => setOverrides(previous => {
    const next = { ...previous, ...changes }
    try { localStorage.setItem(JAPAN_MAP_PREFERENCES_STORAGE, JSON.stringify(next)) } catch { /* 저장소 접근이 막혀도 화면 변경은 유지한다. */ }
    return next
  })
  return { preferences, update, isLoadingDefaults: defaults.isLoading }
}
