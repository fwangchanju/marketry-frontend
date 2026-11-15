// 메인 툴바의 핀 — 지난 날짜·기간을 보는 동안 청록색으로 꽂혀 있고, 누르면 빠지며 실시간 화면으로 돌아간다.
// 실시간을 보는 중에는 핀을 그리지 않는다(날짜를 고르는 것은 날짜 칩의 달력이 맡는다).
interface Props {
  pinned: boolean
  onUnpin: () => void
}

function PinIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
      <path d="M9.6 1.8 14.2 6.4 11.9 7.2 9.6 9.5 9.9 12.2 8.6 13.5 6 10.9 2.5 14.4" />
      <path d="M6.4 4.6 11.4 9.6" />
    </svg>
  )
}

export default function ToolbarPinButton({ pinned, onUnpin }: Props) {
  if (!pinned) return null
  return (
    <button
      type="button"
      aria-label="핀 빼기 — 실시간으로 돌아가기"
      data-hint="실시간 화면으로 돌아갑니다"
      onClick={onUnpin}
      className="toolbar-badge-control flex h-6 items-center border-0 bg-transparent px-1.5 text-[var(--brand)] transition-colors hover:bg-ui-control"
    >
      <PinIcon filled className="h-[15px] w-[15px] shrink-0" />
    </button>
  )
}
