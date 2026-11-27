import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'

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
// 뷰포트 메타는 iOS Safari가 무시하고, 헤드리스에서만 먹히는 확인이었다. 실제 MOBILE에서도 막히도록
// 문서 루트와 본문 모두 세로 스크롤만 허용하고, 두 손가락이 닿은 뒤의 이동을 캡처 단계에서 취소한다.
// iOS는 touches.length와 별도로 scale을 주므로 둘 다 본다.
export function useDisableScreenZoom(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const previousMeta = meta?.content
    const root = document.documentElement
    const previousRootTouchAction = root.style.touchAction
    const previousBodyTouchAction = document.body.style.touchAction
    if (meta) meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
    root.style.touchAction = 'pan-y'
    document.body.style.touchAction = 'pan-y'
    const block = (event: Event) => event.preventDefault()
    const blockPinch = (event: TouchEvent) => {
      const scale = (event as TouchEvent & { scale?: number }).scale
      if (event.touches.length > 1 || (typeof scale === 'number' && scale !== 1)) event.preventDefault()
    }
    const touchOptions: AddEventListenerOptions = { capture: true, passive: false }
    document.addEventListener('gesturestart', block, { passive: false })
    document.addEventListener('gesturechange', block, { passive: false })
    document.addEventListener('gestureend', block, { passive: false })
    document.addEventListener('touchstart', blockPinch, touchOptions)
    document.addEventListener('touchmove', blockPinch, touchOptions)
    return () => {
      if (meta && previousMeta !== undefined) meta.content = previousMeta
      root.style.touchAction = previousRootTouchAction
      document.body.style.touchAction = previousBodyTouchAction
      document.removeEventListener('gesturestart', block)
      document.removeEventListener('gesturechange', block)
      document.removeEventListener('gestureend', block)
      document.removeEventListener('touchstart', blockPinch, touchOptions)
      document.removeEventListener('touchmove', blockPinch, touchOptions)
    }
  }, [enabled])
}

// 손가락 아래에서 판 안쪽으로 스크롤되는 영역(그룹 등락률 막대 목록 등). 이 영역이 끝에 닿지 않았으면 위아래 밀기는 스크롤에 맡긴다.
function findVerticalScroller(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  let node = target instanceof Element ? target : null
  while (node && node !== root) {
    if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight + 1) {
      const overflowY = window.getComputedStyle(node).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') return node
    }
    node = node.parentElement
  }
  return null
}

// 위아래 밀기로 넘어갈 수 있는지 — 안쪽 스크롤 영역이 있으면 미는 방향의 끝에 닿아 있을 때만.
// 손가락을 위로 밀면(dy < 0) 내용은 아래쪽으로 스크롤되므로 맨 아래에 닿아 있어야 한다.
function scrollerAtEdge(scroller: HTMLElement | null, dy: number): boolean {
  if (!scroller) return true
  return dy < 0 ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1 : scroller.scrollTop <= 0
}

