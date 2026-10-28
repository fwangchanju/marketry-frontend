import { useEffect, useState } from 'react'

// 모바일 상단바용: 아래로 스크롤하면 숨기고(true), 위로 조금만 올려도 다시 보이게(false) 한다. 맨 위 근처에서는 항상 보인다.
// 창(window) 스크롤을 따른다 — 본문이 따로 스크롤되는 화면(지도 등)에는 쓰지 않는다.
// threshold: 이 값(px) 이하의 작은 움직임은 무시해 떨림을 막는다. topOffset: 이 위치(px) 안쪽에서는 숨기지 않는다.
export function useHideOnScrollDown(threshold = 8, topOffset = 48): boolean {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const y = window.scrollY
        const delta = y - lastY
        if (y <= topOffset) {
          setHidden(false)
          lastY = y
        } else if (Math.abs(delta) > threshold) {
          setHidden(delta > 0)
          lastY = y
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [threshold, topOffset])
  return hidden
}
