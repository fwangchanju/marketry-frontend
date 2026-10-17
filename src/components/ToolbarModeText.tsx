// 툴바 맨 왼쪽에 지금 보는 화면을 페이지 제목처럼 보여 준다 — 서브 청록색 박스 안에 큰 제목(KOSPI·ALL STOCK·STOCK 등)을 두고
// 흰 제목 글자를 가운데에 두고, 작은 페이지 이름(MAP·GROUP·CUSTOM)은 박스 윗변에 걸쳐 놓는다(툴바 바탕색 조각으로 윗변을 가린다).
// 박스 너비는 가장 긴 ALL STOCK이 들어가는 7.5rem으로 고정해서 어느 페이지든 같고, 제목은 가운데에 둔다. 고르는 일은 상단 영역 메뉴(Map·Group·Custom)에 커서를 올려서 한다.
export default function ToolbarModeText({ page, label }: { page: string; label: string }) {
  return (
    <div className="font-roboto-latin relative mr-1 shrink-0">
      <span className="absolute -top-[5px] left-1.5 z-10 bg-ui-background px-1 text-[9px] leading-none font-bold tracking-[0.12em] text-[var(--brand)]">{page}</span>
      <div className="flex h-6 w-[7.5rem] items-center justify-center border border-[var(--brand)]/50 bg-[var(--brand-surface)] px-1 text-[15px] leading-none font-bold whitespace-nowrap tabular-nums text-ui-white">
        <span className="px-[3px]">{label}</span>
      </div>
    </div>
  )
}
