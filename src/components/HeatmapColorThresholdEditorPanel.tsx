import { useRef } from 'react'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { BAR_MAX_PERCENT, BAR_MIN_PERCENT, BAR_TICKS, percentToPosition, positionToPercent } from '@/utils/thresholdBar'

// 색은 고르는 것이 아니라 정해져 있다 — 하락은 파랑, 보합(0%)은 회색, 상승은 빨강이고 구간 순서대로 명도가 올라간다(heatmapColorScale.fixedRankColor).
// 0%(보합)는 고칠 값이 없어 선택 버튼과 막대의 0% 표식을 두지 않는다. 상승/하락 선택 버튼도 두지 않는다 — 하락 값은 상승 값의 거울이라 어느 쪽을 골라도 고치는 값이 같다(2026-11-19 사용자 결정).
// 막대 하나를 위아래 절반으로 나눠 위는 상승색, 아래는 하락색 그라데이션을 보여 준다.

interface ThresholdBarProps {
  // 상승·하락 구간의 경계와 색(작은 값부터, 하락은 절댓값) — 막대의 손잡이 하나가 구간 하나다. 하락 값은 상승 값의 거울이다.
  positive: { percent: number; color: string }[]
  negative: { percent: number; color: string }[]
  // 편집 중인 손잡이(구간)의 순서.
  selectedRank: number | null
  zeroColor: string
  onChangeRankPercent: (rank: number, percent: number) => void
  onSelectRank: (rank: number, side: 'up' | 'down') => void
}

