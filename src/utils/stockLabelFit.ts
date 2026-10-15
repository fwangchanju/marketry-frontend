// 종목 박스 안 글자를 박스 크기에 맞춘다. 말줄임표나 잘린 글자는 만들지 않는다.
// 이름은 한 줄에 들어가면 그대로 두고, 안 들어가면 두 줄로 나눠(균형 있게) 보여 준다. 두 줄로도 안 들어가면 글자를 MIN_FONT까지 줄이고,
// 그래도 안 되면 이름을 감추고 등락률만 보여 준다. 등락률도 폭에 안 들어가면 MIN_FONT까지 줄이고 그래도 안 되면 아무것도 그리지 않는다.
import { useSyncExternalStore } from 'react'

export const MIN_FONT = 9
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

// 두 줄로 나눌 때 긴 줄이 가장 짧아지는 자리에서 자른다. 공백이 있으면 공백에서 먼저 나눠 본다.
function splitTwoLines(name: string, size: number, avail: number): [string, string] | null {
  const chars = Array.from(name)
  const bestSplit = (positions: number[]): { lines: [string, string]; max: number } | null => {
    let best: { lines: [string, string]; max: number } | null = null
    for (const i of positions) {
      const left = chars.slice(0, i).join('').trim()
      const right = chars.slice(i).join('').trim()
      if (!left || !right) continue
      const max = Math.max(textWidth(left, size), textWidth(right, size))
      if (!best || max < best.max) best = { lines: [left, right], max }
    }
    return best
  }
  // 영문·숫자·기호 한 덩어리(E1, OCI, F&F 등) 안에서는 줄을 나누지 않는다.
  const isWord = (ch: string) => /[\x21-\x7E]/.test(ch)
  const all = Array.from({ length: Math.max(0, chars.length - 1) }, (_, k) => k + 1).filter(i => !(isWord(chars[i - 1]) && isWord(chars[i])))
  const atSpaces = all.filter(i => chars[i] === ' ' || chars[i - 1] === ' ')
  const bySpace = bestSplit(atSpaces)
  if (bySpace && bySpace.max <= avail) return bySpace.lines
  const any = bestSplit(all)
  return any && any.max <= avail ? any.lines : null
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
    for (let size = baseFont; size >= MIN_FONT; size -= 0.5) {
      const rate = wantRate ? rateSizeFor(size) : null
      const rateHeight = rate ? rate * LABEL_LINE_HEIGHT : 0
      if (LABEL_LINE_HEIGHT * size + rateHeight <= innerHeight && textWidth(name, size) <= nameAvail) {
        return { nameLines: [name], nameSize: size, rateSize: rate }
      }
      if (2 * LABEL_LINE_HEIGHT * size + rateHeight <= innerHeight) {
        const lines = splitTwoLines(name, size, nameAvail)
        if (lines) return { nameLines: lines, nameSize: size, rateSize: rate }
      }
    }
  }
  // 이름이 안 들어가거나 등락률만 고른 경우 — 등락률만 보여 준다(이름만 고른 경우는 아무것도 그리지 않는다).
  if (!wantRate) return none
  const rate = rateSizeFor(baseFont)
  if (rate && rate * LABEL_LINE_HEIGHT <= innerHeight) return { nameLines: null, nameSize: baseFont, rateSize: rate }
  return none
}
