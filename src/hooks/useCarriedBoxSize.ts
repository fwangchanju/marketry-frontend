import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// MOBILE 지도 하단 줄에서 마켓을 바꿀 때 고른 박스 크기가 실려 온다(페이지 이동 상태로만 전달, 저장소에는 쓰지 않는다).
// 도착한 지도는 그 값을 자기 박스 크기 설정으로 한 번 적용한다.
export function useCarriedBoxSize(apply: (value: number) => void) {
  const location = useLocation()
  const carried = (location.state as { mobileBoxSize?: unknown } | null)?.mobileBoxSize
  useEffect(() => {
    if (typeof carried === 'number') apply(carried)
    // 이동해 들어온 순간에 한 번만 적용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