// 등락률 막대 — 0~30%를 제곱근 눈금으로 그리고 손잡이를 끌어 구간 경계를 정한다(손잡이는 이웃을 넘지 못하고 정수로 움직인다).
// 하락 구간은 같은 값의 거울로 자동 적용된다.
// 선택하지 않은 손잡이를 누르면 그 구간을 고르고, 선택한 손잡이는 끌거나 ←→ 키로 1씩 옮긴다.
function ThresholdBar({ positive, negative, selectedRank, zeroColor, onChangeRankPercent, onSelectRank }: ThresholdBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  // 끌고 있는 손잡이의 순서 — 선택하지 않은 손잡이를 눌러도 같은 클릭에서 바로 끌 수 있도록, 고른 칸이 아니라 누른 손잡이를 따라 움직인다.
  const draggingRankRef = useRef<number | null>(null)
  // 막대 색은 지도 박스 색과 같은 계산(resolveHeatmapColor)을 0~30%에서 촘촘히 찍어 그린다. 위 절반은 상승색, 아래 절반은 하락색이다.
  const gradientOf = (colored: { percent: number; color: string }[], signed: 1 | -1) => {
    const barConfig = {
      thresholds: [
        { thresholdPercent: 0, color: zeroColor, colorLabel: null },
        ...colored.map((item, rank) => ({ thresholdPercent: signed * (positive[rank]?.percent ?? item.percent), color: item.color, colorLabel: null })),
      ],
    }
    const stops = Array.from({ length: 61 }, (_, step) => step / 2).map(percent => `${resolveHeatmapColor(signed * percent, barConfig)} ${(percentToPosition(percent) * 100).toFixed(2)}%`)
    return `linear-gradient(90deg, ${stops.join(', ')})`
  }
  const upGradient = gradientOf(positive, 1)
  const downGradient = gradientOf(negative, -1)
  // 선택값 배지는 ±로 보여 준다 — 상승 값과 그 거울인 하락 값이 같이 바뀐다.
  const sign = '\u00b1'

  const percentAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    return rect && rect.width > 0 ? positionToPercent((clientX - rect.left) / rect.width) : null
  }
  const moveTo = (clientX: number, rank: number | null) => {
    if (rank === null) return
    const percent = percentAt(clientX)
    if (percent !== null) onChangeRankPercent(rank, percent)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const handle = target.closest<HTMLElement>('[data-rank]')
    if (handle) {
      // 손잡이를 누르면 그 구간을 고르고, 같은 클릭에서 바로 끌 수 있다. 누른 자리에서는 움직이지 않고 끌기 시작할 때부터 따라간다.
      const rank = Number(handle.dataset.rank)
      if (rank !== selectedRank) onSelectRank(rank, 'up')
      draggingRankRef.current = rank
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    // 막대의 빈 곳을 누르면 고른 손잡이가 그 자리로 오고 이어서 끌 수 있다.
    draggingRankRef.current = selectedRank
    event.currentTarget.setPointerCapture(event.pointerId)
    moveTo(event.clientX, selectedRank)
  }
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRankRef.current !== null) moveTo(event.clientX, draggingRankRef.current)
  }
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRankRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, rank: number) => {
    const current = positive[rank]?.percent
    if (current === undefined) return
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[event.key]
    const target = event.key === 'Home' ? BAR_MIN_PERCENT : event.key === 'End' ? BAR_MAX_PERCENT : step === undefined ? null : current + step
    if (target === null) return
    event.preventDefault()
    onChangeRankPercent(rank, target)
  }
  const edgeAligned = (position: number) => Math.min(Math.max(position, 0.06), 0.94) * 100
  // 선택값 배지는 가까운 눈금과 겹치지 않도록 11px에 좁은 좌우 여백을 유지하고 같은 줄에 포개서 보여 준다.
  const badgeClass = 'absolute top-[36px] z-10 -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-brand px-0.5 text-[11px] font-medium leading-4 tabular-nums text-ui-background'

  return (
    <>
      {/* 막대 폭은 다른 탭의 슬라이더와 같은 .settings-slider-control 폭이다(양 끝 손잡이·눈금 글자는 그 바깥으로 조금 나온다). */}
      <div
        className="relative h-[52px] touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div ref={trackRef} className="settings-slider-control relative h-full">
          <div className="absolute inset-x-0 top-[12px] flex h-4 flex-col border border-ui-white/20">
            <div className="min-h-0 flex-1" style={{ background: upGradient }} />
            <div className="min-h-0 flex-1" style={{ background: downGradient }} />
          </div>
          <div>
            {positive.map((item, rank) => {
              const selected = rank === selectedRank
              const left = `${percentToPosition(item.percent) * 100}%`
              return (
                <div key={rank}>
                  {selected && (
                    <span className={badgeClass} style={{ left: `${edgeAligned(percentToPosition(item.percent))}%` }}>
                      {sign}{item.percent}%
                    </span>
                  )}
                  <div
                    data-rank={rank}
                    role="slider"
                    tabIndex={selected ? 0 : -1}
                    aria-label={`${sign}${item.percent}% 구간 경계`}
                    aria-valuemin={BAR_MIN_PERCENT}
                    aria-valuemax={BAR_MAX_PERCENT}
                    aria-valuenow={item.percent}
                    onKeyDown={event => handleKeyDown(event, rank)}
                    className={`absolute top-[8px] box-border h-6 w-2 -translate-x-1/2 cursor-pointer rounded-[2px] border bg-ui-panel ${selected ? 'border border-brand ring-[3px] ring-brand/35' : 'border border-ui-text hover:border-ui-white'}`}
                    style={{ left }}
                  />
                </div>
              )
            })}
          </div>
          {BAR_TICKS.map(tick => {
            // 다른 슬라이더처럼 트랙 아래 4px에 눈금을 둔다. 좁은 값 간격 때문에 여기만 12px로 두고 색·굵기 규칙은 맞춘다.
            const highlighted = tick === positive[selectedRank ?? -1]?.percent
            return (
              <span
                key={tick}
                className={`pointer-events-none absolute top-[36px] -translate-x-1/2 whitespace-nowrap text-[12px]/4 transition-colors duration-300 ${highlighted ? 'font-medium text-ui-white' : 'text-ui-muted'}`}
                style={{ left: `${percentToPosition(tick) * 100}%` }}
              >
                {tick}%
              </span>
            )
          })}
        </div>
      </div>
    </>
  )
}

export interface ColorThresholdEditorProps {
  // 등락률 막대 — 상승 구간의 경계(작은 값부터)와 고른 칸의 순서.
  bar: {
    positive: { percent: number; color: string }[]
    negative: { percent: number; color: string }[]
    selectedRank: number | null
    zeroColor: string
  }
  onChangeRankPercent: (rank: number, percent: number) => void
  onSelectRank: (rank: number, side: 'up' | 'down') => void
}

// 범례 아래에서 편집하는 등락률 구간 패널. 막대의 손잡이로 구간 경계를 정한다(색은 정해져 있어 고르지 않는다).
// 막대 값은 지도에 즉시 반영되고 상단 저장·되돌리기를 따른다.
export default function HeatmapColorThresholdEditorPanel({
  bar,
  onChangeRankPercent,
  onSelectRank,
}: ColorThresholdEditorProps) {
  return (
    <div className="flex flex-col gap-4 text-sm text-ui-white">
      <div>
        <div>
          <ThresholdBar
            positive={bar.positive}
            negative={bar.negative}
            selectedRank={bar.selectedRank}
            zeroColor={bar.zeroColor}
            onChangeRankPercent={onChangeRankPercent}
            onSelectRank={onSelectRank}
          />
        </div>
      </div>
    </div>
  )
}
