const DEPTH_LABELS = ['대분류', '중분류', '소분류']

interface Props {
  depth: number
  // 그래프에 들어간 종목 중 오른 종목 수·내린 종목 수와 그 색(등락률 색상 바의 양 끝). 없으면 배지만 보인다.
  advancers?: number
  decliners?: number
  upColor?: string
  downColor?: string
}

// 홈 그룹 등락률 박스 위 한 줄 — 지금 그래프가 보여 주는 업종 분류의 단계(대분류·중분류·소분류)를 알리는 배지를 왼쪽에 두고, 그 옆에 이 그래프에 든 종목의 상승·하락 종목 수를 적는다.
// 눌러서 바꾸지 않는다(단계는 설정창의 "업종 분류 단계"에서 고른다). 그룹 페이지 제목 옆의 단계 배지와 같은 짙은 청록 배지이고, 코스피·코스닥 지수 배지 줄과 같은 높이(24px)를 지켜 두 틀의 아래 그래프가 어긋나지 않게 한다.
export default function DepthBadge({ depth, advancers, decliners, upColor, downColor }: Props) {
  return (
    <div className="mb-1 flex h-6 shrink-0 items-center justify-start gap-2 whitespace-nowrap px-1 text-[13px] leading-none">
      <span className="rounded bg-cyan-700 px-2 py-[3px] font-semibold text-white">{DEPTH_LABELS[depth - 1] ?? DEPTH_LABELS[0]}</span>
      {advancers !== undefined && decliners !== undefined && (
        <span className="flex items-center gap-2 font-semibold tabular-nums">
          <span style={{ color: upColor }}>상승 {advancers}</span>
          <span style={{ color: downColor }}>하락 {decliners}</span>
        </span>
      )}
    </div>
  )
}
