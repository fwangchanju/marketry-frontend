// 홈 틀의 제목 — 회색 16px 소제목에 오른쪽으로 가는 얇은 구분선이다. 아래 항목 글자(흰색)와 색·크기로 구분하고, 청록은 배지에만 남긴다.
export default function FrameTitleBadge({ title }: { title: string }) {
  return (
    <span className="flex w-full items-center gap-2 text-base font-semibold leading-tight tracking-[0.02em] whitespace-nowrap text-gray-400">
      {title}
      <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-zinc-700" />
    </span>
  )
}
