import { useEffect, useRef, useState } from 'react'
import { useNumberTween } from '@/hooks/useNumberTween'
import { FLASH_HOLD_MS } from '@/components/numberEffectTiming'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotTimeOnlyLabel } from '@/utils/format'

const CLOCK_TWEEN_MS = 1000

const pad = (value: number) => String(value).padStart(2, '0')

// 툴바 시계의 "HH:mm". 종가·누적을 바꾸거나 새 스냅샷이 오면 이전 시각에서 새 시각까지 숫자가 올라가거나 내려가며 바뀐다(설정창 종목 수와 같은 방식).
// 시각이 바뀌면 설정창 종목 수처럼 숫자가 청록색으로 켜졌다가 돌아온다. 처음 그릴 때는 켜지 않는다.
// 데이터가 없으면 같은 폭의 견본 시각을 숨겨서 자리를 잡는다.
export default function AnimatedClockLabel({ snapshotTime }: { snapshotTime: string | null }) {
  // 새 지도를 받는 동안에는 snapshotTime이 잠깐 비는데, 그때 시각이 사라졌다 나타나지 않도록 마지막으로 받은 시각을 붙들고 있다가 새 시각이 오면 거기서부터 움직인다.
  const [held, setHeld] = useState(snapshotTime)
  if (snapshotTime !== null && snapshotTime !== held) setHeld(snapshotTime)
  const shownTime = snapshotTime ?? held
  const minutes = shownTime ? Number(shownTime.slice(11, 13)) * 60 + Number(shownTime.slice(14, 16)) : null
  const shown = useNumberTween(minutes, CLOCK_TWEEN_MS)
  const [isFlashing, setIsFlashing] = useState(false)
  const previousTime = useRef(shownTime)
  const flashTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const before = previousTime.current
    previousTime.current = shownTime
    if (before === null || shownTime === null || before === shownTime) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 값이 바뀐 순간에만 켜고 타이머로 끄는 일회성 시각 효과라 렌더 중에 계산할 수 없다
    setIsFlashing(true)
    window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setIsFlashing(false), FLASH_HOLD_MS)
  }, [shownTime])
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])
  const label = shown === null
    ? toSnapshotTimeOnlyLabel(MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)
    : `${pad(Math.floor(shown / 60))}:${pad(shown % 60)}`
  return <span className={`tabular-nums transition-colors duration-500 ${isFlashing ? 'text-[var(--brand)]' : ''} ${shownTime ? '' : 'invisible'}`}>{label}</span>
}
