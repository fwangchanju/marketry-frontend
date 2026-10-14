import { useLayoutEffect, useRef } from 'react'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'

const SIDE_SLIDE_MS = 500

// 설정창을 화면 왼쪽에 붙일지 — 지도·그룹 페이지가 같은 값을 공유하는 이 브라우저만의 화면 취향이다(저장 키 하나).
// 반환하는 rowRef를 설정창과 지도 줄이 함께 들어 있는 한 줄(flex)에 붙이면, 좌우를 바꿀 때 설정창과 지도가 서로 자리를 옮기며 미끄러진다.
export function useSettingsPanelSide() {
  const [isOnLeft, setIsOnLeft] = useLocalPersistedState('settings-panel-on-left', false)
  const rowRef = useRef<HTMLDivElement>(null)
  // 바꾸기 직전 줄 안 각 칸의 위치. 바꾼 뒤(layout) 새 위치와 비교해서 그 차이만큼 되돌려 놓고 0으로 미끄러뜨린다(FLIP).
  const beforeRects = useRef<Map<Element, DOMRect> | null>(null)

  const toggleSide = () => {
    const row = rowRef.current
    if (row) beforeRects.current = new Map(Array.from(row.children, child => [child, child.getBoundingClientRect()]))
    setIsOnLeft(prev => !prev)
  }

  useLayoutEffect(() => {
    const before = beforeRects.current
    beforeRects.current = null
    const row = rowRef.current
    if (!before || !row) return
    for (const child of Array.from(row.children)) {
      const from = before.get(child)
      if (!(child instanceof HTMLElement) || !from) continue
      const distance = from.left - child.getBoundingClientRect().left
      if (!distance) continue
      // 설정창은 지나가는 동안 지도 위에 보이게 한다.
      const isSettings = child.querySelector('[data-settings-panel-shell]') !== null
      if (isSettings) child.style.zIndex = '30'
      const animation = child.animate(
        [{ transform: `translateX(${distance}px)` }, { transform: 'translateX(0)' }],
        { duration: SIDE_SLIDE_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
      )
      animation.onfinish = animation.oncancel = () => { if (isSettings) child.style.zIndex = '' }
    }
  }, [isOnLeft])

  return { isOnLeft, toggleSide, rowRef }
}
