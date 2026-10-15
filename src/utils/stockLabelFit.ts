// 종목 박스 안 글자를 박스 크기에 맞춘다. 말줄임표나 잘린 글자는 만들지 않는다.
// 이름은 한 줄에 들어가면 그대로 두고, 안 들어가면 두 줄로 나눠(균형 있게) 보여 준다. 두 줄로도 안 들어가면 글자를 MIN_FONT(10px)까지 줄이고,
// 그래도 안 되면 이름과 등락률 모두 그리지 않는다(등락률만 남기지 않는다). 설정에서 등락률만 고른 경우에만 등락률만 보여 주고, 폭에 안 들어가면 MIN_FONT까지 줄이다 안 되면 그리지 않는다.
import { useSyncExternalStore } from 'react'

export const MIN_FONT = 10
// 이름이 한 줄에 들어가면 나누지 않는다 — 한 줄에 맞추려고 글자를 줄일 수 있는 한계. 이보다 더 줄여야 하면 두 줄로 나눈다.
export const ONE_LINE_MIN_FONT = 11
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
  '아시아나', '파마', '서진', '셀트리온', '경동', '비에이치', '제주', '쌍용', '한라', '녹십자', '영원', '대웅', '일진', '가온', '한온', '한전', '고려', '보령', '일동', '동서', '종근당', '하림',
  '주성', '동진', '해성', '원익', '파크', '리노', '티씨', '케이씨', '피에스케이', '이오',
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

// 알파벳을 한글로 읽어 쓴 사명(비에이치=BH, 케이씨=KC, 엔씨=NC)의 글자 이름. 이름 앞쪽에 이런 글자가 2개 이상 이어지면 한 묶음으로 보고 묶음 가운데는 나누지 않는다.
const LETTER_NAMES = [
  '더블유', '에이치', '에이', '에프', '에스', '제이', '케이', '아이', '제트', '엑스', '와이', '브이', '아르',
  '엘', '엠', '엔', '비', '씨', '디', '이', '지', '피', '티', '유', '큐', '알', '오',
].sort((a, b) => b.length - a.length)

// 이름 맨 앞에서부터 한글 알파벳 이름이 이어지는 만큼 읽어, 각 글자가 끝나는 자리(글자 수)를 돌려준다. 글자가 2개 미만이면 null이다(이스케, 에이스침대 같은 일반 이름을 건드리지 않으려는 것).
function letterClusterBoundaries(chars: string[]): number[] | null {
  const name = chars.join('')
  const boundaries: number[] = []
  let at = 0
  while (at < name.length) {
    const letter = LETTER_NAMES.find(candidate => name.startsWith(candidate, at))
    if (!letter) break
    at += letter.length
    boundaries.push(Array.from(name.slice(0, at)).length)
  }
  return boundaries.length >= 2 ? boundaries : null
}

// 이름 뒤에 붙는 우선주 표시·지주사 접미어 앞에서 줄을 나눈다(현대차/2우B, 삼성물산/우B, 신한/지주, 한화/홀딩스). 우선주는 표시가 분명한 1우B·2우B·우B만 보고, 맨 끝이 그냥 '우'인 이름(삼성전자우)은 떼지 않는다. 앞부분이 2글자 이상일 때만 접미어로 본다.
function suffixSplitPosition(chars: string[]): number | null {
  const name = chars.join('')
  const match = name.match(/(홀딩스|홀딩|지주회사|지주|\d우[A-C]?|우[A-C])$/)
  if (!match) return null
  const position = Array.from(name.slice(0, name.length - match[0].length)).length
  return position >= 2 ? position : null
}

// 공백이나 그룹명 뒤에서 나눴을 때 두 줄의 글자 수 차이가 이만큼 이하면 그 자리를 쓴다. 차이가 더 크면 균형 있게 나눈다(롯데에너지/머티리얼즈).
// 우선주·지주사 접미어(삼성전자/우, 신한/지주)는 글자 수 차이와 상관없이 접미어 앞에서 나눈다.
const MAX_WORD_SPLIT_DIFF = 3

