import { useRef, useState } from 'react'
import { hexToHsl, hslToHex, type ColorScaleThreshold } from '@/utils/treemapColorScale'
import { BAR_MAX_PERCENT, BAR_MIN_PERCENT, BAR_TICKS, percentToPosition, positionToPercent } from '@/utils/thresholdBar'

const SATURATION = 75

interface HuePreset {
  name: string
  label: string
  hue: number
  colorLabel: string | null
}

const HUE_PRESETS: HuePreset[] = [
  { name: 'red', label: '빨강', hue: 0, colorLabel: 'red' },
  { name: 'orange', label: '주황', hue: 28, colorLabel: 'orange' },
  { name: 'yellow', label: '노랑', hue: 50, colorLabel: 'yellow' },
  { name: 'green', label: '초록', hue: 142, colorLabel: 'green' },
  { name: 'blue', label: '파랑', hue: 217, colorLabel: 'blue' },
  { name: 'purple', label: '보라', hue: 271, colorLabel: 'purple' },
  { name: 'magenta', label: '자홍', hue: 310, colorLabel: null },
]

// 색상 줄에는 어두운 배경에서도 잘 보이는 중간 밝기의 대표색만 보여준다. 실제 칸 색의 밝기는 구간 순서(작은 값부터)로 정해지고 따로 고르지 않는다.
const SWATCH_LIGHTNESS = 55
const RANK_LIGHTNESS = [16, 33, 46, 58]
const ZERO_LIGHTNESS = 50
const GRAY_KEY = 'gray'
const GRAY_SWATCH = { key: GRAY_KEY, label: '회색', colorLabel: 'gray' as string | null }

// 저장된 hex가 어느 색 계열인지 역산해서 편집 시작 시 선택 상태를 맞춘다(밝기는 구간 순서로 정해지므로 읽지 않는다).
function inferSelection(hex: string): string {
  const { h, s: saturation } = hexToHsl(hex)
  if (saturation < 12) return GRAY_KEY
  const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
  const nearest = HUE_PRESETS.reduce((best, preset) => (distance(preset.hue, h) < distance(best.hue, h) ? preset : best))
  return nearest.name
}

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
  const draggingRef = useRef(false)
  const zeroSelected = side === 'zero'
  // 막대 색은 고른 쪽(상승/하락)의 구간 색을 이어서 보여 준다.
  const colored = side === 'down' ? negative : positive
  const lastColor = colored.at(-1)?.color ?? zeroColor
  const gradient = `linear-gradient(90deg, ${[`${zeroColor} 0%`, ...colored.map((item, rank) => `${item.color} ${(percentToPosition(positive[rank]?.percent ?? item.percent) * 100).toFixed(2)}%`), `${lastColor} 100%`].join(', ')})`
  const sign = side === 'down' ? '-' : '+'

  const percentAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    return rect && rect.width > 0 ? positionToPercent((clientX - rect.left) / rect.width) : null
  }
  const moveTo = (clientX: number) => {
    if (selectedRank === null) return
    const percent = percentAt(clientX)
    if (percent !== null) onChangeRankPercent(selectedRank, percent)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-zero]')) {
      if (!zeroSelected) onSelectZero()
      return
    }
    const handle = target.closest<HTMLElement>('[data-rank]')
    if (handle && (zeroSelected || Number(handle.dataset.rank) !== selectedRank)) {
      // 다른 손잡이를 누르면 그 구간을 고른다(끌기는 고른 다음부터 시작한다). 0% 칸에서는 상승 쪽으로 고른다.
      onSelectRank(Number(handle.dataset.rank), side === 'down' ? 'down' : 'up')
      return
    }
    if (zeroSelected) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    moveTo(event.clientX)
  }
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) moveTo(event.clientX)
  }
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
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
  const badgeClass = 'absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-[var(--brand)] px-1.5 text-xs font-bold leading-[18px] text-black'

  return (
    <>
      {/* 양 끝 손잡이·표식이 바깥으로 나가지 않도록 막대 양옆에 10px 여백을 둔다. */}
      <div
        className="relative h-[62px] touch-none select-none px-2.5"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div ref={trackRef} className="relative h-full">
          <div className="absolute inset-x-0 top-[26px] h-2.5 rounded-full border border-white/25" style={{ background: gradient }} />
          {zeroSelected && <span className={badgeClass} style={{ left: '0%' }}>0%</span>}
          <div
            data-zero
            role="img"
            aria-label="0% 고정"
            data-hint="0% 고정 — 색만 바꿀 수 있습니다"
            className={`absolute left-0 top-[23px] box-border h-4 w-4 -translate-x-1/2 cursor-pointer rounded-full border ${zeroSelected ? 'border-[var(--brand)] ring-[3px] ring-[var(--brand)]/35' : 'border-zinc-200 hover:border-white'}`}
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
                    className={`absolute top-[23px] box-border h-4 w-4 -translate-x-1/2 cursor-pointer rounded-full border bg-zinc-800 ${selected ? 'border-[var(--brand)] ring-[3px] ring-[var(--brand)]/35' : 'border-zinc-200 hover:border-white'}`}
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
                className={`pointer-events-none absolute top-[42px] -translate-x-1/2 whitespace-nowrap text-[11px]/4 transition-colors duration-300 ${highlighted ? 'font-medium' : ''} text-white`}
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
  // 편집 대상 칸이 바뀔 때마다 달라지는 값 — 부모가 key로 써서 입력 상태를 새로 시작하게 한다.
  sessionKey: number
  // 적용하지 않은 수정이 있을 때만 적용/취소 버튼을 보여준다.
  hasChanges: boolean
  // 이번 세션에서 편집 중인 threshold들 — 첫 행이 지금 고른 칸이고(색 편집 대상), 나머지는 막대로 함께 바뀐 거울 구간이다.
  thresholds: ColorScaleThreshold[]
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
  onChangeColor: (rowIndex: number, color: string, colorLabel: string | null) => void
  onApply: () => void
  onCancel: () => void
  isSaving: boolean
  errorMessage: string | null
}

