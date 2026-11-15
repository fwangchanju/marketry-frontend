// 툴바 맨 왼쪽에 지금 보는 화면을 페이지 제목처럼 보여 준다 — 청록색 박스 안에 큰 제목(NIKKEI·K-STOCK·DASHBOARD 등)을 둔다.
// 박스 너비는 105px로 고정해서 어느 페이지든 같고, 글자는 박스 가운데에 둔다. 시장 이동은 왼쪽 메뉴로 한다.
export interface ToolbarModeMenuItem {
  label: string
  to: string
  active: boolean
  indent?: boolean
  special?: boolean
}

export default function ToolbarModeText({ page, label }: { page: string; label: string; showChevron?: boolean; menu?: ToolbarModeMenuItem[] }) {
  return (
    <div className="font-roboto-latin relative shrink-0">
      <span className="absolute -top-[5px] left-1.5 z-10 bg-ui-background px-1 text-[9px] leading-none font-bold tracking-[0.12em] text-[var(--brand)]">{page}</span>
      <div className="toolbar-badge toolbar-mode-badge flex h-6 w-[105px] items-center justify-start border border-[var(--brand)]/50 bg-[var(--brand-surface)] px-0 text-[15px] leading-none font-bold whitespace-nowrap tabular-nums text-ui-white">
        <span className="min-w-0 flex-1 justify-center text-center tracking-[0.04em]">{label}</span>
      </div>
    </div>
  )
}
