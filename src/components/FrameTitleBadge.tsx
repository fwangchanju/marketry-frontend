// 홈 틀의 제목 — 검정 바를 품은 직사각형 흰색 배지(바 왼쪽·글자 오른쪽 여백을 같은 8px로 둬서 바가 배지 가장자리에 붙지 않는다).
export default function FrameTitleBadge({ title }: { title: string }) {
  return (
    <span className="inline-flex items-center gap-2 bg-white px-2 py-0.5 text-base font-bold leading-tight whitespace-nowrap text-black">
      <span aria-hidden="true" className="inline-block h-[1em] w-1 shrink-0 bg-black" />
      {title}
    </span>
  )
}
