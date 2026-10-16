// 마켓맵 종목 박스/범례가 공유하는 등락률 컬러 스케일 계산.
// 박스 색칠(StockBox)과 범례 스와치(MapPage) 양쪽이 반드시 이 모듈만 거치도록 해서,
// 예전처럼 두 곳이 서로 다른 하드코딩 배열을 들고 있다가 실제 값이 어긋나는 문제를 구조적으로 막는다.
// GET /api/map/scale 응답(TreemapScaleResponse)을 그대로 입력(ColorScaleConfig)으로 받는다.
// side는 별도 필드가 아니라 thresholdPercent의 부호로 표현한다(음수=하락, 0=기준, 양수=상승) —
// "side와 부호가 서로 다른 값을 가리키는" 상태 자체를 구조적으로 불가능하게 만든다.
// 서버에서 받은 threshold는 항상 id가 있지만, 어드민이 방금 로컬에서 추가해서 아직 생성 API를
// 안 부른 행은 id가 없다 — 그래서 여기서는 zod 스키마(id 필수)를 그대로 재사용하지 않고 optional로 둔다.
export interface ColorScaleThreshold {
  id?: number
  thresholdPercent: number
  color: string
  colorLabel: string | null
}
export interface ColorScaleConfig {
  thresholds: ColorScaleThreshold[]
}

// 기본 색상 규칙 — 파랑(음수)과 빨강(양수)은 같은 채도(75)와 같은 명도를 쓰고, 명도는 구간 순서대로 16·33·46·58로 오른다(기본 구간은 2/5/8/12%).
// 0%는 색상 편집기의 첫 색인 회색(채도 0)이고 명도는 50이다. 색상은 색상 편집기의 파랑(217)·빨강(0) 프리셋과 같다.
// 범례는 하락 4칸 + 0% + 상승 4칸의 9칸이다.
// 0%일 때 색 — 저장된 threshold가 없으면 이 값으로 폴백.
export const DEFAULT_ZERO_COLOR = '#808080'

// 저장된 threshold가 하나도 없는 side에 쓰는 폴백 프리셋(절댓값 기준). 2/5/8/12%p의 4개 임계값에만 threshold를 둔다.
// 12% 초과는 별도 threshold를 추가하지 않고, 아래 resolveTreemapColor의 "최고 threshold 초과 시 clamp" 동작에 맡긴다 —
// 그래야 12~30% 전체가 flat한 최고 단계 색 그대로 유지된다.
export const DEFAULT_PLUS_THRESHOLDS: ColorScaleThreshold[] = [
  { thresholdPercent: 2, color: '#470a0a', colorLabel: 'red' }, // 명도 16
  { thresholdPercent: 5, color: '#931515', colorLabel: 'red' }, // 명도 33
  { thresholdPercent: 8, color: '#cd1d1d', colorLabel: 'red' }, // 명도 46
  { thresholdPercent: 12, color: '#e44444', colorLabel: 'red' }, // 명도 58
]
export const DEFAULT_MINUS_THRESHOLDS: ColorScaleThreshold[] = [
  { thresholdPercent: 2, color: '#0a2247', colorLabel: 'blue' }, // 명도 16
  { thresholdPercent: 5, color: '#154593', colorLabel: 'blue' }, // 명도 33
  { thresholdPercent: 8, color: '#1d61cd', colorLabel: 'blue' }, // 명도 46
  { thresholdPercent: 12, color: '#4481e4', colorLabel: 'blue' }, // 명도 58
]

// 저장된 구간이 하나도 없을 때 draft를 채우는 초기값 — 위 기본 프리셋을 부호 있는 실제 구간(-12/-8/-5/-2, +2/+5/+8/+12)으로
// 펼친 것이다. 대체값으로만 두면 편집 영역이 한 칸을 열 때 그 부호에 구간이 하나만 생겨서 나머지 기본 칸이 범례에서
// 사라진다(9칸이 줄어듦). 색 계산은 대체값과 같은 구간이라 지도 모양은 그대로다.
export function createDefaultColorScale(): ColorScaleConfig {
  return {
    thresholds: [
      ...DEFAULT_MINUS_THRESHOLDS.map(threshold => ({ ...threshold, thresholdPercent: -threshold.thresholdPercent })),
      ...DEFAULT_PLUS_THRESHOLDS.map(threshold => ({ ...threshold })),
    ],
  }
}

