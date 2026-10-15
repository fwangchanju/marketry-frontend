// 홈 시장 지도(OverviewMap) 박스 안 글자 — 업종명이 한 줄에 안 들어가면 `/`(없으면 공백) 자리에서 두 줄로 나누고, 등락률은 이름의 90% 크기로 쓴다.
// 두 줄은 윗줄 "음식료", 아랫줄 "/담배"처럼 슬래시를 아랫줄 앞에 둔다. 이름은 숨기지 않는다(두 줄도 안 들어가는 아주 작은 박스는 한 줄 그대로 가장자리에서 잘린다).
export const MIN_NAME_SIZE = 12
export const RATE_SCALE = 0.9
const LINE_HEIGHT = 1.25
// 박스 안쪽 여백(p-0.5 = 2px씩)과 이름 양옆 여유.
const PADDING_X = 8
const PADDING_Y = 4

export interface OverviewLabel {
  lines: string[]
  nameSize: number
  rateSize: number | null
}

// 박스 크기(가로·세로의 기하평균)에 맞춰 정하는 글자 크기 — 작은 박스는 12px, 큰 박스일수록 커진다(가장 큰 박스는 약 28px).
function sizeByBox(width: number, height: number): number {
  const span = Math.sqrt(width * height)
  return Math.round(12 + 16 * Math.sqrt(Math.min(Math.max((span - 70) / 294, 0), 1)))
}

const rateSizeFor = (nameSize: number) => Math.max(MIN_NAME_SIZE, Math.round(nameSize * RATE_SCALE))

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

export function layoutOverviewLabel(name: string, width: number, height: number, showRateWanted: boolean): OverviewLabel {
  const bySize = sizeByBox(width, height)
  const innerWidth = width - PADDING_X
  const oneLineSize = Math.max(MIN_NAME_SIZE, Math.min(bySize, Math.floor(innerWidth / Math.max(name.length, 1))))
  const oneLine: OverviewLabel = { lines: [name], nameSize: oneLineSize, rateSize: showRateWanted ? rateSizeFor(oneLineSize) : null }
  // 12px로 한 줄에 들어가면 나누지 않는다(지금까지와 같다).
  if (innerWidth / Math.max(name.length, 1) >= MIN_NAME_SIZE) return oneLine
  const parts = splitName(name)
  if (!parts) return oneLine
  const longest = Math.max(parts[0].length, parts[1].length)
  const size = Math.max(MIN_NAME_SIZE, Math.min(bySize, Math.floor(innerWidth / longest)))
  const innerHeight = height - PADDING_Y
  const twoLinesHeight = 2 * size * LINE_HEIGHT
  if (twoLinesHeight > innerHeight) return oneLine
  // 두 줄 + 등락률이 안 들어가면 등락률을 뺀다(이름 먼저).
  const rate = showRateWanted ? rateSizeFor(size) : null
  const withRate = rate !== null && twoLinesHeight + rate * LINE_HEIGHT <= innerHeight
  return { lines: [...parts], nameSize: size, rateSize: withRate ? rate : null }
}
