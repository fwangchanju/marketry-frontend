import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

const SIZE = 80
const CENTER = SIZE / 2
const FACE_RADIUS = 36
const HAND_RADIUS = 28
const MINUTES_PER_TURN = 60
// 12시 방향에서 시계방향으로 잰 각도(0~360)를 좌표로 바꾼다.
function polar(degrees: number, radius: number) {
  const radians = (degrees * Math.PI) / 180
  return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) }
}

// 시계 바늘을 시계방향으로 돌려 분을 고르는 다이얼 — 바늘은 step분 눈금에만 멈추고, 12시 방향이 한 바퀴(60분)다.
// 바늘이 지나온 부채꼴을 채워 간격이 얼마나 되는지 보여 준다. 끌기·눈금 누르기·방향키로 바꾼다.
export default function MinuteDial({ value, step, onChange, label, size = SIZE }: { value: number; step: number; onChange: (minutes: number) => void; label: string; size?: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isDragging = useRef(false)
  const degrees = (value / MINUTES_PER_TURN) * 360
  const handEnd = polar(degrees, HAND_RADIUS)
  const arcEnd = polar(degrees, FACE_RADIUS - 4)
  const arcStart = polar(0, FACE_RADIUS - 4)
  const isFullTurn = value >= MINUTES_PER_TURN

  const pickFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (svg === null) return
    const rect = svg.getBoundingClientRect()
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    const pointerDegrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    let minutes = Math.round(pointerDegrees / 6 / step) * step
    if (minutes === 0) minutes = MINUTES_PER_TURN
    if (minutes !== value) onChange(minutes)
  }
  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    isDragging.current = true
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 포인터 캡처를 못 쓰는 환경에서는 끌기가 영역 밖에서 끊길 뿐이다.
    }
    pickFromPointer(event)
  }
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (isDragging.current) pickFromPointer(event)
  }
  const handlePointerEnd = () => {
    isDragging.current = false
  }
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, number> = { ArrowRight: value + step, ArrowUp: value + step, ArrowLeft: value - step, ArrowDown: value - step, Home: step, End: MINUTES_PER_TURN }
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    onChange(Math.min(MINUTES_PER_TURN, Math.max(step, next)))
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={step}
      aria-valuemax={MINUTES_PER_TURN}
      aria-valuenow={value}
      aria-valuetext={`${value}분`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      className="shrink-0 cursor-pointer touch-none text-ui-white outline-none focus-visible:text-brand"
    >
      <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="var(--ui-control)" />
      {isFullTurn ? (
        <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS - 4} fill="var(--brand-surface)" />
      ) : (
        <path d={`M ${CENTER} ${CENTER} L ${arcStart.x} ${arcStart.y} A ${FACE_RADIUS - 4} ${FACE_RADIUS - 4} 0 ${degrees > 180 ? 1 : 0} 1 ${arcEnd.x} ${arcEnd.y} Z`} fill="var(--brand-surface)" />
      )}
      {Array.from({ length: MINUTES_PER_TURN / 5 }, (_, index) => {
        const tickDegrees = index * 30
        const outer = polar(tickDegrees, FACE_RADIUS)
        const inner = polar(tickDegrees, FACE_RADIUS - (index % 3 === 0 ? 6 : 3))
        return <line key={tickDegrees} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="currentColor" strokeWidth={index % 3 === 0 ? 1.6 : 1} strokeLinecap="round" opacity={0.7} />
      })}
      <line x1={CENTER} y1={CENTER} x2={handEnd.x} y2={handEnd.y} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={CENTER} cy={CENTER} r={2.6} fill="currentColor" />
    </svg>
  )
}