// 범례 아래에서 편집하는 색상 추가/수정 패널. 색상칸을 고르면 지도에 즉시 반영되고,
// 적용 시 서버에 저장된다. 취소 시에는 부모가 세션 시작 전 값으로 되돌린다.
export default function TreemapColorThresholdEditorPanel({
  thresholds,
  bar,
  onChangeRankPercent,
  onSelectRank,
  onSelectZero,
  onChangeColor,
  onApply,
  onCancel,
  isSaving,
  errorMessage,
  hasChanges,
}: ColorThresholdEditorProps) {
  const threshold = thresholds[0]
  const [selectedKey, setSelectedKey] = useState(() => (threshold ? inferSelection(threshold.color) : GRAY_KEY))
  if (!threshold) return null

  const lightness = bar.side === 'zero' ? ZERO_LIGHTNESS : RANK_LIGHTNESS[Math.min(bar.selectedRank ?? 0, RANK_LIGHTNESS.length - 1)]
  const applySelection = (key: string) => {
    setSelectedKey(key)
    const preset = HUE_PRESETS.find(item => item.name === key)
    onChangeColor(0, hslToHex(preset?.hue ?? 0, preset ? SATURATION : 0, lightness), preset ? preset.colorLabel : GRAY_SWATCH.colorLabel)
  }
  const swatches = [
    { key: GRAY_SWATCH.key, label: GRAY_SWATCH.label, color: hslToHex(0, 0, SWATCH_LIGHTNESS) },
    ...HUE_PRESETS.map(preset => ({ key: preset.name, label: preset.label, color: hslToHex(preset.hue, SATURATION, SWATCH_LIGHTNESS) })),
  ]

  return (
    <div className="color-editor-steps mt-4 flex flex-col gap-4 text-sm text-white">
      <div>
        <p className="color-editor-step mb-2 text-[13px] text-gray-300">색상</p>
        <div className="flex justify-between" role="group" aria-label="색상 선택">
          {swatches.map(swatch => (
            <span key={swatch.key} className="inline-flex">
              <button
                type="button"
                aria-label={swatch.label}
                data-hint={swatch.label}
                aria-pressed={selectedKey === swatch.key}
                onClick={() => applySelection(swatch.key)}
                className={`h-6 w-6 shrink-0 rounded-full border-2 p-0 ${selectedKey === swatch.key ? 'border-white ring-1 ring-white/40' : 'border-transparent hover:border-white/60'}`}
                style={{ backgroundColor: swatch.color }}
              />
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-end">
          {/* 어느 쪽 구간의 색을 고칠지 고른다 — 막대의 값은 같고 색만 상승(빨강 계열)·하락(파랑 계열)으로 나뉜다. */}
          <div role="group" aria-label="색을 고칠 쪽" className="flex gap-1">
            {([['up', '상승'], ['down', '하락']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={bar.side === key}
                onClick={() => { if (bar.side !== key) onSelectRank(bar.selectedRank ?? 0, key) }}
                // 설정창의 다른 선택 버튼(종목 등락 방향 등)과 같은 색 — 고른 쪽은 슬라이더 선과 같은 밝은 회색에 검은 글자, 안 고른 쪽은 어두운 칩 색에 밝은 글자다.
                className={`h-5 w-9 rounded-full border-0 p-0 text-[11px] font-medium transition-colors ${bar.side === key ? 'bg-[var(--accent)] text-zinc-900' : 'bg-[#4b4b50] text-zinc-200 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
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
