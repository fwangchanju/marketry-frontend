// 홈 틀의 제목 — 지도 설정의 강조 색상으로 소제목을 가운데에 두고 양쪽으로 같은 길이의 구분선을 긋는다.
export default function FrameTitleBadge({ title, color }: { title: string; color: string }) {
  return (
    <span style={{ color }} className="flex w-full items-center gap-2 text-[15px] font-bold leading-none whitespace-nowrap">
      <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-ui-panel" />
      {title}
      <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-ui-panel" />
    </span>
  )
}
