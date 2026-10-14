// 팝업 제목 앞에 붙이는 종류 배지 — 결정창(답해야 함)과 안내창(알림만)을 한눈에 구분한다. 규칙은 docs/ui-areas.md "팝업 규칙".
export type PopupKind = '결정' | '안내' | '알림'

const BADGE_COLOR: Record<PopupKind, string> = {
  결정: 'bg-cyan-700',
  안내: 'bg-gray-500',
  알림: 'bg-amber-700',
}

export default function PopupKindBadge({ kind }: { kind: PopupKind }) {
  return <span className={`mr-2 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs leading-none font-bold text-white ${BADGE_COLOR[kind]}`}>{kind}</span>
}
