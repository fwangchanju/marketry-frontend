// 메인 툴바의 핀 — 지난 날짜·기간을 보는 동안 청록색으로 꽂혀 있고, 누르면 빠지며 실시간 화면으로 돌아간다.
// 실시간을 보는 중에는 핀을 그리지 않는다(날짜를 고르는 것은 날짜 칩의 달력이 맡는다).
interface Props {
  pinned: boolean
  onUnpin: () => void
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="-160 -48 704 704" className={className} fill="currentColor">
      <g transform="rotate(45 192 304)">
        <path d="M32 32C32 14.3 46.3 0 64 0L320 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-29.5 0 11.4 148.2c36.7 19.9 65.7 53.2 79.5 94.7l1 3c3.3 9.8 1.6 20.5-4.4 28.8s-15.7 13.3-26 13.3L32 352c-10.3 0-19.9-4.9-26-13.3s-7.7-19.1-4.4-28.8l1-3c13.8-41.5 42.8-74.8 79.5-94.7L93.5 64 64 64C46.3 64 32 49.7 32 32z" />
        <path d="M160 352h64v224c0 17.7-14.3 32-32 32s-32-14.3-32-32V352z" />
      </g>
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
      <PinIcon className="h-[20px] w-[20px] shrink-0" />
    </button>
  )
}
