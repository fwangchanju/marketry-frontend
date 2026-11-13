// 커스텀 종목 표 열 폭 — MARKETRY·거래소·내 분류 세 종목 표가 같은 열 순서와 폭을 쓰도록 한곳에 둔다.
// 열 순서(체크박스 다음): 종목코드, 종목명, 약칭, 시가총액, 규모, 마켓, NXT, 거래소 분류, 대분류, 중분류, 소분류.
//
// 글자 폭이 정해진 열은 px로 고정하고(머리글의 정렬·필터 아이콘 자리까지 포함), 글자가 길어질 수 있는 열(종목명·약칭·거래소 분류·
// 대/중/소분류)은 남는 폭을 같게 나눠 갖는다(표를 table-fixed로 두고 폭을 안 준 열이 나눠 갖는다).
export type StockColumnKey =
  | 'stockCode'
  | 'stockName'
  | 'alias'
  | 'totalMarketValue'
  | 'totalMarketValueKrw'
  | 'sizeTier'
  | 'market'
  | 'nxt'
  | 'industry'
  | 'parentSector'
  | 'midSector'
  | 'subSector'
  | 'overseasSubSector'

// 맨 왼쪽 체크박스 칸 폭(px).
export const STOCK_CHECKBOX_COLUMN_PX = 30

// 고정 폭 열(px) — 머리글 글자와 본문 글자 중 넓은 쪽에 양쪽 여백 6px씩을 더한 빠듯한 값이다(정렬 화살표는 글자 위아래에 있어 폭을 안 쓴다).
// 규모·마켓·NXT는 머리글 글자 오른쪽에 들어갈 필터 아이콘 자리(아이콘 14px + 간격 4px)를 미리 더해 두었다.
// 종목코드·시가총액은 필터 아이콘이 없다(종목코드는 검색창으로 찾고, 시가총액은 규모 필터가 대신한다).
const FIXED_COLUMN_PX: Partial<Record<StockColumnKey, number>> = {
  stockCode: 70,
  totalMarketValue: 100,
  totalMarketValueKrw: 100,
  sizeTier: 70,
  market: 70,
  nxt: 70,
}

// 남는 폭을 나눠 갖는 열의 최소 폭 — 이보다 좁아지면 표가 더 줄지 않고 옆으로 스크롤한다.
export const FLEX_COLUMN_MIN_PX = 110

export const stockColumnFixedPx = (key: StockColumnKey): number | undefined => FIXED_COLUMN_PX[key]

// 표 전체의 최소 폭 — 보이는 열로 계산한다.
export const stockTableMinWidthPx = (keys: readonly StockColumnKey[], widths?: Partial<Record<StockColumnKey, number>>): number =>
  STOCK_CHECKBOX_COLUMN_PX + keys.reduce((sum, key) => sum + (widths?.[key] ?? FIXED_COLUMN_PX[key] ?? FLEX_COLUMN_MIN_PX), 0)

// 표 머리글 줄 높이(px) — 본문 한 줄(29px)의 두 배다. 글자 위아래 화살표와 글자 사이에 숨 쉴 간격을 둔다.
export const STOCK_HEADER_ROW_PX = 58

// 국내 종목 표의 칸 폭 계산 — 표가 들어가는 영역의 너비로 모든 칸의 폭(=왼쪽 경계 x 좌표)을 한 번에 정한다.
// 고정 폭 열은 그대로 두고, 종목명(130)·약칭(110)도 고정이고, 나머지 4칸(거래소 분류·대·중·소분류)이 남는 폭을 같게 나눈다.
// 일본 종목 표는 이 값을 그대로 따른다(stockColumnWidthsForJapan) — 두 표의 경계가 항상 같은 좌표에 놓인다.
// 남는 폭을 나누는 비율 — 창 너비 1440px에서 종목명 130, 약칭 110, 거래소 분류·대·중·소분류 약 119가 되는 값이다(나머지 폭 718px 기준).
// 창이 넓거나 좁아지면 같은 비율로 늘고 줄며, 한 칸은 FLEX_COLUMN_MIN_PX보다 좁아지지 않는다.
const FLEX_WEIGHTS: Partial<Record<StockColumnKey, number>> = {
  stockName: 130,
  alias: 110,
  industry: 119.5,
  parentSector: 119.5,
  midSector: 119.5,
  subSector: 119.5,
}
const KOREAN_COLUMN_ORDER: readonly StockColumnKey[] = ['stockCode', 'stockName', 'alias', 'totalMarketValue', 'sizeTier', 'market', 'nxt', 'industry', 'parentSector', 'midSector', 'subSector']

