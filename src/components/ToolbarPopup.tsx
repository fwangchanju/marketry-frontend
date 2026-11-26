import { useLayoutEffect, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { TOOLBAR_SIDE_GUTTER } from '@/utils/mobilePathBar'
import { MOBILE_PANEL_CLASS, MOBILE_POPUP_BACKDROP_CLASS, MOBILE_POPUP_SCALE, MOBILE_POPUP_STRETCH_CLASS, MOBILE_POPUP_TOUCH_VARS, MOBILE_POPUP_Z_CLASS, mobilePopupMinWidth, mobilePopupTopAboveToolbar } from '@/utils/mobilePopupScale'
import { useMobileToolbar } from './MobileToolbarContext'
import { useSwallowOutsideTap } from '@/utils/swallowNextClick'

// 화면 폭 393px(가용 381px)에 5종 모두 들어간다.
const POPUP_FIXED_SCALE = MOBILE_POPUP_SCALE

// 툴바 버튼 아래에 열리는 팝업 공통 부품.
// PC는 예전처럼 트리거 기준 absolute로 그대로 열고, MOBILE 프레임에서는 document.body로 옮겨
// 가로 가운데, 세로 가운데는 화면 높이 75%이고 아래 끝이 툴바 줄 위 8px보다 내려가지 않게 띄운다(2026-11-27 사용자 결정, mobilePopupTopAboveToolbar).
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
  // MOBILE에서 바깥을 눌러 닫을 때 그 누름이 아래 화면까지 눌리지 않게 한다.
  useSwallowOutsideTap(open && isMobile, [popupRef, triggerRef])

  // 팝업이 열려 있는 동안 레이아웃이 바뀔 수 있어 매 렌더마다 트리거를 다시 측정한다.
  // 상태를 두면 effect 안의 setState로 연쇄 렌더가 생기므로 DOM 스타일을 직접 갱신한다.
  useLayoutEffect(() => {
    if (!open || !isMobile) return
    const trigger = triggerRef.current
    const popup = popupRef.current
    if (!trigger || !popup) return
    // MOBILE 팝업 규칙 2번: 보이는 폭 240px보다 좁으면 넓힌다(재기 전에 넣어야 넓어진 크기로 자리를 잡는다).
    popup.style.minWidth = `${mobilePopupMinWidth()}px`
    // transform이 적용된 실제 화면 크기를 쓴다. offsetWidth(정수 반올림)에 배율을 곱하면
    // 서브픽셀 오차로 오른쪽 끝이 여백 1px을 넘을 수 있다.
    const { width: visualWidth, height: visualHeight } = popup.getBoundingClientRect()
    popup.style.left = `${Math.max(TOOLBAR_SIDE_GUTTER, (window.innerWidth - visualWidth) / 2)}px`
    popup.style.top = `${mobilePopupTopAboveToolbar(window.innerHeight, visualHeight)}px`
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

  // MOBILE 지도 프레임·툴바 줄(z-[70])보다 위에 뒤 화면 막(z-[71])과 팝업(z-[72])을 그린다.
  // 막은 바깥 누름을 받아 아래 화면이 눌리지 않게 하고, 각 팝업은 지금처럼 바깥 누름에서 스스로 닫힌다.
  return createPortal(
    <>
    <div aria-hidden="true" className={MOBILE_POPUP_BACKDROP_CLASS} />
    <div
      ref={popupRef}
      role="dialog"
      aria-label={ariaLabel}
      className={`${MOBILE_POPUP_Z_CLASS} ${className} ${MOBILE_PANEL_CLASS} ${MOBILE_POPUP_STRETCH_CLASS}`}
      style={{
        position: 'fixed',
        left: TOOLBAR_SIDE_GUTTER,
        top: 0,
        transform: `scale(${POPUP_FIXED_SCALE})`,
        transformOrigin: 'top left',
        visibility: 'hidden',
        ...MOBILE_POPUP_TOUCH_VARS,
      } as CSSProperties}
    >
      {children}
    </div>
    </>,
    document.body,
  )
}
