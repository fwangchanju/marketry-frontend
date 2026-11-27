import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

// 팝업 목록에서 손가락을 누른 채 위아래로 밀면 손가락 밑 항목으로 바탕이 따라가고, 손을 뗀 항목이 선택된다(아이폰 길게 누르기 메뉴와 같은 방식, 2026-11-27 사용자 결정).
// 마우스는 건드리지 않는다(PC는 기존 마우스 올림·클릭 그대로). 항목에는 data-slide-item을, 누르는 중인 항목에는 data-touch-active를 붙인다.
// 사용법: 목록을 감싸는 요소에 반환값을 그대로 펼쳐 넣고, 항목 버튼에 data-slide-item과 data-[touch-active]:bg-ui-white/10 같은 바탕을 준다.
// 막힌 항목(aria-disabled="true")은 바탕도 선택도 하지 않는다. 손을 목록 밖에서 떼면 아무것도 고르지 않는다.
const ITEM_SELECTOR = '[data-slide-item]'
const ACTIVE_ATTR = 'data-touch-active'
// 손을 뗀 뒤 브라우저가 스스로 보내는 클릭을 막는 시간. 우리가 직접 누른 클릭과 겹쳐 두 번 고르지 않게 한다.
const NATIVE_CLICK_GUARD_MS = 400

export function useTouchSlideSelect() {
  const pointerIdRef = useRef<number | null>(null)
  const activeRef = useRef<HTMLElement | null>(null)
  const bypassRef = useRef(false)
  const guardUntilRef = useRef(0)

  const setActive = useCallback((element: HTMLElement | null) => {
    if (activeRef.current === element) return
    activeRef.current?.removeAttribute(ACTIVE_ATTR)
    activeRef.current = element
    element?.setAttribute(ACTIVE_ATTR, '')
  }, [])
  useEffect(() => () => setActive(null), [setActive])

  const itemAt = (container: HTMLElement, x: number, y: number) => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>(ITEM_SELECTOR) ?? null
    if (!element || !container.contains(element) || element.getAttribute('aria-disabled') === 'true') return null
    return element
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse') return
    pointerIdRef.current = event.pointerId
    // 터치는 처음 누른 요소에 붙잡혀 있어서, 풀어 줘야 손가락이 옮겨 간 항목에서 손 떼기가 일어난다.
    const target = event.target as Element
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
    setActive(itemAt(event.currentTarget, event.clientX, event.clientY))
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    setActive(itemAt(event.currentTarget, event.clientX, event.clientY))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    const item = itemAt(event.currentTarget, event.clientX, event.clientY)
    setActive(null)
    guardUntilRef.current = performance.now() + NATIVE_CLICK_GUARD_MS
    if (!item) return
    bypassRef.current = true
    try { item.click() } finally { bypassRef.current = false }
  }
  const onPointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerId !== pointerIdRef.current) return
    pointerIdRef.current = null
    setActive(null)
  }
  // 손 뗀 직후 브라우저가 보내는 클릭은 막는다. 선택은 위 onPointerUp이 한 번만 한다. 키보드 Enter·Space 클릭은 그대로 통과한다.
  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (bypassRef.current) return
    if (performance.now() < guardUntilRef.current) {
      guardUntilRef.current = 0
      event.preventDefault()
      event.stopPropagation()
    }
  }

  // 손가락으로 밀 때 화면이 스크롤되거나 누름이 취소되지 않게 한다. 두 팝업 목록은 스크롤이 없다.
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture, style: { touchAction: 'none' as const } }
}