export type StockColumnWidths = Partial<Record<StockColumnKey, number>>

// 창이 좁아지면 옆 스크롤이 생기기 직전에 아래 순서로 열을 하나씩 숨긴다(2026-11-13 사용자 지시). 종목명·시가총액과 대·중·소분류는 숨기지 않는다.
// 앞의 세 열(폭 70px)은 어느 순서든 단계마다 70px씩 줄고, 일본 표는 열 이름이 아니라 규모·마켓·NXT 묶음의 크기를 따른다.
export const STOCK_COLUMN_HIDE_ORDER: readonly StockColumnKey[] = ['stockCode', 'nxt', 'market', 'alias', 'industry', 'sizeTier']

// 숨기기 전에 견디는 여유 폭(px) — 칸 폭이 최소 폭에 닿은 뒤 이만큼까지는 표가 아주 조금(몇 px) 넘치는 것을 그대로 둔다.
// 창 너비 1440(영역 1126px)에서 열이 숨지 않고 확정 폭 그대로 보이게 하는 값이다(2026-11-13).
const HIDE_TOLERANCE_PX = 16

// 머리글 필터가 걸린 열은 숨기지 않는다(보이지 않는 조건 때문에 목록이 줄어든 이유를 알 수 없게 되므로) — 필터가 있는 숨김 후보 열의 이름이다.
const FILTERABLE_HIDE_KEYS: readonly StockColumnKey[] = ['nxt', 'market', 'industry', 'sizeTier']
export function pinnedStockColumns(excluded: Partial<Record<string, ReadonlySet<string> | undefined>>): ReadonlySet<StockColumnKey> {
  return new Set(FILTERABLE_HIDE_KEYS.filter(key => (excluded[key]?.size ?? 0) > 0))
}

// 보이는 열만으로 계산한 표의 폭 구성 — 고정 폭 합과, 남는 폭을 나눠 갖는 열이 모두 최소 폭 이상이 되려면 필요한 남는 폭이다.
function layoutFor(hidden: ReadonlySet<StockColumnKey>) {
  const visible = KOREAN_COLUMN_ORDER.filter(key => !hidden.has(key))
  const fixedTotal = visible.reduce((sum, key) => sum + (FIXED_COLUMN_PX[key] ?? 0), STOCK_CHECKBOX_COLUMN_PX)
  const weights = visible.map(key => FLEX_WEIGHTS[key]).filter((weight): weight is number => weight !== undefined)
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
  const flexNeeded = weights.length === 0 ? 0 : (FLEX_COLUMN_MIN_PX * weightTotal) / Math.min(...weights)
  return { visible, fixedTotal, weightTotal, flexNeeded }
}

// 영역 너비에서 숨길 열 — 숨기는 열이 늘어도 옆 스크롤 없이 들어가는 가장 적은 개수만 숨긴다(필터가 걸린 열은 건너뛴다).
// 숨길 수 있는 열을 모두 숨겨도 좁으면 나머지는 옆 스크롤이다.
export function hiddenStockColumnsFor(containerWidth: number, pinned: ReadonlySet<StockColumnKey> = new Set()): ReadonlySet<StockColumnKey> {
  const width = Math.floor(containerWidth)
  const candidates = STOCK_COLUMN_HIDE_ORDER.filter(key => !pinned.has(key))
  for (let count = 0; count <= candidates.length; count += 1) {
    const hidden = new Set(candidates.slice(0, count))
    const { fixedTotal, flexNeeded } = layoutFor(hidden)
    if (width >= fixedTotal + flexNeeded - HIDE_TOLERANCE_PX || count === candidates.length) return hidden
  }
  return new Set()
}

