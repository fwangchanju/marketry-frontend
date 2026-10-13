import FrameTitleBadge from '@/components/FrameTitleBadge'

const DEPTH_LABELS = ['대분류', '중분류', '소분류']

interface Props {
  title: string
  // 그래프에 들어간 종목 중 오른 종목 수·내린 종목 수·보합 종목 수. 없으면 배지만 보인다.
  advancers?: number
  decliners?: number
  unchanged?: number
}

// 홈 그룹 등락률 박스 위 한 줄 — 지금 그래프가 보여 주는 업종 분류의 단계(대분류·중분류·소분류)를 알리는 배지를 왼쪽에 두고, 그 옆에 이 그래프에 든 종목의 상승·하락·보합 종목 수를 지도 업종 헤더(SectorBox)와 같은 ▲N ▼N ■N 형태로 적는다.
// 모양은 시장 요약 지도 위 코스피·코스닥 지수 줄(MarketIndexLine)과 같다 — 배지 여백, 어두운 배경 칸, 13px 중간 굵기, 오르면 빨강·내리면 파랑. 
// 눌러서 바꾸지 않는다(단계는 설정창의 "업종 분류 단계"에서 고른다). 지수 줄과 같은 높이(24px)를 지켜 두 틀의 아래 그래프가 어긋나지 않게 한다.
// 업종 분류 단계 배지(대분류·중분류·소분류) — 홈에서는 시장 요약 틀의 제목 아래에 둔다.
export function DepthLevelBadge({ depth }: { depth: number }) {
  return <span className="shrink-0 rounded-sm bg-cyan-900 px-1 py-[3px] text-[13px] font-medium leading-none text-white">{DEPTH_LABELS[depth - 1] ?? DEPTH_LABELS[0]}</span>
}

export default function DepthBadge({ title, advancers, decliners, unchanged }: Props) {
  return (
    // 시장 요약의 지수 줄(MarketIndexLine)과 같은 격자다: 같은 폭의 두 칸(간격 8px, 이전 한 줄 배치의 칸 그대로)이고 칸의 크기·모양은 그대로, 위치만 바뀐다 —
    // 첫 줄(28px)은 왼쪽에 제목이고, 둘째 줄(24px)은 왼쪽이 비고 오른쪽 칸(등락수의 원래 자리)에 [등락수 배지][▲N ▼N ■N 회색 칸]이 온다. 단계 배지(대분류)는 시장 요약 틀의 제목 아래로 옮겼다(DepthLevelBadge).
    // 오른쪽 칸은 안의 글자 폭보다 줄지 않는다(좁은 창에서 "▲N ▼N ■N"이 잘리지 않게).
    <div className="mb-1 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(max-content,1fr)] gap-x-2 whitespace-nowrap text-[13px] font-medium leading-none tabular-nums">
      <span className="flex h-7 items-center">
        <FrameTitleBadge title={title} />
      </span>
      <span className="h-7" />
      <span className="h-6" />
      {advancers !== undefined && decliners !== undefined && unchanged !== undefined && (
        <span className="flex h-6 items-center">
          <span className="flex h-[22px] min-w-0 flex-1 items-center gap-1">
            <span className="shrink-0 rounded-sm bg-cyan-700 px-1 py-[3px] text-white">등락수</span>
            <span className="flex h-[22px] min-w-0 flex-1 items-center gap-1 rounded-sm bg-zinc-800 px-1">
              <span className="text-red-400">▲{advancers}</span>
              <span className="text-blue-400">▼{decliners}</span>
              <span className="text-gray-300">■{unchanged}</span>
            </span>
          </span>
        </span>
      )}
    </div>
  )
}
