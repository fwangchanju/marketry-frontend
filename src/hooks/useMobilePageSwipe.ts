import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

// 브라우저 가장자리 뒤로가기 제스처와 겹치지 않게, 좌우 이 폭 안에서 시작한 슬라이드는 무시한다(지도 화면과 같은 값).
const EDGE_GUARD = 24
// 한국 업종·그룹 화면의 전환과 같은 값 — 한 곳에서 관리해 시장·화면마다 속도가 어긋나지 않게 한다.
export const MOBILE_PAGE_SWIPE_SETTLE_MS = 500

// 모바일 페이지의 좌우 슬라이드 이동. 왼쪽으로 밀면 next, 오른쪽으로 밀면 previous로 간다.
export function useMobilePageSwipe(enabled: boolean, onNext: () => void, onPrevious: () => void) {
  const startRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [settling, setSettling] = useState(false)
  // 애니메이션을 줄이기 설정에서는 타이머와 CSS 전환이 함께 0이 돼야 한다. 타이머만 0이면 페이지가 바뀐 뒤 판이 계속 움직인다.
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current) }, [])
  const isHorizontal = (dx: number, dy: number) => Math.abs(dx) >= Math.abs(dy) * 1.1
  const settle = (target: number, then?: () => void) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReducedMotion(reduced)
    const duration = reduced ? 0 : MOBILE_PAGE_SWIPE_SETTLE_MS
    setSettling(true)
    setOffset(target)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setSettling(false)
      then?.()
    }, duration)
  }
  const onPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    if (settling || event.clientX <= EDGE_GUARD || event.clientX >= window.innerWidth - EDGE_GUARD) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    startRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const onPointerMoveCapture = (event: PointerEvent<HTMLElement>) => {
    const start = startRef.current
    if (!start || start.pointerId !== event.pointerId || settling) return
    const dx = event.clientX - start.x
    if (Math.abs(dx) >= 4 && isHorizontal(dx, event.clientY - start.y)) setOffset(dx)
  }
  const onPointerUpCapture = (event: PointerEvent<HTMLElement>) => {
    const start = startRef.current
    if (!start || start.pointerId !== event.pointerId) return
    startRef.current = null
    const dx = event.clientX - start.x
    const moved = Math.abs(dx) >= Math.max(24, window.innerWidth * 0.08) && isHorizontal(dx, event.clientY - start.y)
    if (!moved) {
      if (offset !== 0) settle(0)
      return
    }
    suppressClickRef.current = true
    window.setTimeout(() => { suppressClickRef.current = false }, 0)
    settle(dx < 0 ? -window.innerWidth : window.innerWidth, dx < 0 ? onNext : onPrevious)
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
    settle(-window.innerWidth, onNext)
  }
  if (!enabled) return { handlers: undefined, style: undefined, offset: 0, next: () => {} }
  const style: CSSProperties = {
    touchAction: 'pan-y',
    transform: offset === 0 ? undefined : `translateX(${offset}px)`,
    transition: settling ? `transform ${reducedMotion ? 0 : MOBILE_PAGE_SWIPE_SETTLE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)` : undefined,
  }
  return { handlers: { onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture, onPointerCancelCapture, onClickCapture }, style, offset, next }
}
