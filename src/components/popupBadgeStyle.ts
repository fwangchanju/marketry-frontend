// 툴바 팝업 안 배지 공통 양식 — 캘린더(하루/기간·거래일·YTD·선택 해제·적용)와 HOW TO USE(닫기)가 같이 쓴다(2026-11-27 사용자 결정).
// 기준은 docs/ui-areas.md "팝업 배지 규칙". 배지 크기·글자는 여기서만 정하고, 색(청록·회색)만 쓰는 쪽에서 붙인다.
// 글자: PC·MOBILE 모두 0.8125rem(PC 13px). 예전에 일부는 13px 고정이라 MOBILE에서만 글자가 커 보였다.
// PC 크기가 원본이다: switch = 하루/기간, tag = 거래일·YTD, action = 선택 해제·적용.
// MOBILE은 PC 크기를 그대로 따르고(rem·팝업 배율 1.3으로 알아서 줄고 커진다), 누르기 최소 높이만 더한다(2026-11-27 사용자 결정: PC를 고치면 MOBILE이 따라오게).
// 최소 높이 26px는 툴바 팝업 배율 1.3으로 보이는 높이 약 34px — 글자가 배지 높이의 약 40%로 툴바 줄 배지와 같은 비율이다. 글자는 그대로 두고 배지만 키운다.
export type PopupBadgeSize = 'switch' | 'tag' | 'action'

const POPUP_BADGE_BASE_CLASS = 'inline-flex shrink-0 items-center justify-center rounded border-0 text-center text-[0.8125rem] font-normal leading-none transition-colors'
const PC_SIZE_CLASS: Record<PopupBadgeSize, string> = {
  switch: 'h-5 px-2',
  tag: 'h-5 px-1.5',
  action: 'px-2.5 py-1',
}
const MOBILE_MIN_HEIGHT_CLASS = 'min-h-[26px]'

export function popupBadgeClass(size: PopupBadgeSize, isMobile: boolean): string {
  return `${POPUP_BADGE_BASE_CLASS} ${PC_SIZE_CLASS[size]}${isMobile ? ` ${MOBILE_MIN_HEIGHT_CLASS}` : ''}`
}
