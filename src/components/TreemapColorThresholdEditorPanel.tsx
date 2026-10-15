import { useRef } from 'react'
import { hexToHsl, hslToHex, lightnessForPercent, resolveTreemapColor, type ColorScaleThreshold } from '@/utils/treemapColorScale'
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

// 색상 줄에는 어두운 배경에서도 잘 보이는 중간 밝기의 대표색만 보여준다. 실제 칸 색의 밝기는 등락률 값(lightnessForPercent)으로 정해지고 따로 고르지 않는다.
const SWATCH_LIGHTNESS = 55
// 0% 칸을 골랐을 때는 색 줄이 회색 8단계로 바뀐다(기본 0% 회색은 명도 50). 흰 글자가 읽히도록 너무 밝은 단계는 두지 않는다.
const ZERO_GRAY_STEPS = [20, 26, 32, 38, 44, 50, 56, 62]
const grayStepKey = (lightness: number) => `gray-${lightness}`
const nearestGrayStep = (hex: string) => ZERO_GRAY_STEPS.reduce((best, step) => (Math.abs(step - hexToHsl(hex).l) < Math.abs(best - hexToHsl(hex).l) ? step : best))
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
  // 끌고 있는 손잡이의 순서 — 선택하지 않은 손잡이를 눌러도 같은 클릭에서 바로 끌 수 있도록, 고른 칸이 아니라 누른 손잡이를 따라 움직인다.
  const draggingRankRef = useRef<number | null>(null)
  const zeroSelected = side === 'zero'
  // 막대 색은 고른 쪽(상승/하락)의 구간 색을 이어서 보여 준다.
  const colored = side === 'down' ? negative : positive
  // 막대 색은 지도 박스 색과 같은 계산(resolveTreemapColor)을 0~30%에서 촘촘히 찍어 그린다 — 최고 단계 이후의 점점 밝아지는 색도 그대로 보인다.
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
  // 상승/하락 한쪽의 모든 구간 색을 한 번에 바꾼다(colors는 작은 구간부터 순서별 명도로 칠한 값).
  onChangeSideColor: (side: 'up' | 'down', colors: string[], colorLabel: string | null) => void
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
  onChangeSideColor,
  onApply,
  onCancel,
  isSaving,
  errorMessage,
  hasChanges,
}: ColorThresholdEditorProps) {
  const threshold = thresholds[0]
  // 선택 표시는 편집 중인 쪽의 색에서 바로 읽는다 — 상승/하락은 그쪽 첫 구간 색의 계열, 0% 칸은 가장 가까운 회색 단계.
  const sideColor = bar.side === 'down' ? bar.negative[0]?.color : bar.positive[0]?.color
  const selectedKey = bar.side === 'zero'
    ? grayStepKey(nearestGrayStep(bar.zeroColor))
    : (sideColor ?? threshold?.color) ? inferSelection((sideColor ?? threshold?.color)!) : GRAY_KEY
  if (!threshold) return null

  // 색은 구간(손잡이)마다 고르지 않고 슬라이더 한쪽(상승 또는 하락) 전체에 하나를 정한다 — 구간 순서대로 16·33·46·58 밝기로 칠한다. 0% 칸을 골랐을 때만 그 칸 색을 바꾼다.
  const paint = (hueKey: string, lightness: number) => {
    const preset = HUE_PRESETS.find(item => item.name === hueKey)
    return hslToHex(preset?.hue ?? 0, preset ? SATURATION : 0, lightness)
  }
  const applySelection = (key: string) => {
    const preset = HUE_PRESETS.find(item => item.name === key)
    const colorLabel = preset ? preset.colorLabel : GRAY_SWATCH.colorLabel
    if (bar.side === 'zero') {
      onChangeColor(0, hslToHex(0, 0, Number(key.replace('gray-', ''))), GRAY_SWATCH.colorLabel)
      return
    }
    const rows = bar.side === 'down' ? bar.negative : bar.positive
    onChangeSideColor(bar.side, rows.map(row => paint(key, lightnessForPercent(row.percent))), colorLabel)
  }
  // 반대쪽(상승↔하락)이 이미 쓰는 색 계열은 고를 수 없다 — 상승과 하락이 같은 색이 되면 구분이 안 된다. 0% 칸은 제한이 없다.
  const otherSideColor = bar.side === 'up' ? bar.negative[0]?.color : bar.side === 'down' ? bar.positive[0]?.color : undefined
  const otherSideKey = otherSideColor ? inferSelection(otherSideColor) : null
  const otherSideLabel = bar.side === 'up' ? '하락' : '상승'
  // 같은 8칸 자리에 상승/하락을 편집할 때는 회색+색 계열 7개(회색은 막힘), 0% 칸을 편집할 때는 명도가 다른 회색 8단계를 보여 준다.
  const zeroMode = bar.side === 'zero'
  const swatches = zeroMode
    ? ZERO_GRAY_STEPS.map(step => ({ key: grayStepKey(step), label: `회색 명도 ${step}`, color: hslToHex(0, 0, step) }))
    : [
        { key: GRAY_SWATCH.key, label: GRAY_SWATCH.label, color: hslToHex(0, 0, SWATCH_LIGHTNESS) },
        ...HUE_PRESETS.map(preset => ({ key: preset.name, label: preset.label, color: hslToHex(preset.hue, SATURATION, SWATCH_LIGHTNESS) })),
      ]

  return (
    <div className="color-editor-steps mt-4 flex flex-col gap-4 text-sm text-white">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="color-editor-step pl-[19px] text-[13px] text-gray-300">색상</p>
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
        {/* 색 동그라미 줄은 아래 막대와 같은 폭(.settings-slider-control)에 양 끝을 맞춘다. 8칸이 들어가도록 동그라미는 22px이다. */}
        <div className="settings-slider-control flex justify-between" role="group" aria-label="색상 선택">
          {swatches.map(swatch => {
            // 회색은 0% 칸 전용이라 상승/하락 편집 중에는 막고, 반대쪽이 쓰는 색 계열도 막는다.
            const grayBlocked = !zeroMode && swatch.key === GRAY_KEY
            const blocked = grayBlocked || (swatch.key === otherSideKey && selectedKey !== swatch.key)
            return (
            <span key={swatch.key} className="inline-flex">
              <button
                type="button"
                aria-label={swatch.label}
                data-hint={grayBlocked ? '회색은 0% 칸에서만 고를 수 있습니다' : blocked ? `${swatch.label} — ${otherSideLabel}에서 사용 중` : swatch.label}
                aria-pressed={selectedKey === swatch.key}
                aria-disabled={blocked}
                onClick={() => { if (!blocked) applySelection(swatch.key) }}
                className={`h-[22px] w-[22px] shrink-0 rounded-full border-2 p-0 ${blocked ? 'cursor-not-allowed border-transparent opacity-25' : selectedKey === swatch.key ? 'border-white ring-1 ring-white/40' : 'border-transparent hover:border-white/60'}`}
                style={{ backgroundColor: swatch.color }}
              />
            </span>
            )
          })}
        </div>
      </div>

      <div>
        <p className="color-editor-step mb-1 pl-[19px] text-[13px] text-gray-300">등락률</p>
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