// 두 줄로 나눌 자리 후보. 영문·숫자·기호 한 덩어리(E1, OCI, F&F) 안에서는 나누지 않는다.
// atSpaces: 공백. atMeaning: 영문·한글 경계(영어/한글, 한글/영어: LG/이노텍, BNK/금융)와 그룹명 뒤(한화/비전). 공백과 그룹명 뒤는 두 줄의 글자 수 차이가 MAX_WORD_SPLIT_DIFF 이하인 자리만 두고, 영문·한글 경계는 차이와 상관없이 둔다.
// atSuffix: 우선주·지주사 접미어 앞. all: 아무 자리.
function splitCandidates(chars: string[]) {
  const cluster = letterClusterBoundaries(chars)
  const clusterEnd = cluster ? cluster[cluster.length - 1] : 0
  // 영문·숫자·기호 덩어리 안과 한글 알파벳 이름 한 글자(에이치, 케이 등) 안에서는 나누지 않는다.
  const all = Array.from({ length: Math.max(0, chars.length - 1) }, (_, k) => k + 1)
    .filter(i => !(isAsciiChar(chars[i - 1]) && isAsciiChar(chars[i])))
    .filter(i => !(cluster && i < clusterEnd && !cluster.includes(i)))
  const lengthDiff = (i: number) => Math.abs(
    Array.from(chars.slice(0, i).join('').trim()).length - Array.from(chars.slice(i).join('').trim()).length,
  )
  const closeEnough = (positions: number[]) => positions.filter(i => lengthDiff(i) <= MAX_WORD_SPLIT_DIFF)
  const atSpaces = closeEnough(all.filter(i => chars[i] === ' ' || chars[i - 1] === ' '))
  const atScriptEdge = all.filter(i => chars[i] !== ' ' && chars[i - 1] !== ' ' && isAsciiChar(chars[i - 1]) !== isAsciiChar(chars[i]))
  // 한글 알파벳 묶음 끝(케이씨/텍, 엔씨/소프트)도 그룹명 뒤처럼 글자 수 차이가 3 이하일 때 쓴다.
  const clusterSplit = cluster && clusterEnd < chars.length ? [clusterEnd] : []
  const atMeaning = Array.from(new Set([...atScriptEdge, ...closeEnough([...groupSplitPositions(chars), ...clusterSplit].filter(i => all.includes(i)))])).sort((a, b) => a - b)
  const suffixAt = suffixSplitPosition(chars)
  const atSuffix = suffixAt !== null && all.includes(suffixAt) ? [suffixAt] : []
  return { all, atSpaces, atMeaning, atSuffix }
}

// 두 줄로 나눌 자리를 고른다. 순서는 (1) 공백 (2) 접미어(우·지주·홀딩스) (3) 영문·한글 경계와 그룹명 뒤 (4) 긴 줄이 가장 짧아지는 아무 자리.
// 폭이 같으면 윗줄이 더 긴 쪽을 고른다(테크/윙). 앞 단계 자리가 폭에 안 들어가면 다음 단계로 넘어간다.
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
  const { all, atSpaces, atMeaning, atSuffix } = splitCandidates(chars)
  const stages = mode === 'suffix' ? [atSpaces, atSuffix] : mode === 'semantic' ? [atSpaces, atSuffix, atMeaning] : [atSpaces, atSuffix, atMeaning, all]
  for (const positions of stages) {
    const found = bestSplit(positions)
    if (found && found.max <= avail) return found.lines
  }
  return null
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
    const { atSpaces, atMeaning, atSuffix } = splitCandidates(Array.from(name))
    const passes: Array<'suffix' | 'semantic' | 'any'> = atSuffix.length > 0 ? ['suffix', 'semantic', 'any'] : atSpaces.length + atMeaning.length > 0 ? ['semantic', 'any'] : ['any']
    const searchName = (withRate: boolean): StockLabelFit | null => {
      // 먼저 한 줄에 맞춰 본다 — 글자를 ONE_LINE_MIN_FONT까지 줄여서라도 한 줄에 들어가면 나누지 않는다.
      for (let size = baseFont; size >= Math.min(baseFont, ONE_LINE_MIN_FONT); size -= 0.5) {
        const rate = withRate ? rateSizeFor(size) : null
        const rateHeight = rate ? rate * LABEL_LINE_HEIGHT : 0
        if (LABEL_LINE_HEIGHT * size + rateHeight <= innerHeight && textWidth(name, size) <= nameAvail) {
          return { nameLines: [name], nameSize: size, rateSize: rate }
        }
      }
      for (const mode of passes) {
        for (let size = baseFont; size >= MIN_FONT; size -= 0.5) {
          const rate = withRate ? rateSizeFor(size) : null
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
      return null
    }
    // 종목명과 등락률 중 하나만 들어가면 종목명이 먼저다 — 둘이 함께 안 들어가면 등락률을 빼고 이름만 보여 준다.
    const found = (wantRate ? searchName(true) : null) ?? searchName(false)
    if (found) return found
  }
  // 설정에서 등락률만 고른 경우에만 등락률만 보여 준다. 이름을 보여 주려 했는데 안 들어간 경우에는 등락률만 남기지 않고 아무것도 그리지 않는다.
  if (!wantRate || wantName) return none
  const rate = rateSizeFor(baseFont)
  if (rate && rate * LABEL_LINE_HEIGHT <= innerHeight) return { nameLines: null, nameSize: baseFont, rateSize: rate }
  return none
}
