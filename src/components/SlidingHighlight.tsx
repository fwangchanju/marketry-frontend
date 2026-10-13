// 버튼 묶음(radiogroup)에서 선택 칸의 색 채움을 옆으로 미끄러뜨리는 막대.
// 묶음은 `relative`이고 `p-[3px]`(안쪽 여백 3px)에 같은 폭의 칸 `count`개(grid-cols-N)여야 한다. 칸 버튼은 `relative z-10`에 배경 없이 글자색만 바꾼다.
// 선택 칸이 틀 가장자리에서 INSET만큼 안쪽에 떠 있어서 틀 안에 여백이 생긴다. 틀 안쪽 여백을 바꾸면 INSET도 같이 바꾼다.
// 칸 폭의 배수만큼 transform으로 옮기기 때문에 크기를 재지 않고, 다시 배치(layout)도 일으키지 않는다.
const INSET = 3

export function SlidingHighlight({ count, index, className }: { count: number; index: number; className: string }) {
  if (index < 0) return null
  return (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute z-[1] transition-transform duration-[500ms] ease-out ${className}`}
        style={{ top: INSET, bottom: INSET, left: INSET, width: `calc((100% - ${INSET * 2}px) / ${count})`, transform: `translateX(${index * 100}%)` }}
      />
      {/* 선택 칸에 맞닿은 경계는 숨기고, 나머지 선은 버튼 가상 요소 대신 묶음 안의 고정된 위치에 그린다.
          강조 칸은 500ms에 걸쳐 미끄러지는데 선은 바로 나타나므로, 선이 강조 칸 위에 그려지면 이동 중에 끊어진 선이 비쳐 보인다 —
          선을 강조 칸(z-[1]) 아래(z-0)에 둬서 강조 칸이 지나가는 동안 가려지게 한다(글자 버튼은 z-10으로 둘 위에 있다). */}
      {Array.from({ length: Math.max(0, count - 1) }, (_, offset) => {
        const boundary = offset + 1
        if (boundary === index || boundary === index + 1) return null
        return (
          <span
            key={boundary}
            aria-hidden="true"
            className="pointer-events-none absolute z-0 w-px bg-gray-500"
            style={{ top: INSET + 8, bottom: INSET + 8, left: `calc(${INSET}px + (100% - ${INSET * 2}px) * ${boundary} / ${count})` }}
          />
        )
      })}
    </>
  )
}
