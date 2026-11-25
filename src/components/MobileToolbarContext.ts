import { createContext, useContext } from 'react'

// MOBILE 지도 프레임의 툴바는 화면 폭에 맞춰 scale된 컨테이너 안에 그려진다.
// 그 안에서 absolute로 열리는 팝업은 트리거 위치에 따라 화면 밖으로 나가므로,
// 툴바 안쪽 컴포넌트가 MOBILE 프레임 여부와 배율을 알고 위치를 보정한다.
export const MobileToolbarContext = createContext<{ isMobile: boolean; scale: number }>({ isMobile: false, scale: 1 })

export function useMobileToolbar() {
  return useContext(MobileToolbarContext)
}
