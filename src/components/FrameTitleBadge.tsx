// 홈 틀의 제목 — 회색 15px 굵은 소제목에(지도 페이지 섹터 헤더와 같은 글자 크기, 왼쪽 들여쓰기 없음) 오른쪽으로 가는 얇은 구분선이다. 아래 항목 글자(흰색)와 색·크기로 구분하고, 청록은 배지에만 남긴다.
export default function FrameTitleBadge({ title }: { title: string }) {
  return (
    <span className="flex w-full items-center gap-2 text-[15px] font-bold leading-none whitespace-nowrap text-gray-400">
      {title}
      <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-zinc-700" />
    </span>
  )
}
