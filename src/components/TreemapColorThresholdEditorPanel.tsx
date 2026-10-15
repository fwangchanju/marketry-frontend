import { useRef } from 'react'
import { resolveTreemapColor } from '@/utils/treemapColorScale'
import { BAR_MAX_PERCENT, BAR_MIN_PERCENT, BAR_TICKS, percentToPosition, positionToPercent } from '@/utils/thresholdBar'

// 색은 고르는 것이 아니라 정해져 있다 — 하락은 파랑, 보합(0%)은 회색, 상승은 빨강이고 구간 순서대로 명도가 올라간다(treemapColorScale.fixedRankColor).
// 버튼에는 그 색 계열의 대표색(상승·하락은 명도 46)을 쓴다.
const CHIP_COLOR = { down: '#1d61cd', zero: '#808080', up: '#cd1d1d' } as const
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
  const sign = side === 'down' ? '-' : '+'

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
  const badgeClass = 'absolute -top-1 -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-[var(--brand)] px-1.5 text-xs font-bold leading-[18px] text-black'

  return (
    <>
      {/* 막대 폭은 다른 탭의 슬라이더와 같은 .settings-slider-control 폭이다(양 끝 손잡이·눈금 글자는 그 바깥으로 조금 나온다). */}
      <div
        className="relative h-[62px] touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div ref={trackRef} className="settings-slider-control relative h-full">
          <div className="absolute inset-x-0 top-[23px] h-4 border border-white/25" style={{ background: gradient }} />
          {zeroSelected && <span className={badgeClass} style={{ left: '0%' }}>0%</span>}
          <div
            data-zero
            role="img"
            aria-label="0% 고정"
            data-hint="0% 고정 — 색만 바꿀 수 있습니다"
            className={`absolute left-0 top-[19px] box-border h-6 w-2 -translate-x-1/2 cursor-pointer rounded-[2px] border ${zeroSelected ? 'border-[var(--brand)] ring-[3px] ring-[var(--brand)]/35' : 'border-zinc-200 hover:border-white'}`}
            style={{ backgroundColor: zeroColor }}
          />
          <div className={zeroSelected ? 'opacity-60' : ''}>
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
                    className={`absolute top-[19px] box-border h-6 w-2 -translate-x-1/2 cursor-pointer rounded-[2px] border bg-zinc-800 ${selected ? 'border-[var(--brand)] ring-[3px] ring-[var(--brand)]/35' : 'border-zinc-200 hover:border-white'}`}
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
                className={`pointer-events-none absolute top-[46px] -translate-x-1/2 whitespace-nowrap text-[11px]/4 transition-colors duration-300 ${highlighted ? 'font-medium' : ''} text-white`}
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
    <div className="mt-4 flex flex-col gap-4 text-sm text-white">
      <div>
        {/* 하락 / 보합 / 상승 — 지도 범례와 같은 순서·색. 선택 표시는 외곽선 대신 체크(✓)와 선명도(안 고른 쪽은 흐리게)로 한다. 폭은 아래 막대와 같다. */}
        <div role="group" aria-label="편집할 구간" className="settings-slider-control grid grid-cols-3 gap-1">
          {(['down', 'zero', 'up'] as const).map(key => {
            const selected = bar.side === key
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (selected) return
                  if (key === 'zero') onSelectZero()
                  else onSelectRank(bar.selectedRank ?? 0, key)
                }}
                className={`flex h-[26px] items-center justify-center gap-1 rounded-[5px] border border-white/25 p-0 text-[12px] font-bold text-white ${selected ? '' : 'opacity-50 hover:opacity-80'}`}
                style={{ backgroundColor: CHIP_COLOR[key] }}
              >
                {selected && (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                )}
                {CHIP_LABEL[key]}
              </button>
            )
          })}
        </div>
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

      {errorMessage && (
        <p role="alert" className="text-[13px] text-red-400">{errorMessage}</p>
      )}

      {(hasChanges || isSaving) && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onApply}
            disabled={isSaving}
            className="flex-1 rounded border border-cyan-700 bg-cyan-700 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:border-cyan-600 hover:bg-cyan-600 disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? '적용 중...' : '적용'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 rounded border border-zinc-600 bg-zinc-600 px-3 py-1.5 text-[13px] text-white transition-colors hover:border-zinc-500 hover:bg-zinc-500 disabled:cursor-wait disabled:opacity-60"
          >
            취소
          </button>
        </div>
      )}
    </div>
  )
}
