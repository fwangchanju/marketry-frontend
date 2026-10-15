// 종목 박스 안 글자를 박스 크기에 맞춘다. 말줄임표나 잘린 글자는 만들지 않는다.
// 이름은 한 줄에 들어가면 그대로 두고, 안 들어가면 두 줄로 나눠(균형 있게) 보여 준다. 두 줄로도 안 들어가면 글자를 MIN_FONT(10px)까지 줄이고,
// 그래도 안 되면 이름을 감추고 등락률만 보여 준다. 등락률도 폭에 안 들어가면 MIN_FONT까지 줄이고 그래도 안 되면 아무것도 그리지 않는다.
import { useSyncExternalStore } from 'react'

export const MIN_FONT = 10
export const LABEL_LINE_HEIGHT = 1.25
export const RATE_FONT_SCALE = 0.85
// 이름 양옆 여백(px-1 = 4px씩)과 테두리(1px씩), 등락률 쪽은 테두리와 여유 1px씩.
const NAME_SIDE = 10
const RATE_SIDE = 4
const FONT_FAMILY = 'Pretendard, "Noto Sans KR", system-ui, sans-serif'

let ctx: CanvasRenderingContext2D | null | undefined
// 100px 기준 글자 폭 — 크기는 선형으로 늘리고 줄인다. 글꼴이 로드되면 비운다.
const widthCache = new Map<string, number>()
let fontsVersion = 0
const listeners = new Set<() => void>()
let fontsHooked = false

function hookFonts() {
  if (fontsHooked || typeof document === 'undefined' || !document.fonts) return
  fontsHooked = true
  document.fonts.addEventListener('loadingdone', () => {
    widthCache.clear()
    fontsVersion += 1
    listeners.forEach(listener => listener())
  })
}

