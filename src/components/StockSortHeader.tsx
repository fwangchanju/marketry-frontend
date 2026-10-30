import type { ReactNode } from 'react'

export type HeaderSortState = 'asc' | 'desc' | null

function Arrow({ direction, active }: { direction: 'asc' | 'desc'; active: boolean }) {
  return (
    <svg
      viewBox="0 0 12 6"
      className={`h-1.5 w-3 group-hover/sort:text-[var(--brand)] ${active ? 'text-[var(--brand)]' : 'text-ui-muted'}`}
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

// 종목 표 머리글은 항목명 위아래에 정렬 화살표를 둔다.
// 정렬 버튼은 글자·화살표 묶음이다. 필터는 이 버튼과 별도로 누른다.
// filter는 글자 오른쪽(화살표 묶음 옆)에 붙는 필터 아이콘이다 — 글자·화살표 묶음은 아이콘이 있어도 그 줄의 세로 가운데에 그대로 있다.
export default function StockSortHeader({ label, state, filter, onSort }: { label: string; state: HeaderSortState; filter?: ReactNode; onSort?: () => void }) {
  const sortContent = <><Arrow direction="asc" active={state === 'asc'} /><span className="my-2.5 leading-4">{label}</span><Arrow direction="desc" active={state === 'desc'} /></>
  return (
    <span className="mx-auto flex w-fit items-center gap-1">
      {onSort ? <button type="button" onClick={onSort} className="group/sort flex cursor-pointer flex-col items-center border-0 bg-transparent p-0 leading-none text-inherit hover:text-[var(--brand)]">{sortContent}</button> : <span className="flex flex-col items-center leading-none">{sortContent}</span>}
      {filter}
    </span>
  )
}
