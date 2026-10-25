import { useLayoutEffect, useState } from 'react'

// 창(안내·확인·로그인 등)은 화면 전체가 아니라 메인 영역(설정창과 상단 영역을 뺀 가운데 부분)의 가운데에 놓는다. 설정창을 왼쪽·오른쪽으로 옮기거나
// 접으면 메인 영역이 달라지므로, 창이 떠 있는 동안 그 영역의 위치·크기를 따라간다. 메인 영역이 없는 화면(홈·프로필 등)에서는 화면 가운데다.
export interface MainAreaRect {
  left: number
  top: number
  width: number
  height: number
}

export function useMainAreaRect(isActive: boolean): MainAreaRect | null {
  const [rect, setRect] = useState<MainAreaRect | null>(null)
  useLayoutEffect(() => {
    if (!isActive) return
    const element = document.querySelector<HTMLElement>('[data-main-area]')
    if (!element) return
    const measure = () => {
      const box = element.getBoundingClientRect()
      // Dialog는 viewport 좌표로 배치되므로, 화면 밖으로 밀린 메인 영역 좌표를 그대로 쓰면
      // 팝업도 화면 밖에 렌더링된다. 현재 보이는 viewport 안쪽으로 영역을 제한한다.
      const viewportWidth = document.documentElement.clientWidth
      const left = Math.max(0, Math.min(box.left, viewportWidth))
      const right = Math.max(left, Math.min(box.right, viewportWidth))
      const width = right - left
      if (width < 1) {
        setRect(null)
        return
      }
      setRect({ left, top: 0, width, height: window.innerHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    document.addEventListener('scroll', measure, true)
    window.visualViewport?.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('scroll', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      document.removeEventListener('scroll', measure, true)
      window.visualViewport?.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('scroll', measure)
      setRect(null)
    }
  }, [isActive])
  return isActive ? rect : null
}
