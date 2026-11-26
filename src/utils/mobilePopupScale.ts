import type { CSSProperties } from 'react'

// MOBILE 팝업 규칙 3가지 — PC 팝업이 원본이고 MOBILE은 이 세 값만 거쳐 자동으로 바뀐다(2026-11-27 사용자 결정, docs/ui-areas.md "MOBILE 팝업 규칙").
//   1. 크기: PC 팝업을 1.3배로 그린다.
//   2. 폭: 화면 폭의 60%보다 좁으면 넓힌다.
//   3. 누르는 칸: 배지·날짜 칸이 보이는 크기 28px보다 작으면 키운다.
//   4. 위치: 툴바에서 여는 팝업은 가운데를 화면 높이 75%에 맞추고, 툴바 줄은 가리지 않는다.
// 툴바 줄 팝업(`ToolbarPopup`)·박스 크기 창·HOW TO USE가 같은 값을 쓰고, 지도 팝업(`Popup`)은 1번 배율만 쓴다.
// 지도 팝업은 화면을 확대·축소하면 visualViewport.scale로 나눠 보이는 크기를 이 값으로 유지한다.
export const MOBILE_POPUP_SCALE = 1.3
export const MOBILE_POPUP_MIN_WIDTH_RATIO = 0.6
export const MOBILE_POPUP_TOUCH_MIN_PX = 28

// 2번 — 팝업에 줄 최소 폭(배율 적용 전 CSS 값). 팝업 바로 아래 칸도 이 폭까지 늘어나게 한다(MOBILE_POPUP_STRETCH_CLASS).
export function mobilePopupMinWidth(viewportWidth: number): number {
  return (viewportWidth * MOBILE_POPUP_MIN_WIDTH_RATIO) / MOBILE_POPUP_SCALE
}
export const MOBILE_POPUP_STRETCH_CLASS = '[&>*]:min-w-full'

// 3번 — 팝업 틀에 이 CSS 변수를 두고, 누르는 칸은 MOBILE_TOUCH_MIN_CLASS로 최소 크기를 받는다. PC 팝업에는 변수가 없어 0이 되므로 PC는 바뀌지 않는다.
export const MOBILE_POPUP_TOUCH_VARS = { '--mobile-popup-touch-min': `${MOBILE_POPUP_TOUCH_MIN_PX / MOBILE_POPUP_SCALE}px` } as CSSProperties
export const MOBILE_TOUCH_MIN_HEIGHT_CLASS = 'min-h-[var(--mobile-popup-touch-min,0px)]'
export const MOBILE_TOUCH_MIN_SIZE_CLASS = 'min-h-[var(--mobile-popup-touch-min,0px)] min-w-[var(--mobile-popup-touch-min,0px)]'

// MOBILE 팝업의 세로 위치 — 팝업의 세로 가운데를 보이는 화면 높이의 이 비율에 맞춘다. 지도 팝업(종목·업종 길게 누르기)과 툴바 팝업
// (마켓·캘린더·세션 등), 상단 박스 크기 창이 같은 중심선에 뜬다. 윗변을 맞추면(11/27 38%) 길이가 다른 팝업의 가운데·아래 끝이 제각각이라
// 들쭉날쭉해 보여서 가운데 맞춤으로 바꿨다(2026-11-27 사용자 결정 55%, 엄지 쪽으로 조금 내림). 화면 밖으로 나가면 안쪽으로 당긴다.
export const MOBILE_POPUP_CENTER_RATIO = 0.55
export const MOBILE_POPUP_MARGIN = 8

// 보이는 화면 높이와 팝업 높이(화면에 보이는 px)로 윗변 위치를 정한다.
export function mobilePopupTop(screenHeight: number, popupHeight: number): number {
  return Math.max(MOBILE_POPUP_MARGIN, Math.min(screenHeight * MOBILE_POPUP_CENTER_RATIO - popupHeight / 2, screenHeight - popupHeight - MOBILE_POPUP_MARGIN))
}

// 4번 — 툴바에서 여는 팝업(툴바 팝업·박스 크기 창)의 윗변. 가운데를 화면 높이 75%에 맞추고, 아래 끝이 툴바 줄 위 8px보다 내려가면 툴바 위에 붙인다.
// 작은 팝업은 툴바에서 조금 떠 있고, 키 큰 캘린더는 툴바 바로 위에 붙는다(2026-11-27 사용자 결정). 툴바 줄이 없는 화면이면 화면 아래를 한계로 쓴다.
// 지도 길게 누르기 팝업과 HOW TO USE는 고르는 창이 아니라 위 mobilePopupTop(가운데 55%) 그대로 둔다.
export const MOBILE_TOOLBAR_POPUP_CENTER_RATIO = 0.75
export function mobilePopupTopAboveToolbar(screenHeight: number, popupHeight: number): number {
  const toolbarTop = document.querySelector('[data-mobile-toolbar-slot]')?.getBoundingClientRect().top ?? screenHeight
  const lowestTop = toolbarTop - MOBILE_POPUP_MARGIN - popupHeight
  return Math.max(MOBILE_POPUP_MARGIN, Math.min(screenHeight * MOBILE_TOOLBAR_POPUP_CENTER_RATIO - popupHeight / 2, lowestTop))
}

// MOBILE 팝업 양식(2026-11-27 사용자 결정): 외곽선 없는 둥근 패널 + 뒤 화면을 어둡게 해서 경계를 만든다.
// 고르는 팝업(툴바 팝업·박스 크기 창)은 어두운 패널, 읽는 카드(종목·업종 길게 누르기)는 크림색을 그대로 둔다.
// 뒤 화면은 모든 MOBILE 팝업(사용 방법 창 포함)을 70%로 통일한다(40% → 55% → 60% → 70%, 2026-11-27 사용자 결정).
// 1.3배로 키워 그리는 팝업이라 모서리는 9px(화면에서 약 12px, 사용 방법 창과 같음)로 둔다.
export const MOBILE_POPUP_BACKDROP_CLASS = 'fixed inset-0 z-[71] bg-black/70'
export const MOBILE_POPUP_Z_CLASS = 'z-[72]'
export const MOBILE_PANEL_CLASS = '!rounded-[9px] !border-0 !bg-ui-panel !shadow-2xl'
