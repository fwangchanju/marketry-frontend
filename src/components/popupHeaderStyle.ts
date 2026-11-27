// 툴바 팝업 머리줄 공통 양식의 값 — PC와 MOBILE이 같은 부품(PopupHeader)을 쓰고, MOBILE은 팝업 배율 1.3으로 키워 그린다(2026-11-27 사용자 결정).
// 기준은 docs/ui-areas.md "팝업 머리줄 규칙". 값을 바꿀 때는 여기와 PopupHeader만 고친다.
// 머리줄 글자 모양(굵기·색).
export const POPUP_HEADER_TEXT_CLASS = 'font-semibold text-ui-muted'

// 고르는 팝업 줄의 바탕 — 고른 줄은 청록 바탕을 줄 전체(팝업 양 끝까지)에 깔고, 나머지는 마우스 올림·손가락 누름 때 흰색 10%.
export const POPUP_ROW_SELECTED_CLASS = 'bg-[var(--brand-surface)]'
export const POPUP_ROW_IDLE_CLASS = 'bg-transparent hover:bg-ui-white/10 data-[touch-active]:bg-ui-white/10'
