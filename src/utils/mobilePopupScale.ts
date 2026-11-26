// MOBILE 팝업 전용 배율. 툴바는 화면 폭에 맞춰 작게 그리지만, 그 아래에 열리는 팝업은
// 읽기 쉽도록 툴바 축소(0.863)를 빼고 원본 CSS 크기의 1.3배로 그린다.
// 툴바 줄 팝업(`ToolbarPopup`)과 지도 팝업(`Popup`)이 같은 값을 쓴다.
// 바꿀 때는 이 값만 조절하면 두 팝업의 배율과 위치 보정·클램프가 함께 따라온다.
// 지도 팝업은 화면을 확대·축소하면 visualViewport.scale로 나눠 보이는 크기를 이 값으로 유지한다.
export const MOBILE_POPUP_SCALE = 1.3

// MOBILE 팝업의 윗변 위치 — 보이는 화면 높이의 이 비율에서 시작한다. 지도 팝업(종목·업종 길게 누르기)과 툴바 팝업(마켓·캘린더·세션 등),
// 상단 박스 크기 창이 같은 자리에 뜬다. 엄지가 닿기 쉽게 27%에서 38%로 내렸다(2026-11-27 사용자 결정). 줄이 많으면 아래로만 길어지고,
// 화면 아래를 넘으면 그만큼 위로 올린다.
export const MOBILE_POPUP_TOP_RATIO = 0.38
export const MOBILE_POPUP_MARGIN = 8

// 보이는 화면 높이와 팝업 높이(화면에 보이는 px)로 윗변 위치를 정한다.
export function mobilePopupTop(screenHeight: number, popupHeight: number): number {
  return Math.max(MOBILE_POPUP_MARGIN, Math.min(screenHeight * MOBILE_POPUP_TOP_RATIO, screenHeight - popupHeight - MOBILE_POPUP_MARGIN))
}
