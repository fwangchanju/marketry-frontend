import { useLayoutEffect, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { TOOLBAR_SIDE_GUTTER } from '@/utils/phonePathBar'
import { usePhoneToolbar } from './PhoneToolbarContext'

// 폰 팝업 전용 배율. 툴바는 화면 폭에 맞춰 작게 그리지만, 그 아래에 열리는 팝업은
// 읽기 쉽도록 툴바 축소(0.863)를 빼고 각 팝업의 원본 CSS 크기로 그린다.
// 화면 폭 393px(가용 381px)에 5종 모두 들어간다.
// 바꿀 때는 이 값만 조절하면 위치 보정·클램프·간격이 함께 따라온다.
const POPUP_FIXED_SCALE = 1.0

// 툴바 버튼 아래에 열리는 팝업 공통 부품.
// PC는 예전처럼 트리거 기준 absolute로 그대로 열고, 폰 프레임에서는 document.body로 옮겨
// 화면 가로 안쪽으로 클램프한다. 툴바 배율과 팝업 배율은 분리되어 있다.
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
  const { isPhone } = usePhoneToolbar()

  // 팝업이 열려 있는 동안 레이아웃이 바뀔 수 있어 매 렌더마다 트리거를 다시 측정한다.
  // 상태를 두면 effect 안의 setState로 연쇄 렌더가 생기므로 DOM 스타일을 직접 갱신한다.
  useLayoutEffect(() => {
    if (!open || !isPhone) return
    const trigger = triggerRef.current
    const popup = popupRef.current
    if (!trigger || !popup) return
    const triggerRect = trigger.getBoundingClientRect()
    // transform 전 레이아웃 폭을 재고 팝업 배율을 곱해 화면에 실제로 차지하는 폭을 구한다.
    const visualWidth = popup.offsetWidth * POPUP_FIXED_SCALE
    const maxLeft = Math.max(TOOLBAR_SIDE_GUTTER, window.innerWidth - TOOLBAR_SIDE_GUTTER - visualWidth)
    popup.style.left = `${Math.min(Math.max(triggerRect.left, TOOLBAR_SIDE_GUTTER), maxLeft)}px`
    popup.style.top = `${triggerRect.bottom + gapPx * POPUP_FIXED_SCALE}px`
    popup.style.visibility = 'visible'
  })

  if (!open) return null

  if (!isPhone) {
    return (
      <div ref={popupRef} role="dialog" aria-label={ariaLabel} className={`absolute left-0 top-full z-50 ${className}`} style={{ marginTop: `${gapPx}px` }}>
        {children}
      </div>
    )
  }

  // z-[70] — 폰 지도 프레임이 z-[60] stacking context라 그 안의 헤더보다 위에 그려져야 한다.
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
