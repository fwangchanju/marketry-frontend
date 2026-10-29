// 버튼 묶음(radiogroup)을 칸마다 떨어진 칩으로 그리고, 선택 칸에 색 채움을 그리는 막대. 이름은 예전에 채움이 옆으로 미끄러지던 흔적이고, 지금은 애니메이션 없이 선택이 바뀌는 즉시 옮겨 그린다(2026-10-29).
// 묶음은 `relative`이고 `gap-[6px]`(gap 기본값)에 같은 폭의 칸 `count`개(grid-cols-N)여야 하며 틀 배경·안쪽 여백은 두지 않는다. 칸 버튼은 `relative z-10`에 배경 없이 글자색만 바꾼다.
// 미선택 칩의 바탕(z-0)과 선택 채움(z-[1])을 여기서 그린다. 글자 버튼(z-10)이 둘 위에 있다. 채움 색은 `className`(Tailwind) 또는 `fillColor`로 준다.
// 설정창 안은 칩 모서리가 둥글고(4px, 채움의 둥근 모서리는 `className`에 준다), 지도 윗줄(툴바)의 애프터 버튼은 `square`로 직각이다.
// 밝은 회색 큰 둥근 틀은 쓰지 않는다 — 웨일의 GPU 가속에서 둥근 큰 틀의 양 끝 안쪽에 가는 세로선이 비쳤다.
// 칸 사이 구분선은 두지 않는다 — 칩 사이 간격과 선택 칸의 색 채움으로 칸을 구분한다.
// 채움은 칸 폭의 배수만큼 `left`로 옮기므로 크기를 재지 않는다(전환 없이 바로 옮겨진다).
const CHIP_COLOR = 'var(--ui-control)'

export function SlidingHighlight({
  count,
  index,
  className,
  gap = 6,
  fillColor,
  baseColor,
  square = false,
  bottomRadius = 0,
  topInset = 0,
}: {
  count: number
  index: number
  className?: string
  gap?: number
  fillColor?: string
  baseColor?: string
  square?: boolean
  // 선택 영역을 묶음 전체가 아닌 아래쪽 라벨 줄에만 그릴 때 쓴다.
  topInset?: number
  // 직각 칩 묶음에서 맨 왼쪽 칸의 왼쪽 아래와 맨 오른쪽 칸의 오른쪽 아래만 둥글게 한다(px).
  bottomRadius?: number
}) {
  const cell = `(100% - ${gap * (count - 1)}px) / ${count}`
  const leftOf = (i: number) => `calc((${cell}) * ${i} + ${gap * i}px)`
  const cornerStyle = (i: number) => (bottomRadius > 0 ? { borderBottomLeftRadius: i === 0 ? bottomRadius : 0, borderBottomRightRadius: i === count - 1 ? bottomRadius : 0 } : {})
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`pointer-events-none absolute z-0 ${square ? '' : 'rounded-[4px]'}`}
          style={{ top: topInset, bottom: 0, left: leftOf(i), width: `calc(${cell})`, backgroundColor: baseColor ?? CHIP_COLOR, ...cornerStyle(i) }}
        />
      ))}
      {index >= 0 && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute z-[1] ${className ?? ''}`}
          style={{ top: topInset, bottom: 0, left: leftOf(index), width: `calc(${cell})`, backgroundColor: fillColor, ...cornerStyle(index) }}
        />
      )}
    </>
  )
}
