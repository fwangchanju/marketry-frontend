import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

// 브라우저 가장자리 뒤로가기 제스처와 겹치지 않게, 좌우 이 폭 안에서 시작한 슬라이드는 무시한다(지도 화면과 같은 값).
const EDGE_GUARD = 24
// 한국 업종·그룹 화면의 전환과 같은 값 — 한 곳에서 관리해 시장·화면마다 속도가 어긋나지 않게 한다.
export const MOBILE_PAGE_SWIPE_SETTLE_MS = 500

// 브라우저·디스플레이에서 화면을 확대하면 가로 드래그가 지도 조작과 겹치므로 페이지 전환을 받지 않는다.
export function isMobilePageZoomed(): boolean {
  return typeof window !== 'undefined' && (window.visualViewport?.scale ?? 1) > 1.01
}

// 확대 상태를 렌더에도 반영한다. 확대 중에는 페이지 전환 대신 브라우저의 한 손가락 화면 이동을 살려야
// 하므로 touch-action을 바꿔 준다(판정만으로는 이미 그려진 touch-action이 남는다).
export function useIsMobilePageZoomed(): boolean {
  const [zoomed, setZoomed] = useState(isMobilePageZoomed)
  useEffect(() => {
    const update = () => setZoomed(isMobilePageZoomed())
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return zoomed
}

// 업종 지도·그룹 등락률 화면에서는 화면 확대 자체를 받지 않는다. 확대되면 지도 조작과 페이지 전환이 겹친다.
// 뷰포트 메타로 제한하고, iOS Safari는 user-scalable=no를 무시하므로 제스처 이벤트도 함께 막는다.
export function useDisableScreenZoom(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const previous = meta?.content
    if (meta) meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    const block = (event: Event) => event.preventDefault()
    document.addEventListener('gesturestart', block, { passive: false })
    document.addEventListener('gesturechange', block, { passive: false })
    document.addEventListener('gestureend', block, { passive: false })
    return () => {
      if (meta && previous !== undefined) meta.content = previous
      document.removeEventListener('gesturestart', block)
      document.removeEventListener('gesturechange', block)
      document.removeEventListener('gestureend', block)
    }
  }, [enabled])
}

// 모바일 페이지의 좌우 슬라이드 이동. 왼쪽으로 밀면 next, 오른쪽으로 밀면 previous로 간다.
export function useMobilePageSwipe(enabled: boolean, onNext: () => void, onPrevious: () => void, onBeforeNavigate?: (direction: 'next' | 'previous') => void) {
  const zoomed = useIsMobilePageZoomed()
  const startRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
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
    if (isMobilePageZoomed() || settling || event.clientX <= EDGE_GUARD || event.clientX >= window.innerWidth - EDGE_GUARD) return
    // 확대된 지도 안의 한 손가락 드래그는 지도 이동이다. 화면 확대가 아니어도 페이지 전환을 받지 않는다.
    const map = (event.target as HTMLElement).closest<HTMLElement>('[data-mobile-map-scale]')
    if (map && Number(map.dataset.mobileMapScale) > 1.05) return
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
    // 화면을 확대하면 가로 드래그를 브라우저가 받아 보이는 영역을 이동해야 한다. 기존 'pan-y'는 가로를 막는다.
    touchAction: zoomed ? 'auto' : 'pan-y',
    transform: offset === 0 ? undefined : `translateX(${offset}px)`,
    transition: settling ? `transform ${reducedMotion ? 0 : MOBILE_PAGE_SWIPE_SETTLE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)` : undefined,
  }
  return { handlers: { onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture, onPointerCancelCapture, onClickCapture }, style, offset, next }
}
