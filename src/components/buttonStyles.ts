// 공용 버튼 모양 — 채움 + 둥근 사각형. 기본 버튼은 회색 채움이고, 강조 버튼(클립보드처럼 지금 가장 먼저 눌러야 하는 것)만 청록 채움(설정창 "적용"·확인 팝업 버튼과 같은 색)이다.
// 아이콘 버튼(스크린샷·전체 화면·설정 등)과 드롭다운·선택 버튼 묶음은 따로 쓴다.
const layoutClass = (padding: string) => `flex items-center gap-2 rounded-lg border-0 ${padding} text-sm font-semibold leading-5 transition-colors disabled:opacity-50`
const BASE_COLOR_CLASS = 'bg-ui-control text-ui-white hover:bg-ui-control-hover'
const ACCENT_COLOR_CLASS = 'bg-brand-surface text-ui-white hover:bg-brand-surface-hover'

// 크기는 36px 한 가지다 — 공유 창 같은 창 안 버튼. 다른 크기가 필요하면 크기별 여백을 받는 layoutClass로 새로 만든다(클래스를 더해도 나중 것이 이기지 않아서 따로 만든다).
export const BUTTON_BASE_CLASS = `${layoutClass('px-3.5 py-2')} ${BASE_COLOR_CLASS}`
export const BUTTON_ACCENT_CLASS = `${layoutClass('px-3.5 py-2')} ${ACCENT_COLOR_CLASS}`
