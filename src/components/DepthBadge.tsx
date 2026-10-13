const DEPTH_LABELS = ['대분류', '중분류', '소분류']

interface Props {
  depth: number
  // 그래프에 들어간 종목 중 오른 종목 수·내린 종목 수·보합 종목 수. 없으면 배지만 보인다.
  advancers?: number
  decliners?: number
  unchanged?: number
}

// 홈 그룹 등락률 박스 위 한 줄 — 지금 그래프가 보여 주는 업종 분류의 단계(대분류·중분류·소분류)를 알리는 배지를 왼쪽에 두고, 그 옆에 이 그래프에 든 종목의 상승·하락·보합 종목 수를 지도 업종 헤더(SectorBox)와 같은 ▲N ▼N ■N 형태로 적는다.
// 모양은 시장 요약 지도 위 코스피·코스닥 지수 줄(MarketIndexLine)과 같다 — 배지 여백, 어두운 배경 칸, 13px 중간 굵기, 오르면 빨강·내리면 파랑. 왼쪽 칸(코스피 자리)에만 넣고 오른쪽 칸(코스닥 자리)은 비운다.
// 눌러서 바꾸지 않는다(단계는 설정창의 "업종 분류 단계"에서 고른다). 지수 줄과 같은 높이(24px)를 지켜 두 틀의 아래 그래프가 어긋나지 않게 한다.
export default function DepthBadge({ depth, advancers, decliners, unchanged }: Props) {
  return (
    // 지수 줄(MarketIndexLine)과 같은 구조다 — 가로로 같은 폭의 두 칸을 8px 간격으로 두고, 왼쪽 칸이 "코스피" 칸(배지 + 회색 칸)이다. 오른쪽 "코스닥" 칸은 비워 둔다.
    <div className="mb-1 flex h-6 shrink-0 items-center gap-2 whitespace-nowrap text-[13px] font-medium leading-none tabular-nums">
      <span className="flex h-[22px] min-w-0 flex-1 items-center gap-1">
        <span className="shrink-0 rounded-sm bg-cyan-700 px-1 py-[3px] text-white">{DEPTH_LABELS[depth - 1] ?? DEPTH_LABELS[0]}</span>
        {advancers !== undefined && decliners !== undefined && unchanged !== undefined && (
          <span className="flex h-[22px] min-w-0 flex-1 items-center gap-1 rounded-sm bg-zinc-800 px-1">
            <span className="text-red-400">▲{advancers}</span>
            <span className="text-blue-400">▼{decliners}</span>
            <span className="text-gray-300">■{unchanged}</span>
          </span>
        )}
      </span>
      <span aria-hidden="true" className="min-w-0 flex-1" />
    </div>
  )
}
