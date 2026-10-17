import { useRef } from 'react'
import { resolveTreemapColor } from '@/utils/treemapColorScale'
import { BAR_MAX_PERCENT, BAR_MIN_PERCENT, BAR_TICKS, percentToPosition, positionToPercent } from '@/utils/thresholdBar'

// 색은 고르는 것이 아니라 정해져 있다 — 하락은 파랑, 보합(0%)은 회색, 상승은 빨강이고 구간 순서대로 명도가 올라간다(treemapColorScale.fixedRankColor).
const CHIP_LABEL = { down: '하락', zero: '보합', up: '상승' } as const

type BarSide = 'up' | 'down' | 'zero'

interface ThresholdBarProps {
  // 상승·하락 구간의 경계와 색(작은 값부터, 하락은 절댓값) — 막대의 손잡이 하나가 구간 하나다. 하락 값은 상승 값의 거울이다.
  positive: { percent: number; color: string }[]
  negative: { percent: number; color: string }[]
  // 편집 중인 칸이 상승/하락/0% 중 어디인지와 몇 번째 구간인지(0% 칸이면 null).
  side: BarSide
  selectedRank: number | null
  zeroColor: string
  onChangeRankPercent: (rank: number, percent: number) => void
  onSelectRank: (rank: number, side: 'up' | 'down') => void
  onSelectZero: () => void
}

