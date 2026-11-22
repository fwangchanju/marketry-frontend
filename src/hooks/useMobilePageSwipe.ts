import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

// 화면 확대 중 오스와이프를 막기 위해, 스와이프는 보이는 화면의 양 끝 이 비율 안에서만 시작할 수 있다.
// 다음 판(왼쪽으로 밀기)은 오른쪽 끝에서, 이전 판(오른쪽으로 밀기)은 왼쪽 끝에서만 허용한다.
// visualViewport 기준으로 잡아야 확대해도 보이는 화면의 끝과 어긋나지 않는다.
const SWIPE_EDGE_RATIO = 0.2
// 한국 업종·그룹 화면의 전환과 같은 값 — 한 곳에서 관리해 시장·화면마다 속도가 어긋나지 않게 한다.
export const MOBILE_PAGE_SWIPE_SETTLE_MS = 500

// 모바일 페이지의 좌우 슬라이드 이동. 왼쪽으로 밀면 next, 오른쪽으로 밀면 previous로 간다.
export function useMobilePageSwipe(enabled: boolean, onNext: () => void, onPrevious: () => void, onBeforeNavigate?: (direction: 'next' | 'previous') => void) {
  const startRef = useRef<{ pointerId: number; x: number; y: number; edge: 'left' | 'right' | null } | null>(null)
  const suppressClickRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [settling, setSettling] = useState(false)
  // 애니메이션을 줄이기 설정에서는 타이머와 CSS 전환이 함께 0이 돼야 한다. 타이머만 0이면 페이지가 바뀐 뒤 판이 계속 움직인다.
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current) }, [])
  const isHorizontal = (dx: number, dy: number) => Math.abs(dx) >= Math.abs(dy) * 1.1
  const settle = (target: number, then?: () => void, direction?: 'next' | 'previous') => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReducedMotion(reduced)
    const duration = reduced ? 0 : MOBILE_PAGE_SWIPE_SETTLE_MS
    setSettling(true)
    setOffset(target)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setSettling(false)
      // 새 주소가 붙기 전에 미리보기 판을 덮어 둔다. 방향은 화면마다 어느 쪽이 종목 지도인지 다르므로 그대로 넘긴다.
      if (direction) onBeforeNavigate?.(direction)
      then?.()
    }, duration)
  }
  const onPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    if (settling) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // 확대 중에는 보이는 화면이 레이아웃 화면과 달라지므로 visualViewport를 기준으로 양 끝을 잡는다.
    const viewport = window.visualViewport
    const left = viewport?.offsetLeft ?? 0
    const right = left + (viewport?.width ?? window.innerWidth)
    const edgeWidth = (right - left) * SWIPE_EDGE_RATIO
    const edge = event.clientX <= left + edgeWidth ? 'left' : event.clientX >= right - edgeWidth ? 'right' : null
    if (!edge) return
    startRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, edge }
  }
  const onPointerMoveCapture = (event: PointerEvent<HTMLElement>) => {
    const start = startRef.current
    if (!start || start.pointerId !== event.pointerId || settling) return
    const dx = event.clientX - start.x
    const allowedEdge = dx < 0 ? 'right' : 'left'
    if (start.edge !== allowedEdge) return
    if (Math.abs(dx) >= 4 && isHorizontal(dx, event.clientY - start.y)) setOffset(dx)
  }
  const onPointerUpCapture = (event: PointerEvent<HTMLElement>) => {
    const start = startRef.current
    if (!start || start.pointerId !== event.pointerId) return
    startRef.current = null
    const dx = event.clientX - start.x
    // 오른쪽 끝에서 시작한 왼쪽 밀기만 다음 판으로, 왼쪽 끝에서 시작한 오른쪽 밀기만 이전 판으로 간다.
    const allowedEdge = dx < 0 ? 'right' : 'left'
    const moved = start.edge === allowedEdge && Math.abs(dx) >= Math.max(24, window.innerWidth * 0.08) && isHorizontal(dx, event.clientY - start.y)
    if (!moved) {
      if (offset !== 0) settle(0)
      return
    }
    suppressClickRef.current = true
    window.setTimeout(() => { suppressClickRef.current = false }, 0)
    settle(dx < 0 ? -window.innerWidth : window.innerWidth, dx < 0 ? onNext : onPrevious, dx < 0 ? 'next' : 'previous')
  }
  const onPointerCancelCapture = (event: PointerEvent<HTMLElement>) => {
    if (startRef.current?.pointerId !== event.pointerId) return
    startRef.current = null
    if (offset !== 0) settle(0)
  }
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) return
    suppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }
  // 상단 페이지 이동 버튼도 손가락 스와이프와 같은 settle 경로로 다음 판을 밀어 준다.
  const next = () => {
    if (settling) return
    settle(-window.innerWidth, onNext, 'next')
  }
  if (!enabled) return { handlers: undefined, style: undefined, offset: 0, next: () => {} }
  const style: CSSProperties = {
    touchAction: 'pan-y',
    transform: offset === 0 ? undefined : `translateX(${offset}px)`,
    transition: settling ? `transform ${reducedMotion ? 0 : MOBILE_PAGE_SWIPE_SETTLE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)` : undefined,
  }
  return { handlers: { onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture, onPointerCancelCapture, onClickCapture }, style, offset, next }
}
