// 버튼 묶음(radiogroup)에서 선택 칸의 색 채움을 옆으로 미끄러뜨리는 막대.
// 묶음은 `relative`이고 `p-[5px]`(안쪽 여백 5px)에 같은 폭의 칸 `count`개(grid-cols-N)여야 한다. 칸 버튼은 `relative z-10`에 배경 없이 글자색만 바꾼다.
// 선택 칸이 틀 가장자리에서 INSET만큼 안쪽에 떠 있어서 틀 안에 여백이 생긴다. 틀 안쪽 여백을 바꾸면 INSET도 같이 바꾼다.
// 칸 폭의 배수만큼 transform으로 옮기기 때문에 크기를 재지 않고, 다시 배치(layout)도 일으키지 않는다.
const INSET = 5

export function SlidingHighlight({ count, index, className }: { count: number; index: number; className: string }) {
  if (index < 0) return null
  return (
    <span
      aria-hidden="true"
      className={`absolute transition-transform duration-[500ms] ease-out ${className}`}
      style={{ top: INSET, bottom: INSET, left: INSET, width: `calc((100% - ${INSET * 2}px) / ${count})`, transform: `translateX(${index * 100}%)` }}
    />
  )
}
