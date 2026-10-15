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

// 색상 줄에는 어두운 배경에서도 잘 보이는 중간 밝기의 대표색만 보여주고, 밝기는 아래 슬라이더로 정한다.
const SWATCH_LIGHTNESS = 55
const MIN_LIGHTNESS = 8
const MAX_LIGHTNESS = 92
const GRAY_KEY = 'gray'
const GRAY_SWATCH = { key: GRAY_KEY, label: '회색', colorLabel: 'gray' as string | null }

// 저장된 hex가 어느 색 계열/밝기인지 역산해서 편집 시작 시 선택 상태를 맞춘다.
function inferSelection(hex: string): { key: string; lightness: number } {
  const { h, s: saturation, l } = hexToHsl(hex)
  const lightness = Math.round(Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, l)))
  if (saturation < 12) return { key: GRAY_KEY, lightness }
  const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
  const nearest = HUE_PRESETS.reduce((best, preset) => (distance(preset.hue, h) < distance(best.hue, h) ? preset : best))
  return { key: nearest.name, lightness }
}

interface ThresholdBarProps {
  // 상승 구간의 경계(작은 값부터)와 구간 색 — 막대의 손잡이 하나가 구간 하나다.
  positive: { percent: number; color: string }[]
  // 편집 중인 칸이 몇 번째 구간인지(하락 칸이면 같은 순서의 상승 손잡이). 0% 칸이면 null이다.
  selectedRank: number | null
  zeroColor: string
  onChangeRankPercent: (rank: number, percent: number) => void
  onSelectRank: (rank: number) => void
}

// 등락률 막대 — 0~30%를 제곱근 눈금으로 그리고 손잡이를 끌어 구간 경계를 정한다(손잡이는 이웃을 넘지 못하고 정수로 움직인다).
// 하락 구간은 같은 값의 거울로 자동 적용된다. 선택하지 않은 손잡이를 누르면 그 구간을 고르고, 선택한 손잡이는 끌거나 ←→ 키로 1씩 옮긴다.
function ThresholdBar({ positive, selectedRank, zeroColor, onChangeRankPercent, onSelectRank }: ThresholdBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const locked = selectedRank === null
  const lastColor = positive.at(-1)?.color ?? zeroColor
  const gradient = `linear-gradient(90deg, ${[`${zeroColor} 0%`, ...positive.map(item => `${item.color} ${(percentToPosition(item.percent) * 100).toFixed(2)}%`), `${lastColor} 100%`].join(', ')})`

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
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-rank]')
    if (handle && Number(handle.dataset.rank) !== selectedRank) {
      // 다른 손잡이를 누르면 그 구간을 고른다(끌기는 고른 다음부터 시작한다).
      onSelectRank(Number(handle.dataset.rank))
      return
    }
    if (locked) return
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

  return (
    <>
      <div
        ref={trackRef}
        className={`relative h-[62px] touch-none select-none ${locked ? 'opacity-50' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div className="absolute inset-x-0 top-[26px] h-2.5 rounded-full border border-white/25" style={{ background: gradient }} />
        {positive.map((item, rank) => {
          const selected = rank === selectedRank
          const left = `${percentToPosition(item.percent) * 100}%`
          return (
            <div key={rank}>
              {selected && (
                <span
                  className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-[3px] bg-[var(--brand)] px-1.5 text-xs font-bold leading-[18px] text-black"
                  style={{ left: `${edgeAligned(percentToPosition(item.percent))}%` }}
                >
                  +{item.percent}%
                </span>
              )}
              <div
                data-rank={rank}
                role="slider"
                tabIndex={selected ? 0 : -1}
                aria-label={`+${item.percent}% 구간 경계`}
                aria-valuemin={BAR_MIN_PERCENT}
                aria-valuemax={BAR_MAX_PERCENT}
                aria-valuenow={item.percent}
                onKeyDown={event => handleKeyDown(event, rank)}
                className={`absolute top-[21px] h-5 w-5 -translate-x-1/2 cursor-pointer rounded-full border-2 bg-white shadow ${selected ? 'border-[var(--brand)] ring-[3px] ring-[var(--brand)]/35' : 'border-gray-500 hover:border-gray-300'}`}
                style={{ left }}
              />
            </div>
          )
        })}
        {BAR_TICKS.map((tick, index) => (
          <span
            key={tick}
            className={`pointer-events-none absolute top-[44px] text-[10px] text-gray-500 ${index === 0 ? '' : index === BAR_TICKS.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: `${percentToPosition(tick) * 100}%` }}
          >
            {tick}%
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-gray-400">
        {locked ? '0% 구간은 색만 바꿀 수 있습니다.' : `하락도 같은 값으로 자동 적용 (${positive.map(item => `-${item.percent}%`).join(' / ')})`}
      </p>
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
  bar: { positive: { percent: number; color: string }[]; selectedRank: number | null; zeroColor: string }
  onChangeRankPercent: (rank: number, percent: number) => void
  onSelectRank: (rank: number) => void
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
  onChangeColor,
  onApply,
  onCancel,
  isSaving,
  errorMessage,
  hasChanges,
}: ColorThresholdEditorProps) {
  const threshold = thresholds[0]
  const [selection, setSelection] = useState(() => (threshold ? inferSelection(threshold.color) : { key: GRAY_KEY, lightness: 50 }))
  if (!threshold) return null

  const selectedPreset = HUE_PRESETS.find(preset => preset.name === selection.key)
  const hue = selectedPreset?.hue ?? 0
  const saturation = selectedPreset ? SATURATION : 0
  const applySelection = (key: string, lightness: number) => {
    setSelection({ key, lightness })
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
        <p className="color-editor-step mb-1 text-[13px] text-gray-300">등락률</p>
        <ThresholdBar
          positive={bar.positive}
          selectedRank={bar.selectedRank}
          zeroColor={bar.zeroColor}
          onChangeRankPercent={onChangeRankPercent}
          onSelectRank={onSelectRank}
        />
      </div>

      <div>
        <p className="color-editor-step mb-2 text-[13px] text-gray-300">색상</p>
        <div className="flex justify-between" role="group" aria-label="색상 선택">
          {swatches.map(swatch => (
            <span key={swatch.key} className="inline-flex">
              <button
                type="button"
                aria-label={swatch.label}
                data-hint={swatch.label}
                aria-pressed={selection.key === swatch.key}
                onClick={() => applySelection(swatch.key, selection.lightness)}
                className={`h-6 w-6 shrink-0 rounded-full border-2 p-0 ${selection.key === swatch.key ? 'border-white ring-1 ring-white/40' : 'border-transparent hover:border-white/60'}`}
                style={{ backgroundColor: swatch.color }}
              />
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="color-editor-step mb-2 text-[13px] text-gray-300">명도</p>
        <input
          type="range"
          min={MIN_LIGHTNESS}
          max={MAX_LIGHTNESS}
          step={1}
          value={selection.lightness}
          aria-label="명도"
          onChange={e => applySelection(selection.key, Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, hsl(${hue} ${saturation}% ${MIN_LIGHTNESS}%), hsl(${hue} ${saturation}% 50%), hsl(${hue} ${saturation}% ${MAX_LIGHTNESS}%))`,
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-full border border-gray-600 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-zinc-900 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-zinc-900"
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
