import { useCallback, useEffect, useRef, type PointerEvent } from 'react'

// 손가락으로 길게 누르는 동작(모바일 전용) — 마우스·펜은 무시한다. 누른 채 10px 넘게 움직이면(스크롤 등) 취소한다.
// 길게 누른 뒤 손가락을 떼면 뒤따라오는 클릭은 `consumeClick()`이 true를 돌려주므로, 그때 클릭 동작(들어가기·토글)을 건너뛴다.
const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 10

export function useLongPress() {
  const pressRef = useRef<{ timer: number; x: number; y: number } | null>(null)
  const firedRef = useRef(false)
  const cancel = useCallback(() => {
    if (!pressRef.current) return
    window.clearTimeout(pressRef.current.timer)
    pressRef.current = null
  }, [])
  useEffect(() => cancel, [cancel])

  const bind = useCallback((onLongPress?: () => void) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!onLongPress || event.pointerType !== 'touch') return
      firedRef.current = false
      cancel()
      const timer = window.setTimeout(() => {
        pressRef.current = null
        firedRef.current = true
        onLongPress()
      }, LONG_PRESS_MS)
      pressRef.current = { timer, x: event.clientX, y: event.clientY }
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const press = pressRef.current
      if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: onLongPress ? (event: React.MouseEvent) => event.preventDefault() : undefined,
  }), [cancel])

  const consumeClick = useCallback(() => {
    const fired = firedRef.current
    firedRef.current = false
    return fired
  }, [])

  return { bind, consumeClick }
}