// 모바일 페이지의 슬라이드 이동. 좌우: 왼쪽으로 밀면 next, 오른쪽으로 밀면 previous(페이지 이동).
// 위아래(vertical을 넘길 때만, element는 이벤트를 붙일 판): 위로 밀면 next(국가 변경), 아래로 밀면 previous — MOBILE 지도는 아래로 밀기를 쓰지 않고 브라우저에 맡긴다(2026-11-27 사용자 결정, 새로고침 판은 별로라 뺌). 미리보기 판 없이 지금 판만 밀려 나간다.
export function useMobilePageSwipe(enabled: boolean, onNext: () => void, onPrevious: () => void, onBeforeNavigate?: (direction: 'next' | 'previous') => void, allowPinchZoom = true, onSwipeStart?: () => void, vertical?: { element: HTMLElement | null; onSwipe: (direction: 'next' | 'previous') => void; allowPrevious?: boolean }) {
  const element = vertical?.element ?? null
  const onVerticalSwipe = vertical?.onSwipe
  // false면 아래로 밀기(previous)는 받지 않고 브라우저에 맡긴다(브라우저의 당겨서 새로고침 등).
  const allowPrevious = vertical?.allowPrevious ?? true
  const zoomed = useIsMobilePageZoomed()
  const startRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const suppressClickRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [verticalOffset, setVerticalOffset] = useState(0)
  // 위아래 전환 중에는 좌우 미리보기 판(종목 전체를 그리는 무거운 판)을 그리지 않는다.
  const [verticalSettling, setVerticalSettling] = useState(false)
  const [settling, setSettling] = useState(false)
  // 위아래 밀기는 브라우저의 세로 스크롤·당겨서 새로고침을 막아야 해서(touchmove 취소) 판에 직접 붙인 터치 이벤트로 받는다.
  // React의 터치 이벤트는 취소할 수 없는 방식으로 붙는다. 최신 값은 ref로 읽는다.
  const latestRef = useRef({ settling, onVerticalSwipe, onSwipeStart })
  useEffect(() => { latestRef.current = { settling, onVerticalSwipe, onSwipeStart } })
  const verticalEnabled = enabled && Boolean(onVerticalSwipe)
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
  // 위아래 전환. 다른 나라도 같은 화면 부품을 쓰면 판이 그대로 남으므로, 넘어간 뒤 제자리로 돌려 새 나라의 로딩 화면이 보이게 한다.
  const settleVertical = useCallback((target: number, then?: () => void) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReducedMotion(reduced)
    setSettling(true)
    setVerticalSettling(true)
    setVerticalOffset(target)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      then?.()
      setSettling(false)
      setVerticalSettling(false)
      setVerticalOffset(0)
    }, reduced ? 0 : MOBILE_PAGE_SWIPE_SETTLE_MS)
  }, [])
  useEffect(() => {
    if (!verticalEnabled || !element) return
    let gesture: { id: number; x: number; y: number; vertical: boolean; scroller: HTMLElement | null } | null = null
    let lastDy = 0
    const onTouchStart = (event: TouchEvent) => {
      gesture = null
      if (event.touches.length !== 1 || latestRef.current.settling || isMobilePageZoomed()) return
      const touch = event.touches[0]
      if (touch.clientX <= EDGE_GUARD || touch.clientX >= window.innerWidth - EDGE_GUARD) return
      // 확대된 지도 안의 한 손가락 드래그는 지도 이동이다(좌우 밀기와 같은 판정).
      const map = (event.target as HTMLElement).closest<HTMLElement>('[data-mobile-map-scale]')
      if (map && Number(map.dataset.mobileMapScale) > 1.05) return
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, vertical: false, scroller: findVerticalScroller(event.target, element) }
    }
    const onTouchMove = (event: TouchEvent) => {
      const current = gesture
      if (!current) return
      const touch = Array.from(event.touches).find(item => item.identifier === current.id)
      // 두 번째 손가락이 닿으면 확대 동작이다. 밀던 판을 되돌린다.
      if (!touch || event.touches.length !== 1) {
        gesture = null
        if (current.vertical) settleVertical(0)
        return
      }
      const dx = touch.clientX - current.x
      const dy = touch.clientY - current.y
      if (!current.vertical) {
        if (Math.abs(dy) <= Math.abs(dx)) {
          // 좌우 밀기 쪽으로 기울면 페이지 이동(포인터 처리)에 맡기고 손을 뗀다.
          if (Math.abs(dx) >= 4) gesture = null
          return
        }
        // 아래로 밀기를 받지 않으면 손을 떼고 브라우저에 맡긴다. 안쪽 스크롤이 끝에 닿지 않았으면 이번 밀기는 스크롤이다.
        if ((dy > 0 && !allowPrevious) || !scrollerAtEdge(current.scroller, dy)) { gesture = null; return }
        // 정하기 전 작은 움직임에도 취소해 둬야 브라우저가 먼저 스크롤·새로고침을 시작하지 않는다.
        if (event.cancelable) event.preventDefault()
        if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(dx) * 1.1) return
        current.vertical = true
        latestRef.current.onSwipeStart?.()
      }
      if (event.cancelable) event.preventDefault()
      lastDy = allowPrevious ? dy : Math.min(dy, 0)
      setVerticalOffset(lastDy)
    }
    const onTouchEnd = (event: TouchEvent) => {
      const current = gesture
      if (!current || Array.from(event.changedTouches).every(item => item.identifier !== current.id)) return
      gesture = null
      if (!current.vertical) return
      const height = element.clientHeight || window.innerHeight
      const moved = event.type === 'touchend' && Math.abs(lastDy) >= Math.max(24, height * 0.08) && (lastDy < 0 || allowPrevious)
      if (!moved) { settleVertical(0); return }
      const direction = lastDy < 0 ? 'next' : 'previous'
      suppressClickRef.current = true
      window.setTimeout(() => { suppressClickRef.current = false }, 0)
      settleVertical(lastDy < 0 ? -height : height, () => latestRef.current.onVerticalSwipe?.(direction))
    }
    element.addEventListener('touchstart', onTouchStart, { passive: true })
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    element.addEventListener('touchend', onTouchEnd)
    element.addEventListener('touchcancel', onTouchEnd)
    return () => {
      element.removeEventListener('touchstart', onTouchStart)
      element.removeEventListener('touchmove', onTouchMove)
      element.removeEventListener('touchend', onTouchEnd)
      element.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [allowPrevious, element, settleVertical, verticalEnabled])
  const onPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    // 두 번째 손가락이 닿으면 확대 동작이다. 밀던 판을 되돌리고 페이지 전환을 받지 않는다.
    if (!event.isPrimary) {
      startRef.current = null
      if (offset !== 0 && !settling) settle(0)
      return
    }
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
    if (Math.abs(dx) < 4 || !isHorizontal(dx, event.clientY - start.y)) return
    if (offset === 0) onSwipeStart?.()
    setOffset(dx)
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
  if (!enabled) return { handlers: undefined, style: undefined, offset: 0, verticalOffset: 0, active: false }
  const style: CSSProperties = {
    // 1배에서는 세로 스크롤만 브라우저에 맡기고 가로 전환은 이 훅이 처리한다. 종목 지도는 pinch-zoom을 함께
    // 넣지 않으면 브라우저가 핀치 확대 자체를 받지 않는다(2026-11-25 실제 핀치 확인). 확대 후에는 한 손가락으로
    // 보이는 화면을 이동할 수 있게 auto로 바꾼다. 업종 지도·그룹 등락률은 확대 상태여도 auto로 풀지 않는다 —
    // 종목 지도에서 확대한 채 넘어오면 안쪽 판이 다시 확대를 허용하는 구멍이 된다.
    touchAction: allowPinchZoom ? (zoomed ? 'auto' : 'pan-y pinch-zoom') : 'pan-y',
    transform: offset !== 0 ? `translateX(${offset}px)` : verticalOffset !== 0 ? `translateY(${verticalOffset}px)` : undefined,
    transition: settling ? `transform ${reducedMotion ? 0 : MOBILE_PAGE_SWIPE_SETTLE_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)` : undefined,
  }
  return { handlers: { onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture, onPointerCancelCapture, onClickCapture }, style, offset, verticalOffset, active: offset !== 0 || (settling && !verticalSettling) }
}
