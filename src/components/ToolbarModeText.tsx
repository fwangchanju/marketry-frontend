// 툴바 맨 왼쪽에 지금 보는 시장·화면 이름만 글자로 보여 준다(Map·Group은 KOSPI 등, Custom은 STOCK 등).
// 고르는 일은 상단 영역 메뉴(Map·Group·Custom)에 커서를 올려서 한다. 뒤따르는 요소가 밀리지 않게 예전 드롭다운과 같은 폭·안쪽 여백을 쓴다.
export default function ToolbarModeText({ label }: { label: string }) {
  return (
    <div className="font-roboto-latin tabular-nums flex h-6 w-[7.5rem] shrink-0 items-center truncate px-2 text-sm font-bold text-white">
      {label}
    </div>
  )
}
