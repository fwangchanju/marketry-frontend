import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useNumberTween } from '@/hooks/useNumberTween'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotTimeOnlyLabel } from '@/utils/format'

// 5분 단위로 바뀌어 숫자가 5칸만 지나가므로 2.5초에 걸쳐 올려 눈에 띄게 한다(2026-11-27 사용자 지시, 예전 1초).
const CLOCK_TWEEN_MS = 2500
const CLOCK_FLASH_AFTER_MS = 500

const pad = (value: number) => String(value).padStart(2, '0')

// 툴바 시계의 "HH:mm". 종가·합산을 바꾸거나 새 스냅샷이 오면 이전 시각에서 새 시각까지 숫자가 올라가거나 내려가며 바뀐다(설정창 종목 수와 같은 방식).
// 시각이 바뀌면 설정창 종목 수처럼 숫자가 청록색으로 켜졌다가 돌아온다. 처음 그릴 때는 켜지 않는다.
// 데이터가 없으면 같은 폭의 견본 시각을 숨겨서 자리를 잡는다.
function ClockLabel({ snapshotTime, icon }: { snapshotTime: string | null; icon?: ReactNode }) {
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
    // 숫자가 다 올라간 뒤 0.5초 더 켜 둔다(숫자 움직임 시간을 늘려도 청록색이 먼저 꺼지지 않게).
    flashTimer.current = window.setTimeout(() => setIsFlashing(false), CLOCK_TWEEN_MS + CLOCK_FLASH_AFTER_MS)
  }, [shownTime])
  useEffect(() => () => window.clearTimeout(flashTimer.current), [])
  const label = shown === null
    ? toSnapshotTimeOnlyLabel(MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)
    : `${pad(Math.floor(shown / 60))}:${pad(shown % 60)}`
  return <>
    {icon && <span className={`transition-colors duration-500 ${isFlashing ? 'text-[var(--brand)]' : ''}`}>{icon}</span>}
    <span className={`font-medium tabular-nums transition-colors duration-500 ${isFlashing ? 'text-[var(--brand)]' : ''} ${shownTime ? '' : 'invisible'}`}>{label}</span>
  </>
}

// 주소(시장 페이지)가 바뀌면 시계를 새로 그린다 — 시장을 바꿀 때 이전 시장의 시각에서 움직이거나 깜빡이지 않도록 한다.
// 같은 화면 안에서 날짜를 바꾸면 주소가 그대로이므로 애니메이션은 그대로 나온다.
export default function AnimatedClockLabel(props: { snapshotTime: string | null; icon?: ReactNode }) {
  const { pathname } = useLocation()
  return <ClockLabel key={pathname} {...props} />
}