function subscribe(listener: () => void) {
  hookFonts()
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// 글꼴이 늦게 로드돼 글자 폭이 달라질 때 박스가 다시 계산되도록 하는 값.
export function useFontsVersion(): number {
  return useSyncExternalStore(subscribe, () => fontsVersion, () => 0)
}

function width100(text: string): number {
  const cached = widthCache.get(text)
  if (cached !== undefined) return cached
  if (ctx === undefined) {
    ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    if (ctx) ctx.font = `400 100px ${FONT_FAMILY}`
  }
  let value: number
  if (ctx) {
    value = ctx.measureText(text).width
  } else {
    // 캔버스를 못 쓰면 영문·숫자 0.6em, 그 밖에는 1em으로 어림한다.
    value = Array.from(text).reduce((sum, ch) => sum + (ch.charCodeAt(0) < 128 ? 60 : 100), 0)
  }
  widthCache.set(text, value)
  return value
}

function textWidth(text: string, size: number): number {
  return width100(text) * size / 100
}

// 이름 앞에 오는 그룹사·브랜드 이름 — 이 뒤에서 줄을 나눈다(한화/비전, 삼성/전기, 롯데/쇼핑). 영문 접두어가 앞에 붙은 이름(HD현대/건설기계)도 맞춘다.
const GROUP_PREFIXES = [
  '삼성', '현대', '롯데', '한화', '두산', '포스코', '한진', '효성', '코오롱', '신세계', '대한', '대우', '한솔', '동국', '동원', '동양', '세아', '금호',
  '카카오', '에코프로', '미래에셋', '키움', '유진', '대신', '교보', '메리츠', '하나', '신한', '우리', '한국', '부국', '한양', '아모레', '이수', '서울', '한미', '삼양', '삼천리', '태광',
  '아시아나', '제주', '쌍용', '한라', '녹십자', '영원', '대웅', '일진', '가온', '한온', '한전', '고려', '보령', '일동', '동서', '종근당', '하림',
]
const isAsciiChar = (ch: string) => /[\x21-\x7E]/.test(ch)

function groupSplitPositions(chars: string[]): number[] {
  let lead = 0
  while (lead < chars.length && isAsciiChar(chars[lead])) lead += 1
  const rest = chars.slice(lead).join('')
  const positions: number[] = []
  for (const prefix of GROUP_PREFIXES) {
    const length = Array.from(prefix).length
    if (rest.startsWith(prefix) && Array.from(rest).length > length) positions.push(lead + length)
  }
  return positions
}

// 이름 뒤에 붙는 우선주·지주사 접미어 앞에서 줄을 나눈다(삼성전자/우, 현대차/2우B, 신한/지주, 한화/홀딩스). 앞부분이 2글자 이상일 때만 접미어로 본다.
function suffixSplitPosition(chars: string[]): number | null {
  const name = chars.join('')
  const match = name.match(/(홀딩스|홀딩|지주회사|지주|\d?우[A-C]?)$/)
  if (!match) return null
  const position = Array.from(name.slice(0, name.length - match[0].length)).length
  return position >= 2 ? position : null
}

// 두 줄로 나눌 자리를 고른다. 순서는 (1) 공백 (2) 영문·숫자·기호와 한글의 경계(LG/이노텍, BNK/금융)와 그룹명 뒤(한화/비전) 중 균형이 좋은 자리 (3) 긴 줄이 가장 짧아지는 자리.
// 폭이 같으면 윗줄이 더 긴 쪽을 고른다(테크/윙). 영문·숫자·기호 한 덩어리(E1, OCI, F&F) 안에서는 줄을 나누지 않는다. 앞 단계 자리가 폭에 안 들어가면 다음 단계로 넘어간다.
function splitTwoLines(name: string, size: number, avail: number, mode: 'suffix' | 'semantic' | 'any'): [string, string] | null {
  const chars = Array.from(name)
  const bestSplit = (positions: number[]): { lines: [string, string]; max: number } | null => {
    let best: { lines: [string, string]; max: number } | null = null
    for (const i of positions) {
      const left = chars.slice(0, i).join('').trim()
      const right = chars.slice(i).join('').trim()
      if (!left || !right) continue
      const max = Math.max(textWidth(left, size), textWidth(right, size))
      if (!best || max <= best.max) best = { lines: [left, right], max }
    }
    return best
  }
  const isWord = isAsciiChar
  const all = Array.from({ length: Math.max(0, chars.length - 1) }, (_, k) => k + 1).filter(i => !(isWord(chars[i - 1]) && isWord(chars[i])))
  const atSpaces = all.filter(i => chars[i] === ' ' || chars[i - 1] === ' ')
  const atScriptEdge = all.filter(i => chars[i] !== ' ' && chars[i - 1] !== ' ' && isWord(chars[i - 1]) !== isWord(chars[i]))
  const atMeaning = Array.from(new Set([...atScriptEdge, ...groupSplitPositions(chars).filter(i => all.includes(i))])).sort((a, b) => a - b)
  const suffixAt = suffixSplitPosition(chars)
  const atSuffix = suffixAt !== null && all.includes(suffixAt) ? [suffixAt] : []
  const stages = mode === 'suffix' ? [atSpaces, atSuffix] : mode === 'semantic' ? [atSpaces, atSuffix, atMeaning] : [atSpaces, atSuffix, atMeaning, all]
  for (const positions of stages) {
    const found = bestSplit(positions)
    if (found && found.max <= avail) return found.lines
  }
  return null
}

// 공백, 영문·한글 경계, 그룹명 뒤처럼 뜻이 갈리는 자리가 있는 이름인지(DB손해보험, LG이노텍, 한화비전).
function hasSemanticSplit(name: string): boolean {
  const chars = Array.from(name)
  if (groupSplitPositions(chars).length > 0) return true
  return chars.some((ch, i) => i > 0 && (ch === ' ' || chars[i - 1] === ' ' || isAsciiChar(ch) !== isAsciiChar(chars[i - 1])))
}

export interface StockLabelFit {
  nameLines: string[] | null
  nameSize: number
  rateSize: number | null
}

export function fitStockLabel({
  name,
  rateText,
  width,
  height,
  baseFont,
  wantName,
  wantRate,
}: {
  name: string
  rateText: string
  width: number
  height: number
  baseFont: number
  wantName: boolean
  wantRate: boolean
}): StockLabelFit {
  const innerHeight = height - 2
  const nameAvail = width - NAME_SIDE
  const rateAvail = width - RATE_SIDE
  // 등락률 글자 크기: 이름 크기에 비례하되 MIN_FONT 아래로는 안 내리고, 폭에 안 들어가면 MIN_FONT까지 줄인다. 그래도 안 들어가면 null.
  const rateSizeFor = (nameSize: number): number | null => {
    const wanted = Math.max(MIN_FONT, nameSize * RATE_FONT_SCALE)
    const fitting = rateAvail * 100 / width100(rateText)
    const size = Math.min(wanted, fitting)
    return size >= MIN_FONT ? size : null
  }
  const none: StockLabelFit = { nameLines: null, nameSize: baseFont, rateSize: null }
  if (wantName) {
    // 접미어(우선주 우·지주·홀딩스)가 있으면 그 앞에서, 뜻이 갈리는 자리(공백, 영문·한글 경계, 그룹명 뒤)가 있으면 그 자리에서 글자를 줄여서라도 나눈다. 그래도 안 되면 아무 자리에서나 나눈다.
    const chars = Array.from(name)
    const passes: Array<'suffix' | 'semantic' | 'any'> = suffixSplitPosition(chars) !== null ? ['suffix', 'semantic', 'any'] : hasSemanticSplit(name) ? ['semantic', 'any'] : ['any']
    for (const mode of passes) {
      for (let size = baseFont; size >= MIN_FONT; size -= 0.5) {
        const rate = wantRate ? rateSizeFor(size) : null
        const rateHeight = rate ? rate * LABEL_LINE_HEIGHT : 0
        if (LABEL_LINE_HEIGHT * size + rateHeight <= innerHeight && textWidth(name, size) <= nameAvail) {
          return { nameLines: [name], nameSize: size, rateSize: rate }
        }
        if (2 * LABEL_LINE_HEIGHT * size + rateHeight <= innerHeight) {
          const lines = splitTwoLines(name, size, nameAvail, mode)
          if (lines) return { nameLines: lines, nameSize: size, rateSize: rate }
        }
      }
    }
  }
  // 이름이 안 들어가거나 등락률만 고른 경우 — 등락률만 보여 준다(이름만 고른 경우는 아무것도 그리지 않는다).
  if (!wantRate) return none
  const rate = rateSizeFor(baseFont)
  if (rate && rate * LABEL_LINE_HEIGHT <= innerHeight) return { nameLines: null, nameSize: baseFont, rateSize: rate }
  return none
}
