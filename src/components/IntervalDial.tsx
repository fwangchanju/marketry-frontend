import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

const SIZE = 80
const CENTER = SIZE / 2
const FACE_RADIUS = 36
const HAND_RADIUS = 28
const UNITS_PER_TURN = 60

function polar(degrees: number, radius: number) {
  const radians = (degrees * Math.PI) / 180
  return { x: CENTER + radius * Math.sin(radians), y: CENTER - radius * Math.cos(radians) }
}

function valuesForStep(step: number): number[] {
  if (!Number.isFinite(step) || step <= 0) return [UNITS_PER_TURN]
  const values: number[] = []
  for (let value = step; value < UNITS_PER_TURN; value += step) values.push(value)
  if (values.at(-1) !== UNITS_PER_TURN) values.push(UNITS_PER_TURN)
  return values
}

// 시계 바늘과 부채꼴로 간격을 고르는 공통 다이얼. 분·초 단위와 허용값을 호출부에서 지정한다.
export default function IntervalDial({
  value,
  step,
  options,
  unit,
  onChange,
  label,
  size = SIZE,
  disabled = false,
}: {
  value: number
  step: number
  options?: readonly number[]
  unit: string
  onChange: (value: number) => void
  label: string
  size?: number
  disabled?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const isDragging = useRef(false)
  const values = [...(options ?? valuesForStep(step))].sort((a, b) => a - b)
  const normalizedValues = values.length ? values : [UNITS_PER_TURN]
  const maxValue = Math.max(...normalizedValues)
  const degrees = (value / UNITS_PER_TURN) * 360
  const handEnd = polar(degrees, HAND_RADIUS)
  const arcEnd = polar(degrees, FACE_RADIUS - 4)
  const arcStart = polar(0, FACE_RADIUS - 4)
  const isFullTurn = value >= UNITS_PER_TURN

  const pickFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled) return
    const svg = svgRef.current
    if (svg === null) return
    const rect = svg.getBoundingClientRect()
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    const pointerDegrees = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    const pointerValue = (pointerDegrees / 360) * UNITS_PER_TURN
    const next = normalizedValues.reduce((nearest, candidate) => {
      const distance = Math.min(Math.abs(pointerValue - candidate), UNITS_PER_TURN - Math.abs(pointerValue - candidate))
      const nearestDistance = Math.min(Math.abs(pointerValue - nearest), UNITS_PER_TURN - Math.abs(pointerValue - nearest))
      return distance < nearestDistance ? candidate : nearest
    })
    if (next !== value) onChange(next)
  }
  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (disabled) return
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
    if (disabled) return
    const currentIndex = normalizedValues.indexOf(value)
    const baseIndex = currentIndex >= 0 ? currentIndex : normalizedValues.findIndex(option => option >= value)
    const index = baseIndex < 0 ? normalizedValues.length - 1 : baseIndex
    let nextIndex: number | undefined
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextIndex = Math.min(normalizedValues.length - 1, index + 1)
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextIndex = Math.max(0, index - 1)
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = normalizedValues.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    onChange(normalizedValues[nextIndex])
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={size}
      height={size}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={label}
      aria-valuemin={normalizedValues[0]}
      aria-valuemax={maxValue}
      aria-valuenow={value}
      aria-valuetext={`${value}${unit}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onKeyDown={handleKeyDown}
      className={`shrink-0 touch-none text-ui-white outline-none ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="var(--ui-control)" />
      {isFullTurn ? (
        <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS - 4} fill="var(--ui-control-hover)" />
      ) : (
        <path d={`M ${CENTER} ${CENTER} L ${arcStart.x} ${arcStart.y} A ${FACE_RADIUS - 4} ${FACE_RADIUS - 4} 0 ${degrees > 180 ? 1 : 0} 1 ${arcEnd.x} ${arcEnd.y} Z`} fill="var(--ui-control-hover)" />
      )}
      {Array.from({ length: UNITS_PER_TURN / 5 }, (_, index) => {
        const tickDegrees = index * 30
        const outer = polar(tickDegrees, FACE_RADIUS)
        const inner = polar(tickDegrees, FACE_RADIUS - (index % 3 === 0 ? 6 : 3))
        return <line key={tickDegrees} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="currentColor" strokeWidth={index % 3 === 0 ? 1.6 : 1} strokeLinecap="round" opacity={0.7} />
      })}
      <line x1={CENTER} y1={CENTER} x2={handEnd.x} y2={handEnd.y} stroke="var(--brand)" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={CENTER} cy={CENTER} r={2.6} fill="var(--brand)" />
    </svg>
  )
}
