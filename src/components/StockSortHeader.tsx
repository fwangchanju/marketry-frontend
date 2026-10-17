import type { ReactNode } from 'react'

export type HeaderSortState = 'asc' | 'desc' | null

function Arrow({ direction, active }: { direction: 'asc' | 'desc'; active: boolean }) {
  return (
    <svg
      viewBox="0 0 12 6"
      className={`h-1.5 w-3 ${active ? 'text-[var(--brand)]' : 'text-ui-muted'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === 'asc' ? 'M2 5l4-3.6L10 5' : 'M2 1l4 3.6L10 1'} />
    </svg>
  )
}

// 종목 표 머리글 — 글자 위에 오름차순(▲), 아래에 내림차순(▼) 화살표를 둔다. 지금 정렬된 방향의 화살표만 청록색이다.
// 화살표는 표시일 뿐이고, 정렬은 머리글 칸(th) 어디를 눌러도 같게 바뀐다(오름차순 → 내림차순 → 원래대로).
// filter는 글자 오른쪽(화살표 묶음 옆)에 붙는 필터 아이콘이다 — 글자·화살표 묶음은 아이콘이 있어도 그 줄의 세로 가운데에 그대로 있다.
export default function StockSortHeader({ label, state, filter }: { label: string; state: HeaderSortState; filter?: ReactNode }) {
  return (
    <span className="mx-auto flex w-fit items-center gap-1">
      <span className="flex flex-col items-center leading-none">
        <Arrow direction="asc" active={state === 'asc'} />
        <span className="my-2.5 leading-4">{label}</span>
        <Arrow direction="desc" active={state === 'desc'} />
      </span>
      {filter}
    </span>
  )
}
