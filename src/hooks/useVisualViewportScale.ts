import { useEffect, useState } from 'react'

function currentScale(): number {
  if (typeof window === 'undefined') return 1
  return window.visualViewport?.scale || 1
}

// 브라우저·OS의 화면 확대 배율. 폰 종목 지도에서 커진 박스 기준으로 종목명을 다시 맞추는 데 쓴다.
// 앱 안의 줌(업종 지도)과 달리 화면 확대는 레이아웃을 바꾸지 않고 그리기만 키우므로, 배율을 읽어 라벨 계산에 넘긴다.
export function useVisualViewportScale(): number {
  const [scale, setScale] = useState(currentScale)
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setScale(currentScale())
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    update()
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])
  return scale
}
