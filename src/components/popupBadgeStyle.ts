import { MOBILE_TOUCH_MIN_HEIGHT_CLASS } from '@/utils/mobilePopupScale'

// 툴바 팝업 안 배지 공통 양식 — 캘린더(하루/기간·거래일·YTD·선택 해제·적용)와 HOW TO USE(닫기)가 같이 쓴다(2026-11-27 사용자 결정).
// 기준은 docs/ui-areas.md "팝업 배지 규칙". 배지 크기·글자는 여기서만 정하고, 색(청록·회색)만 쓰는 쪽에서 붙인다.
// 글자: PC·MOBILE 모두 0.8125rem(PC 13px). 예전에 일부는 13px 고정이라 MOBILE에서만 글자가 커 보였다.
// PC 크기가 원본이다: switch = 하루/기간, tag = 거래일·YTD, action = 선택 해제·적용.
// MOBILE은 PC 크기를 그대로 따르고, MOBILE 팝업 규칙 3번(누르는 칸은 보이는 크기 28px 이상)만 더한다. 최소 높이는 팝업 틀의 CSS 변수에서 오므로 PC에는 영향이 없다.
export type PopupBadgeSize = 'switch' | 'tag' | 'action'

const POPUP_BADGE_BASE_CLASS = 'inline-flex shrink-0 items-center justify-center rounded border-0 text-center text-[0.8125rem] font-normal leading-none transition-colors'
const PC_SIZE_CLASS: Record<PopupBadgeSize, string> = {
  switch: 'h-5 px-2',
  tag: 'h-5 px-1.5',
  action: 'px-2.5 py-1',
}

export function popupBadgeClass(size: PopupBadgeSize): string {
  return `${POPUP_BADGE_BASE_CLASS} ${PC_SIZE_CLASS[size]} ${MOBILE_TOUCH_MIN_HEIGHT_CLASS}`
}