// 등락률 막대 — 0~30%를 제곱근 눈금으로 그리고 손잡이를 끌어 구간 경계를 정한다(손잡이는 이웃을 넘지 못하고 정수로 움직인다).
// 왼쪽 끝의 0% 표식은 움직이지 않고 누르면 0% 칸의 색을 고른다. 하락 구간은 같은 값의 거울로 자동 적용된다.
// 선택하지 않은 손잡이를 누르면 그 구간을 고르고, 선택한 손잡이는 끌거나 ←→ 키로 1씩 옮긴다.
function ThresholdBar({ positive, negative, side, selectedRank, zeroColor, onChangeRankPercent, onSelectRank, onSelectZero }: ThresholdBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  // 끌고 있는 손잡이의 순서 — 선택하지 않은 손잡이를 눌러도 같은 클릭에서 바로 끌 수 있도록, 고른 칸이 아니라 누른 손잡이를 따라 움직인다.
  const draggingRankRef = useRef<number | null>(null)
  const zeroSelected = side === 'zero'
  // 막대 색은 고른 쪽(상승/하락)의 구간 색을 이어서 보여 준다.
  const colored = side === 'down' ? negative : positive
  // 막대 색은 지도 박스 색과 같은 계산(resolveTreemapColor)을 0~30%에서 촘촘히 찍어 그린다.
  const signed = side === 'down' ? -1 : 1
  const barConfig = {
    thresholds: [
      { thresholdPercent: 0, color: zeroColor, colorLabel: null },
      ...colored.map((item, rank) => ({ thresholdPercent: signed * (positive[rank]?.percent ?? item.percent), color: item.color, colorLabel: null })),
    ],
  }
  const gradientStops = Array.from({ length: 61 }, (_, step) => step / 2).map(percent => `${resolveTreemapColor(signed * percent, barConfig)} ${(percentToPosition(percent) * 100).toFixed(2)}%`)
  const gradient = `linear-gradient(90deg, ${gradientStops.join(', ')})`
  // 하락 부호는 하이픈(-)이 아니라 수학 빼기 기호(−)로 쓴다 — 하이픈은 +보다 좁아서 상승·하락 배지의 폭이 달라졌다(+12% 38.7px, -12% 36.5px, −12% 38.7px).
  const sign = side === 'down' ? '\u2212' : '+'

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
    if (target.closest('[data-zero]')) {
      if (!zeroSelected) onSelectZero()
      return
    }
    const handle = target.closest<HTMLElement>('[data-rank]')
    if (handle) {
      // 손잡이를 누르면 그 구간을 고르고(0% 칸에서는 상승 쪽), 같은 클릭에서 바로 끌 수 있다. 누른 자리에서는 움직이지 않고 끌기 시작할 때부터 따라간다.
      const rank = Number(handle.dataset.rank)
      if (zeroSelected || rank !== selectedRank) onSelectRank(rank, side === 'down' ? 'down' : 'up')
      draggingRankRef.current = rank
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    if (zeroSelected) return
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
  // 값 말풍선은 눈금 글자와 같은 줄·같은 크기(11px)로 그 위에 포개서 보여 준다(고른 값이 눈금과 같으면 그 눈금 글자를 덮는다).
  const badgeClass = 'absolute top-[35px] z-10 -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-brand px-1 text-[11px] font-medium leading-4 tabular-nums text-ui-background'

  return (
    <>
      {/* 막대 폭은 다른 탭의 슬라이더와 같은 .settings-slider-control 폭이다(양 끝 손잡이·눈금 글자는 그 바깥으로 조금 나온다). */}
      <div
        className="relative h-[51px] touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div ref={trackRef} className="settings-slider-control relative h-full">
          <div className="absolute inset-x-0 top-[12px] h-4 border border-ui-white/20" style={{ background: gradient }} />
          {zeroSelected && <span className={badgeClass} style={{ left: '0%' }}>0%</span>}
          <div
            data-zero
            role="img"
            aria-label="0% 고정"
            data-hint="0% 고정"
            className={`absolute left-0 top-[8px] box-border h-6 w-2 -translate-x-1/2 cursor-pointer rounded-[2px] border bg-ui-panel ${zeroSelected ? 'border-brand ring-[3px] ring-brand/35' : 'border-ui-control hover:border-ui-white'}`}
            style={{ backgroundColor: zeroColor }}
          />
          <div className={zeroSelected ? 'opacity-70' : ''}>
            {positive.map((item, rank) => {
              const selected = !zeroSelected && rank === selectedRank
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
                    className={`absolute top-[8px] box-border h-6 w-2 -translate-x-1/2 cursor-pointer rounded-[2px] border bg-ui-panel ${selected ? 'border-brand ring-[3px] ring-brand/35' : 'border-ui-control hover:border-ui-white'}`}
                    style={{ left }}
                  />
                </div>
              )
            })}
          </div>
          {BAR_TICKS.map(tick => {
            // 눈금 글자는 다른 슬라이더 아래 글자처럼 11px 흰색이고, 고른 값과 같은 눈금은 굵은 글씨(500)로 강조한다. 어두운 회색은 읽기 어려워 쓰지 않는다.
            const highlighted = zeroSelected ? tick === 0 : tick === positive[selectedRank ?? -1]?.percent
            return (
              <span
                key={tick}
                className={`pointer-events-none absolute top-[35px] -translate-x-1/2 whitespace-nowrap text-[11px]/4 transition-colors duration-300 ${highlighted ? 'font-medium' : ''} text-ui-white`}
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
  // 적용하지 않은 수정이 있을 때만 적용/취소 버튼을 보여준다.
  hasChanges: boolean
  // 등락률 막대 — 상승 구간의 경계(작은 값부터)와 고른 칸의 순서.
  bar: {
    positive: { percent: number; color: string }[]
    negative: { percent: number; color: string }[]
    side: 'up' | 'down' | 'zero'
    selectedRank: number | null
    zeroColor: string
  }
  onChangeRankPercent: (rank: number, percent: number) => void
  onSelectRank: (rank: number, side: 'up' | 'down') => void
  onSelectZero: () => void
  onApply: () => void
  onCancel: () => void
  isSaving: boolean
  errorMessage: string | null
}

// 범례 아래에서 편집하는 등락률 구간 패널. 하락/보합/상승 버튼은 지도 범례와 같은 순서·색이고(색은 정해져 있어 고르지 않는다),
// 어느 쪽 구간을 편집할지 정한다. 막대 값은 지도에 즉시 반영되고 적용 시 서버에 저장된다. 취소 시에는 부모가 세션 시작 전 값으로 되돌린다.
export default function TreemapColorThresholdEditorPanel({
  bar,
  onChangeRankPercent,
  onSelectRank,
  onSelectZero,
  onApply,
  onCancel,
  isSaving,
  errorMessage,
  hasChanges,
}: ColorThresholdEditorProps) {
  return (
    <div className="mt-2 flex flex-col gap-4 text-sm text-ui-white">
      <div>
        {/* 상승 / 보합 / 하락 — 업종 단계(대분류·중분류·소분류)처럼 글자만 있는 선택이고, 고른 것은 흰색, 안 고른 것은 회색이다. 색은 아래 막대가 보여 준다. */}
        <div role="radiogroup" aria-label="편집할 구간" className="settings-slider-control flex flex-row items-center justify-center gap-1.5 whitespace-nowrap text-[13px]/4">
          {(['up', 'zero', 'down'] as const).map(key => {
            const selected = bar.side === key
            // 배지 색은 지도 범례의 +2%(상승)·0%(보합)·-2%(하락) 칸과 같다.
            const badgeColor = key === 'up' ? bar.positive[0]?.color : key === 'down' ? bar.negative[0]?.color : bar.zeroColor
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  if (selected) return
                  if (key === 'zero') onSelectZero()
                  else onSelectRank(bar.selectedRank ?? 0, key)
                }}
                style={{ backgroundColor: badgeColor }}
                className={`box-border rounded-[3px] border border-solid border-ui-control px-[7px] py-0 text-[13px] font-light leading-[18px] ${selected ? 'text-ui-white' : 'text-ui-muted hover:text-ui-white'}`}
              >
                {CHIP_LABEL[key]}
              </button>
            )
          })}
        </div>
        <div className="mt-[6px]">
          <ThresholdBar
            positive={bar.positive}
            negative={bar.negative}
            side={bar.side}
            selectedRank={bar.selectedRank}
            zeroColor={bar.zeroColor}
            onChangeRankPercent={onChangeRankPercent}
            onSelectRank={onSelectRank}
            onSelectZero={onSelectZero}
        />
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="text-[13px] text-status-error-text">{errorMessage}</p>
      )}

      {(hasChanges || isSaving) && (
        <div className="settings-slider-control flex shrink-0 items-center gap-[6px]">
          <button
            type="button"
            onClick={onApply}
            disabled={isSaving}
            className="h-7 flex-1 rounded-[5px] border border-brand-surface bg-brand-surface px-3 py-0 text-[13px] font-medium text-ui-white transition-colors hover:border-brand-surface-hover hover:bg-brand-surface-hover disabled:cursor-wait disabled:opacity-70"
          >
            {isSaving ? '적용 중...' : '적용'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="h-7 flex-1 rounded-[5px] border border-ui-border bg-ui-control px-3 py-0 text-[13px] font-medium text-ui-white transition-colors hover:border-ui-border hover:bg-ui-control-hover disabled:cursor-wait disabled:opacity-70"
          >
            취소
          </button>
        </div>
      )}
    </div>
  )
}