// 상승(빨강, 색상 0)·하락(파랑, 색상 217)의 정해진 색 — 채도 75에 구간 순서(작은 값부터)대로 명도 16·33·46·58이다. 기본 색과 같고, 등락률 설정에서 손잡이를 옮기면 이 색으로 맞춘다.
const FIXED_RANK_LIGHTNESS = [16, 33, 46, 58]
export function fixedRankColor(side: 'up' | 'down', rank: number): { color: string; colorLabel: string } {
  const lightness = FIXED_RANK_LIGHTNESS[Math.min(Math.max(rank, 0), FIXED_RANK_LIGHTNESS.length - 1)]
  return { color: hslToHex(side === 'up' ? 0 : 217, 75, lightness), colorLabel: side === 'up' ? 'red' : 'blue' }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// RGB 공간에서 두 hex 색을 t(0~1) 비율로 선형보간 — HSL/LAB 같은 고급 색공간은 불필요.
function lerpColor(fromHex: string, toHex: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(fromHex)
  const [r2, g2, b2] = hexToRgb(toHex)
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t)
}

// 저장된 threshold가 하나도 없는 side는 기본 프리셋으로 대체(저장된 데이터를 건드리는 게 아니라
// 순수 조회/렌더 시점 폴백). thresholdPercent 절댓값 오름차순 정렬.
function thresholdsForSign(config: ColorScaleConfig, positive: boolean): ColorScaleThreshold[] {
  const own = config.thresholds.filter(t => (positive ? t.thresholdPercent > 0 : t.thresholdPercent < 0))
  if (own.length > 0) {
    // A draft can briefly contain two rows at the same signed percentage when an edited row is moved
    // onto an existing threshold. Treat the later draft row as the effective value so the map and
    // legend stay one-to-one while the user resolves/applies the edit.
    const uniqueByPercent = new Map<number, ColorScaleThreshold>()
    for (const threshold of own) uniqueByPercent.set(threshold.thresholdPercent, threshold)
    return [...uniqueByPercent.values()].sort((a, b) => Math.abs(a.thresholdPercent) - Math.abs(b.thresholdPercent))
  }
  return positive ? DEFAULT_PLUS_THRESHOLDS : DEFAULT_MINUS_THRESHOLDS
}

function resolveZeroColor(config: ColorScaleConfig): string {
  return config.thresholds.find(t => t.thresholdPercent === 0)?.color ?? DEFAULT_ZERO_COLOR
}

// 큰 등락률(20~25%)에서만 나타나는 포인트 색 — 핫핑크(상승)·청록(하락)이다. 최고 단계 색에서 20%부터 서서히 바뀌어 25%에서 완전히 이 색이 된다.
// 빨강·파랑과 색상 차이가 크고 흰 글자가 그대로 읽힌다(밝은 포인트 색을 쓰면 isLightColor가 글자를 어둡게 바꾼다).
const POINT_START_PERCENT = 20
const POINT_END_PERCENT = 25
const POINT_COLOR_UP = '#ff3d8b'
const POINT_COLOR_DOWN = '#8b5cf6'

// 밝은 배경이면 true — 흰 글자가 읽히지 않으므로 어두운 글자를 쓴다(상대 휘도 0.4 초과).
export function isLightColor(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex).map(value => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4
}

// changeRate(부호 있는 등락률, %) → 실제 렌더링에 쓸 hex 색.
export function resolveTreemapColor(changeRate: number, config: ColorScaleConfig): string {
  const zeroColor = resolveZeroColor(config)
  if (changeRate === 0) return zeroColor

  const thresholds = thresholdsForSign(config, changeRate > 0)

  const abs = Math.abs(changeRate)
  const first = thresholds[0]
  const firstAbs = Math.abs(first.thresholdPercent)
  if (abs <= firstAbs) {
    const t = firstAbs === 0 ? 1 : abs / firstAbs
    return lerpColor(zeroColor, first.color, t)
  }

  for (let i = 0; i < thresholds.length - 1; i++) {
    const lower = thresholds[i]
    const upper = thresholds[i + 1]
    const lowerAbs = Math.abs(lower.thresholdPercent)
    const upperAbs = Math.abs(upper.thresholdPercent)
    if (abs <= upperAbs) {
      const span = upperAbs - lowerAbs
      const t = span === 0 ? 1 : (abs - lowerAbs) / span
      return lerpColor(lower.color, upper.color, t)
    }
  }

  // 가장 큰 threshold보다도 크면 20%까지는 그 색 그대로(clamp)이고, 20~25%에서만 포인트 색(핫핑크/청록)으로 바뀐다.
  const last = thresholds[thresholds.length - 1]
  const start = Math.max(Math.abs(last.thresholdPercent), POINT_START_PERCENT)
  if (abs <= start || start >= POINT_END_PERCENT) return last.color
  const t = Math.min(1, (abs - start) / (POINT_END_PERCENT - start))
  return lerpColor(last.color, changeRate > 0 ? POINT_COLOR_UP : POINT_COLOR_DOWN, t)
}

