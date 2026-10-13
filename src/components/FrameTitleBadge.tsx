// 홈 틀의 제목 — 배지 없이 흰 바 + 흰 글자다(청록 배지들 사이에서 튀지 않게). 바 오른쪽 간격은 8px이다.
export default function FrameTitleBadge({ title }: { title: string }) {
  return (
    <span className="inline-flex items-center gap-2 py-0.5 text-base font-bold leading-tight whitespace-nowrap text-white">
      <span aria-hidden="true" className="inline-block h-[1em] w-1 shrink-0 bg-white" />
      {title}
    </span>
  )
}
