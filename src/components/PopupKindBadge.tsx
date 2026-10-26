// 팝업 제목 앞에 붙이는 종류 배지 — 정보(닫기)·확인(일반 선택)·주의(위험 확인)를 구분한다. 규칙은 docs/ui-areas.md "팝업 규칙".
export type PopupKind = '정보' | '확인' | '주의'

const BADGE_COLOR: Record<PopupKind, string> = {
  정보: 'bg-ui-control',
  확인: 'bg-brand-surface',
  주의: 'bg-[#BC2F2F]',
}

export default function PopupKindBadge({ kind }: { kind: PopupKind }) {
  return <span className={`mr-2 inline-flex shrink-0 items-center rounded px-1.5 py-[3px] text-xs leading-none font-semibold text-ui-white ${BADGE_COLOR[kind]}`}>{kind}</span>
}
