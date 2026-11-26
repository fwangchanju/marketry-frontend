import { useLayoutEffect, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { TOOLBAR_SIDE_GUTTER } from '@/utils/mobilePathBar'
import { MOBILE_POPUP_SCALE, mobilePopupTop } from '@/utils/mobilePopupScale'
import { useMobileToolbar } from './MobileToolbarContext'

// 화면 폭 393px(가용 381px)에 5종 모두 들어간다.
const POPUP_FIXED_SCALE = MOBILE_POPUP_SCALE

// 툴바 버튼 아래에 열리는 팝업 공통 부품.
// PC는 예전처럼 트리거 기준 absolute로 그대로 열고, MOBILE 프레임에서는 document.body로 옮겨
// 지도 길게 누르기 팝업과 같은 자리(가로 가운데, 세로 가운데가 화면 높이 55%)에 띄운다 — 툴바 바로 아래는 엄지가 닿기 어렵다(2026-11-27 사용자 결정).
// 툴바 배율과 팝업 배율은 분리되어 있다.
type Props = {
  open: boolean
  triggerRef: RefObject<HTMLElement | null>
  popupRef: RefObject<HTMLDivElement | null>
  ariaLabel: string
  className: string
  children: ReactNode
  gapPx?: number
}

export default function ToolbarPopup({ open, triggerRef, popupRef, ariaLabel, className, children, gapPx = 4 }: Props) {
  const { isMobile } = useMobileToolbar()

  // 팝업이 열려 있는 동안 레이아웃이 바뀔 수 있어 매 렌더마다 트리거를 다시 측정한다.
  // 상태를 두면 effect 안의 setState로 연쇄 렌더가 생기므로 DOM 스타일을 직접 갱신한다.
  useLayoutEffect(() => {
    if (!open || !isMobile) return
    const trigger = triggerRef.current
    const popup = popupRef.current
    if (!trigger || !popup) return
    // transform이 적용된 실제 화면 크기를 쓴다. offsetWidth(정수 반올림)에 배율을 곱하면
    // 서브픽셀 오차로 오른쪽 끝이 여백 1px을 넘을 수 있다.
    const { width: visualWidth, height: visualHeight } = popup.getBoundingClientRect()
    popup.style.left = `${Math.max(TOOLBAR_SIDE_GUTTER, (window.innerWidth - visualWidth) / 2)}px`
    popup.style.top = `${mobilePopupTop(window.innerHeight, visualHeight)}px`
    popup.style.visibility = 'visible'
  })

  if (!open) return null

  if (!isMobile) {
    return (
      <div ref={popupRef} role="dialog" aria-label={ariaLabel} className={`absolute left-0 top-full z-50 ${className}`} style={{ marginTop: `${gapPx}px` }}>
        {children}
      </div>
    )
  }

  // z-[70] — MOBILE 지도 프레임이 z-[60] stacking context라 그 안의 헤더보다 위에 그려져야 한다.
  return createPortal(
    <div
      ref={popupRef}
      role="dialog"
      aria-label={ariaLabel}
      className={`z-[70] ${className}`}
      style={{
        position: 'fixed',
        left: TOOLBAR_SIDE_GUTTER,
        top: 0,
        transform: `scale(${POPUP_FIXED_SCALE})`,
        transformOrigin: 'top left',
        visibility: 'hidden',
      } as CSSProperties}
    >
      {children}
    </div>,
    document.body,
  )
}