// changeRate(부호 있는 등락률, %) → 그 부호 쪽 threshold 중 절댓값이 가장 큰 색(보간 없이 고정).
// 지수 헤더/등락률 텍스트처럼 작은 값에도 옅은 그라데이션이 아니라 항상 진하고 읽기 쉬운 색 하나가
// 필요한 자리에 쓴다. resolveTreemapColor와 같은 thresholdsForSign을 거치므로 커스텀/기본 여부는
// 이미 호출자가 넘기는 config(colorScale)에 그대로 반영된다.
export function resolveTreemapExtremeColor(changeRate: number, config: ColorScaleConfig): string {
  if (changeRate === 0) return resolveZeroColor(config)
  const thresholds = thresholdsForSign(config, changeRate > 0)
  return thresholds[thresholds.length - 1].color
}

export interface LegendSwatch {
  label: string
  color: string
}

// 범례 바 — 실제 threshold들(및 0)을 resolveTreemapColor로 샘플링한다. 기본 상태는 박스와
// 같은 fallback을 표시하고, 편집 UI는 새로 비어진 부호의 fallback 슬롯만 숨길 수 있다.
export function resolveLegendSwatches(
  config: ColorScaleConfig,
  options: { includeFallbacksForEmptySides?: boolean | { negative: boolean; positive: boolean } } = {},
): LegendSwatch[] {
  const includeFallbacksForEmptySides = options.includeFallbacksForEmptySides ?? true
  const includeNegativeFallback = typeof includeFallbacksForEmptySides === 'boolean'
    ? includeFallbacksForEmptySides
    : includeFallbacksForEmptySides.negative
  const includePositiveFallback = typeof includeFallbacksForEmptySides === 'boolean'
    ? includeFallbacksForEmptySides
    : includeFallbacksForEmptySides.positive
  const configuredMinusThresholds = config.thresholds.filter(threshold => threshold.thresholdPercent < 0)
  const configuredPlusThresholds = config.thresholds.filter(threshold => threshold.thresholdPercent > 0)
  // 편집 중에는 실제 draft threshold가 없는 부호의 fallback 컬러칸을 범례에서 숨길 수 있다.
  // 종목 색 계산은 계속 thresholdsForSign의 fallback을 쓰므로 이 옵션은 범례 표시에만 영향을 준다.
  const minusThresholds = configuredMinusThresholds.length > 0 || includeNegativeFallback
    ? thresholdsForSign(config, false)
    : []
  const plusThresholds = configuredPlusThresholds.length > 0 || includePositiveFallback
    ? thresholdsForSign(config, true)
    : []
  const zeroColor = resolveZeroColor(config)

  const minusSwatches = [...minusThresholds]
    .sort((a, b) => Math.abs(b.thresholdPercent) - Math.abs(a.thresholdPercent))
    .map(threshold => {
      const abs = Math.abs(threshold.thresholdPercent)
      return { label: `-${abs}%`, color: resolveTreemapColor(-abs, config) }
    })
  const plusSwatches = plusThresholds.map(threshold => {
    const abs = Math.abs(threshold.thresholdPercent)
    return { label: `+${abs}%`, color: resolveTreemapColor(abs, config) }
  })

  return [...minusSwatches, { label: '0%', color: zeroColor }, ...plusSwatches]
}

// ── 어드민 톤 피커 전용 색 변환 유틸 (hue/lightness 슬라이더 ↔ 최종 저장용 hex) ──────────────

export function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// 저장된 임의의 hex(기본 프리셋 포함)를 피커에 처음 띄울 때 hue/lightness 초기 위치를 역산하는 용도.
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r8, g8, b8] = hexToRgb(hex)
  const r = r8 / 255
  const g = g8 / 255
  const b = b8 / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}
