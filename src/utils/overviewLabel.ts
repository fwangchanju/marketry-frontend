// 홈 시장 지도(OverviewMap) 박스 안 글자 — 말줄임표나 잘린 글자를 만들지 않는다.
// 업종명은 한 줄에 들어가면 그대로, 12px로도 안 들어가면 `/`(없으면 공백) 자리에서 두 줄로 나눈다(윗줄 `음식료`, 아랫줄 `/담배`처럼 슬래시는 아랫줄 앞에 둔다).
// 두 줄로도 안 들어가거나 높이가 모자라면 이름과 등락률을 모두 그리지 않는다. 이름과 등락률 중 하나만 들어가야 하면 이름이 먼저다.
// 등락률은 이름의 90% 크기(최소 12px)이고 폭에 안 들어가면 그리지 않는다. 글자 폭은 canvas로 재서(글꼴이 늦게 로드되면 다시) 판단한다.
export const MIN_NAME_SIZE = 12
export const RATE_SCALE = 0.9
const LINE_HEIGHT = 1.25
// 박스 안쪽 여백(p-0.5 = 2px씩)과 이름 양옆 여유.
const PADDING_X = 8
const PADDING_Y = 4
const FONT_FAMILY = 'Pretendard, "Noto Sans KR", system-ui, sans-serif'

export interface OverviewLabel {
  lines: string[]
  nameSize: number
  rateSize: number | null
}

let ctx: CanvasRenderingContext2D | null | undefined
const widthCache = new Map<string, number>()
let cacheVersion = 0

// 100px 기준 글자 폭(이름은 font-medium 500, 등락률은 400) — 크기에 비례해 쓴다. 글꼴이 로드돼 version이 바뀌면 비운다.
function width100(text: string, weight: 400 | 500, version: number): number {
  if (version !== cacheVersion) {
    widthCache.clear()
    cacheVersion = version
  }
  const key = `${weight}|${text}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached
  if (ctx === undefined) ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  let value: number
  if (ctx) {
    ctx.font = `${weight} 100px ${FONT_FAMILY}`
    value = ctx.measureText(text).width
  } else {
    value = Array.from(text).reduce((sum, ch) => sum + (ch.charCodeAt(0) < 128 ? 60 : 100), 0)
  }
  widthCache.set(key, value)
  return value
}

// 박스 크기(가로·세로의 기하평균)에 맞춰 정하는 글자 크기 — 작은 박스는 12px, 큰 박스일수록 커진다(가장 큰 박스는 약 28px).
function sizeByBox(width: number, height: number): number {
  const span = Math.sqrt(width * height)
  return Math.round(12 + 16 * Math.sqrt(Math.min(Math.max((span - 70) / 294, 0), 1)))
}

// 두 줄로 나눌 자리 — 슬래시가 있으면 슬래시 앞(슬래시는 아랫줄에 둔다), 없으면 가운데에 가장 가까운 공백(공백은 버린다).
function splitName(name: string): [string, string] | null {
  const slash = name.indexOf('/')
  if (slash > 0) return [name.slice(0, slash), name.slice(slash)]
  const spaces = Array.from(name).flatMap((ch, i) => (ch === ' ' ? [i] : []))
  if (spaces.length === 0) return null
  const middle = name.length / 2
  const at = spaces.reduce((best, i) => (Math.abs(i - middle) < Math.abs(best - middle) ? i : best))
  return [name.slice(0, at).trim(), name.slice(at + 1).trim()]
}

const HIDDEN: OverviewLabel = { lines: [], nameSize: MIN_NAME_SIZE, rateSize: null }

export function layoutOverviewLabel(name: string, rateText: string, width: number, height: number, fontsVersion: number): OverviewLabel {
  const innerWidth = width - PADDING_X
  const innerHeight = height - PADDING_Y
  const bySize = sizeByBox(width, height)
  const nameWidth = (text: string, size: number) => width100(text, 500, fontsVersion) * size / 100
  // 등락률: 이름 크기의 90%(최소 12px)를 쓰되 폭에 안 들어가면 12px까지 줄이고, 그래도 안 되면 뺀다.
  const rateSizeFor = (nameSize: number): number | null => {
    const wanted = Math.max(MIN_NAME_SIZE, Math.round(nameSize * RATE_SCALE))
    const fitting = (width - PADDING_X) * 100 / width100(rateText, 400, fontsVersion)
    const size = Math.min(wanted, Math.floor(fitting))
    return size >= MIN_NAME_SIZE ? size : null
  }
  const build = (lines: string[], size: number): OverviewLabel | null => {
    const nameHeight = lines.length * size * LINE_HEIGHT
    if (nameHeight > innerHeight) return null
    const rate = rateSizeFor(size)
    const withRate = rate !== null && nameHeight + rate * LINE_HEIGHT <= innerHeight
    return { lines, nameSize: size, rateSize: withRate ? rate : null }
  }
  // 1) 한 줄: 박스에 맞는 큰 크기부터 12px까지 줄여 가며 폭에 들어가는 가장 큰 크기를 쓴다.
  for (let size = bySize; size >= MIN_NAME_SIZE; size -= 1) {
    if (nameWidth(name, size) <= innerWidth) {
      const fit = build([name], size)
      if (fit) return fit
      break
    }
  }
  // 2) 두 줄: 나눌 자리가 있으면 같은 방식으로 폭에 들어가는 가장 큰 크기를 찾는다.
  const parts = splitName(name)
  if (parts) {
    for (let size = bySize; size >= MIN_NAME_SIZE; size -= 1) {
      if (Math.max(nameWidth(parts[0], size), nameWidth(parts[1], size)) <= innerWidth) {
        const fit = build([...parts], size)
        if (fit) return fit
        break
      }
    }
  }
  // 3) 두 줄로도 안 들어가면 이름과 등락률을 모두 그리지 않는다.
  return HIDDEN
}
