// 홈 시장 지도(OverviewMap) 박스 안 글자 — 말줄임표나 잘린 글자를 만들지 않는다.
// 업종명은 한 줄이 박스 폭에 맞지 않을 때만 두 줄로 나눈다. `/`는 아랫줄 맨 앞, 공백은 가운데에 가까운 곳에 두고, 업종 용어 `소비재`는 앞 단어와 분리한다. 단어 경계가 없어서 칸에 안 들어가는 이름은, 글자가 사라지는 것보다 낫도록 호출하는 쪽이 `splitInsideWord`를 켜면 이름 가운데에서 두 줄로 나눈다(홈 업종 지도와 폰 지도가 켠다).
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

// 단어 경계가 없는 이름을 가운데에서 나눈다(앞줄이 같거나 한 글자 더 길다). 세 글자 이하는 나누지 않는다.
function splitMiddle(name: string): [string, string] | null {
  const chars = Array.from(name)
  if (chars.length < 4) return null
  const at = Math.ceil(chars.length / 2)
  return [chars.slice(0, at).join(''), chars.slice(at).join('')]
}

// 두 줄로 나눌 자리 — 정해 둔 MARKETRY 업종명이면 그 자리, 슬래시가 있으면 슬래시 앞(슬래시는 아랫줄 맨 앞), 없으면 가운데에 가까운 공백(공백은 버린다). 소비재는 해당 업종 용어 경계에서 나눈다.
// MARKETRY 업종명 중 정해 둔 나누는 자리 — 이름이 바뀌어 여기에 없으면 아래 일반 규칙(슬래시 > 공백 > 소비재 > 이름 가운데)으로 나눈다.
// 사용자가 직접 지은 이름은 이 표에 없으므로 일반 규칙을 쓰고, 이름에 공백이나 `/`를 넣으면 그 자리에서 나뉜다.
const KNOWN_SPLITS: Record<string, [string, string]> = {
  에너지화학: ['에너지', '화학'],
  임의소비재: ['임의', '소비재'],
  필수소비재: ['필수', '소비재'],
  소프트웨어: ['소프트', '웨어'],
}

function splitName(name: string): [string, string] | null {
  const known = KNOWN_SPLITS[name]
  if (known) return known
  const slash = name.indexOf('/')
  if (slash > 0) return [name.slice(0, slash), name.slice(slash)]
  const chars = Array.from(name)
  const spaces = chars.flatMap((ch, i) => (ch === ' ' ? [i] : []))
  if (spaces.length > 0) {
    const middle = chars.length / 2
    const at = spaces.reduce((best, i) => (Math.abs(i - middle) < Math.abs(best - middle) ? i : best))
    return [chars.slice(0, at).join('').trim(), chars.slice(at + 1).join('').trim()]
  }
  const consumerSuffix = '소비재'
  if (name.endsWith(consumerSuffix) && Array.from(name.slice(0, -consumerSuffix.length)).length >= 2) {
    return [name.slice(0, -consumerSuffix.length), consumerSuffix]
  }
  return null
}

const HIDDEN: OverviewLabel = { lines: [], nameSize: MIN_NAME_SIZE, rateSize: null }

// 화면별 옵션 — 종목명처럼 공백이 없는 이름도 두 줄로 나눠야 하는 화면(폰 주식 지도)은 이름 중간에서 나누게 한다.
export interface OverviewLabelOptions {
  splitInsideWord?: boolean
}

export function layoutOverviewLabel(name: string, rateText: string, width: number, height: number, fontsVersion: number, options: OverviewLabelOptions = {}): OverviewLabel {
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
  // 1) 먼저 한 줄로 맞춘다. 박스 폭이 좁아 최소 글자 크기에도 안 들어갈 때만 단어 경계에서 줄을 나눈다.
  for (let size = bySize; size >= MIN_NAME_SIZE; size -= 1) {
    if (nameWidth(name, size) <= innerWidth) {
      const fit = build([name], size)
      if (fit) return fit
      break
    }
  }
  // 2) 두 줄: `/`, 공백, 알려진 업종 용어 경계에서만 나눈다.
  const parts = splitName(name) ?? (options.splitInsideWord ? splitMiddle(name) : null)
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