// 숨긴 열은 결과에 키가 없다 — 폭 표에 키가 없으면 표는 그 열의 머리글·칸·열 폭을 그리지 않는다.
export function computeStockColumnWidths(containerWidth: number, pinned: ReadonlySet<StockColumnKey> = new Set()): StockColumnWidths {
  const hidden = hiddenStockColumnsFor(containerWidth, pinned)
  const { visible, fixedTotal, weightTotal } = layoutFor(hidden)
  const flexTotal = Math.max(0, Math.floor(containerWidth) - fixedTotal)
  const widths: StockColumnWidths = {}
  let used = 0
  for (const key of visible) {
    const weight = FLEX_WEIGHTS[key]
    if (weight === undefined) { widths[key] = FIXED_COLUMN_PX[key]; continue }
    widths[key] = Math.max(FLEX_COLUMN_MIN_PX, Math.floor((flexTotal * weight) / weightTotal))
    used += widths[key] ?? 0
  }
  // 정수로 내림한 나머지 폭은 종목명에 더해 칸 폭의 합이 영역 너비와 같게 한다(브라우저가 남는 폭을 소수로 나눠 칸마다 어긋나는 것을 막는다).
  const remainder = flexTotal - used
  if (remainder > 0 && widths.stockName !== undefined) widths.stockName += remainder
  return widths
}

export const stockColumnWidthsTotal = (widths: StockColumnWidths): number =>
  STOCK_CHECKBOX_COLUMN_PX + Object.values(widths).reduce((sum, width) => sum + (width ?? 0), 0)

// 일본 종목 표의 칸 폭 — 국내 표의 좌표를 따른다.
// 종목명 (영어)·종목명 (한글)(=약칭)·시가총액(¥)·야후 업종(=거래소 분류)·대·중·소분류는 국내와 같다.
// 국내 규모·마켓·NXT(3칸) 묶음은 일본 시가총액(₩)·야후 섹터(2칸) 묶음과 시작·끝이 같다 — 시가총액(₩)은 시가총액(¥)과 같은 폭이고 야후 섹터가 나머지를 가진다.
// 국내가 마켓·NXT를 숨겨 묶음이 줄면(210 → 140 → 70) 일본은 먼저 시가총액(₩)을 숨기고 야후 섹터가 묶음 전체를 가진다.
// 묶음이 모두 숨으면(0) 야후 섹터도 숨는다. 종목코드·거래소 분류(=야후 업종)는 국내와 함께 숨기고, 약칭 자리는 종목명 (영어)이 숨는다 — 폭 표에 키가 없다.
export function stockColumnWidthsForJapan(korean: StockColumnWidths): StockColumnWidths {
  const group = (korean.sizeTier ?? 0) + (korean.market ?? 0) + (korean.nxt ?? 0)
  const showKrw = korean.market !== undefined && korean.nxt !== undefined && korean.sizeTier !== undefined
  const widths: StockColumnWidths = {
    totalMarketValue: korean.totalMarketValue,
    parentSector: korean.parentSector,
    midSector: korean.midSector,
    subSector: korean.subSector,
  }
  if (korean.stockCode !== undefined) widths.stockCode = korean.stockCode
  // 국내가 약칭을 숨기면 일본은 종목명 (영어)을 숨기고 종목명 (한글)이 국내 종목명 칸의 자리와 폭을 그대로 가져간다(2026-11-13).
  if (korean.alias !== undefined) { widths.stockName = korean.stockName; widths.alias = korean.alias }
  else widths.alias = korean.stockName
  if (korean.industry !== undefined) widths.overseasSubSector = korean.industry
  if (showKrw) widths.totalMarketValueKrw = korean.totalMarketValue
  const sector = group - (showKrw ? (korean.totalMarketValue ?? 0) : 0)
  if (sector > 0) widths.industry = sector
  return widths
}
