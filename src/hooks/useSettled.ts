import { useEffect, useState } from 'react'

// 렌더러가 찍기 전에 화면이 가만해졌는지 — ready가 참이고 key가 ms 동안 바뀌지 않았을 때만 참이다.
// 툴바 시계가 새 시각으로 1초에 걸쳐 움직이는 중간에 찍히지 않게 한다(종가·별도는 실시간 지도를 받은 뒤 그 기준 지도로 옮겨 가서 시각이 반드시 움직인다).
export function useSettled(ready: boolean, key: string, ms: number): boolean {
  const [settledKey, setSettledKey] = useState<string | null>(null)
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => setSettledKey(key), ms)
    return () => window.clearTimeout(timer)
  }, [ready, key, ms])
  return ready && settledKey === key
}
