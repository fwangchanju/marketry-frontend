// MOBILE 팝업 전용 배율. 툴바는 화면 폭에 맞춰 작게 그리지만, 그 아래에 열리는 팝업은
// 읽기 쉽도록 툴바 축소(0.863)를 빼고 원본 CSS 크기의 1.3배로 그린다.
// 툴바 줄 팝업(`ToolbarPopup`)과 지도 팝업(`Popup`)이 같은 값을 쓴다.
// 바꿀 때는 이 값만 조절하면 두 팝업의 배율과 위치 보정·클램프가 함께 따라온다.
// 지도 팝업은 화면을 확대·축소하면 visualViewport.scale로 나눠 보이는 크기를 이 값으로 유지한다.
export const MOBILE_POPUP_SCALE = 1.3

// MOBILE 팝업의 세로 위치 — 팝업의 세로 가운데를 보이는 화면 높이의 이 비율에 맞춘다. 지도 팝업(종목·업종 길게 누르기)과 툴바 팝업
// (마켓·캘린더·세션 등), 상단 박스 크기 창이 같은 중심선에 뜬다. 윗변을 맞추면(11/27 38%) 길이가 다른 팝업의 가운데·아래 끝이 제각각이라
// 들쭉날쭉해 보여서 가운데 맞춤으로 바꿨다(2026-11-27 사용자 결정 55%, 엄지 쪽으로 조금 내림). 화면 밖으로 나가면 안쪽으로 당긴다.
export const MOBILE_POPUP_CENTER_RATIO = 0.55
export const MOBILE_POPUP_MARGIN = 8

// 보이는 화면 높이와 팝업 높이(화면에 보이는 px)로 윗변 위치를 정한다.
export function mobilePopupTop(screenHeight: number, popupHeight: number): number {
  return Math.max(MOBILE_POPUP_MARGIN, Math.min(screenHeight * MOBILE_POPUP_CENTER_RATIO - popupHeight / 2, screenHeight - popupHeight - MOBILE_POPUP_MARGIN))
}

// MOBILE 팝업 양식(2026-11-27 사용자 결정): 외곽선 없는 둥근 패널 + 뒤 화면을 어둡게 해서 경계를 만든다.
// 고르는 팝업(툴바 팝업·박스 크기 창)은 어두운 패널, 읽는 카드(종목·업종 길게 누르기)는 크림색을 그대로 둔다.
// 뒤 화면은 사용 방법 창과 같은 60%로 모든 MOBILE 팝업을 통일한다(40% → 55% → 60%, 2026-11-27 사용자 결정).
// 1.3배로 키워 그리는 팝업이라 모서리는 9px(화면에서 약 12px, 사용 방법 창과 같음)로 둔다.
export const MOBILE_POPUP_BACKDROP_CLASS = 'fixed inset-0 z-[71] bg-black/60'
export const MOBILE_POPUP_Z_CLASS = 'z-[72]'
export const MOBILE_PANEL_CLASS = '!rounded-[9px] !border-0 !bg-ui-panel !shadow-2xl'
