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
      setRect({ left: box.left, top: box.top, width: box.width, height: box.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      setRect(null)
    }
  }, [isActive])
  return isActive ? rect : null
}
