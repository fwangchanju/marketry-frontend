import { useState } from 'react'
import { hexToHsl, hslToHex, type ColorScaleThreshold } from '@/utils/marketMapColorScale'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'

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
// 색상 줄 동그라미 한 개의 지름(h-6 w-6)과 개수(회색 + 색 7개). 위 등락률 줄의 색상 칸 너비를 이 값으로 맞춘다.
const SWATCH_SIZE_PX = 24
const SWATCH_COUNT = 8
// 등락률 줄의 입력칸과 색상 칸의 너비 — 아래 색상 줄 맨 오른쪽 두 동그라미의 바깥 두 끝선에 맞춘 값이다(둘이 같은 너비).
const THRESHOLD_BOX_WIDTH = `calc(${SWATCH_SIZE_PX * 2}px + (100% - ${SWATCH_SIZE_PX * SWATCH_COUNT}px) / ${SWATCH_COUNT - 1})`
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

interface ThresholdRowProps {
  threshold: ColorScaleThreshold
  // 0% 구간은 등락률 자체가 고정이라 색만 바꿀 수 있다.
  locked: boolean
  onChangeThreshold: (percent: number) => void
}

// 하나의 threshold 행 — 부호 있는 정수 입력(예: 5, -3) + 색 미리보기만 담당한다.
// 상승/하락은 별도 버튼 없이 입력값의 부호로 정한다. 아래 색상 팔레트에서 고른 색이 이 행에 적용된다.
function ThresholdRow({ threshold, locked, onChangeThreshold }: ThresholdRowProps) {
  const savedText = () => String(threshold.thresholdPercent)
  const [text, setText] = useState(savedText)

  const commit = () => {
    const value = Number(text)
    // 빈 입력, 정수가 아닌 값, 범위(±30) 밖의 값은 확정하지 않는다. 0%는 0% 칸에서만 쓸 수 있어서 다른 칸에는 입력할 수 없다.
    if (text.trim() === '' || !Number.isInteger(value) || Math.abs(value) > 30 || value === 0) {
      setText(savedText())
      return
    }
    onChangeThreshold(value)
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={-30}
        max={30}
        step={1}
        placeholder="예: 5, -3"
        value={text}
        disabled={locked}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
        style={{ width: THRESHOLD_BOX_WIDTH }}
        className="h-7 shrink-0 rounded border border-gray-600 bg-zinc-700 px-2 text-right text-sm text-white outline-none [appearance:textfield] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="text-[13px] text-gray-400">%</span>
      {/* 색상 칸 — 아래 색상 줄 맨 오른쪽 두 동그라미(24px, 사이 간격은 8칸을 양끝 맞춤으로 나눈 값)의 바깥 두 끝선에 이 칸의 양 끝을 맞춘다. 입력칸과 같은 너비다. */}
      <span
        className="ml-auto h-7 shrink-0 rounded border border-gray-600"
        style={{ backgroundColor: threshold.color, width: THRESHOLD_BOX_WIDTH }}
      />
    </div>
  )
}

export interface ColorThresholdEditorProps {
  // 편집 대상 칸이 바뀔 때마다 달라지는 값 — 부모가 key로 써서 입력 상태를 새로 시작하게 한다.
  sessionKey: number
  // 적용하지 않은 수정이 있을 때만 적용/취소 버튼을 보여준다.
  hasChanges: boolean
  // 이번 세션에서 편집 중인 threshold들(행 순서) — 이 패널이 열려있는 동안 조정할 때마다 부모(페이지)가
  // draft를 즉시 갱신해서 실제 지도에 실시간으로 반영한다(패널 자체는 로컬 값을 들고 있지 않음).
  // 한 번에 한 구간만 편집한다(항상 1개).
  thresholds: ColorScaleThreshold[]
  onChangeThreshold: (rowIndex: number, percent: number) => void
  onChangeColor: (rowIndex: number, color: string, colorLabel: string | null) => void
  onApply: () => void
  onCancel: () => void
  isSaving: boolean
  errorMessage: string | null
}

// 범례 아래에서 편집하는 색상 추가/수정 패널. 색상칸을 고르면 지도에 즉시 반영되고,
// 적용 시 서버에 저장된다. 취소 시에는 부모가 세션 시작 전 값으로 되돌린다.
export default function MarketMapColorThresholdEditorPanel({
  thresholds,
  onChangeThreshold,
  onChangeColor,
  onApply,
  onCancel,
  isSaving,
  errorMessage,
  hasChanges,
}: ColorThresholdEditorProps) {
  const threshold = thresholds[0]
  // 0% 칸의 편집인지는 편집을 시작한 시점으로 정한다 — 값이 바뀌는 중에 입력칸이 잠기면 안 된다.
  const [isZeroLocked] = useState(() => threshold?.thresholdPercent === 0)
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
        <p className="color-editor-step mb-2 text-[13px] text-gray-300">등락률</p>
        <ThresholdRow
          threshold={threshold}
          locked={isZeroLocked}
          onChangeThreshold={percent => onChangeThreshold(0, percent)}
        />
      </div>

      <div>
        <p className="color-editor-step mb-2 text-[13px] text-gray-300">색상</p>
        <div className="flex justify-between" role="group" aria-label="색상 선택">
          {swatches.map(swatch => (
            <span key={swatch.key} className="group relative inline-flex">
              <button
                type="button"
                aria-label={swatch.label}
                aria-pressed={selection.key === swatch.key}
                onClick={() => applySelection(swatch.key, selection.lightness)}
                className={`h-6 w-6 shrink-0 rounded-full border-2 p-0 ${selection.key === swatch.key ? 'border-white ring-1 ring-white/40' : 'border-transparent hover:border-white/60'}`}
                style={{ backgroundColor: swatch.color }}
              />
              {/* 색 이름 — 강조 색상(4-1)과 같은 말풍선으로, 마우스를 올렸을 때만 뜬다. */}
              <span
                role="tooltip"
                className={`pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap ${HINT_BUBBLE_CLASS} opacity-0 transition-opacity group-hover:visible group-hover:opacity-100`}
              >
                {swatch.label}
              </span>
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
