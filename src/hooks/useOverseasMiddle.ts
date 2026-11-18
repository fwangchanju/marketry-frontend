import { useCallback, useEffect, useState } from 'react'
import { OVERSEAS_MIDDLE_EVENT, OVERSEAS_MIDDLE, overseasMiddleStorageKey, readOverseasMiddle, type OverseasMiddleMode } from '@/utils/overseasMiddle'
import type { OverseasMarket } from '@/utils/markets'

// 시장의 가운데 칸 선택(MARKETRY 또는 외부 분류). 시장별로 저장하고, 같은 화면의 다른 훅과 값을 맞춘다.
export function useOverseasMiddle(market: OverseasMarket): [OverseasMiddleMode, (next: OverseasMiddleMode) => void] {
  const [mode, setModeState] = useState<OverseasMiddleMode>(() => readOverseasMiddle(market))
  useEffect(() => {
    const sync = () => setModeState(readOverseasMiddle(market))
    sync()
    window.addEventListener(OVERSEAS_MIDDLE_EVENT, sync)
    return () => window.removeEventListener(OVERSEAS_MIDDLE_EVENT, sync)
  }, [market])
  const setMode = useCallback((next: OverseasMiddleMode) => {
    const value = next === 'EXTERNAL' && OVERSEAS_MIDDLE[market].externalReady ? 'EXTERNAL' : 'MARKETRY'
    try {
      localStorage.setItem(overseasMiddleStorageKey(market), value)
    } catch {
      // 저장이 막혀도 이 화면에서는 고른 값을 보여 준다.
    }
    window.dispatchEvent(new Event(OVERSEAS_MIDDLE_EVENT))
    setModeState(value)
  }, [market])
  return [mode, setMode]
}
