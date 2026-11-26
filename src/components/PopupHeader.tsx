import type { ReactNode } from 'react'
import { POPUP_HEADER_TEXT_CLASS } from '@/components/popupHeaderStyle'

// 툴바 팝업 머리줄 공통 부품(SESSION·BASIS·BOX SIZE 등) — 영문 대문자, 13px semibold 회색, 아래 구분선. PC·MOBILE 공통(2026-11-27 사용자 결정).
// 팝업은 사방 8px 여백(p-2) 안에 이 머리줄을 두고, 머리줄·항목 글자는 왼쪽 16px(여백 8 + 머리줄 px-2)에서 시작한다.
// 머리줄을 바꿀 때는 이 부품과 popupHeaderStyle.ts만 고친다. 팝업마다 따로 적으면 조금씩 어긋난다.
export default function PopupHeader({ children }: { children: ReactNode }) {
  return <div role="presentation" className={`mb-1 border-b border-ui-border px-2 py-1.5 text-[0.8125rem] leading-none ${POPUP_HEADER_TEXT_CLASS}`}>{children}</div>
}

// 고르는 팝업(BASIS·BOX SIZE·MOBILE MARKET)의 줄 앞 점 — 세션 팝업의 색 원(8px 폭 + 8px 간격) 자리에 회색 작은 점을 찍어 이름 시작 위치를 세션 팝업과 맞춘다.
// 선택은 점이 아니라 줄 바탕(POPUP_ROW_SELECTED_CLASS)으로 보인다(2026-11-27 사용자 결정, V 체크를 바꿈).
export function PopupListDot() {
  return (
    <span aria-hidden="true" className="mr-2 flex w-2 shrink-0 justify-center">
      <span className="h-1 w-1 rounded-full bg-ui-muted" />
    </span>
  )
}
