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

export function computeStockColumnWidths(containerWidth: number): StockColumnWidths {
  const fixedTotal = KOREAN_COLUMN_ORDER.reduce((sum, key) => sum + (FIXED_COLUMN_PX[key] ?? 0), STOCK_CHECKBOX_COLUMN_PX)
  const flexTotal = Math.max(0, Math.floor(containerWidth) - fixedTotal)
  const weightTotal = Object.values(FLEX_WEIGHTS).reduce((sum, weight) => sum + (weight ?? 0), 0)
  const widths: StockColumnWidths = {}
  let used = 0
  for (const key of KOREAN_COLUMN_ORDER) {
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
// 종목명·한글명(=약칭)·시가총액(¥)·야후 업종(=거래소 분류)·대·중·소분류는 국내와 같다.
// 국내 규모·마켓·NXT(3칸) 묶음은 일본 시가총액(₩)·야후 섹터(2칸) 묶음과 시작·끝이 같다 — 시가총액(₩)은 시가총액(¥)과 같은 폭이고 야후 섹터가 나머지를 가진다.
export function stockColumnWidthsForJapan(korean: StockColumnWidths): StockColumnWidths {
  const group = (korean.sizeTier ?? 0) + (korean.market ?? 0) + (korean.nxt ?? 0)
  return {
    stockCode: korean.stockCode,
    stockName: korean.stockName,
    alias: korean.alias,
    totalMarketValue: korean.totalMarketValue,
    totalMarketValueKrw: korean.totalMarketValue,
    industry: group - (korean.totalMarketValue ?? 0),
    overseasSubSector: korean.industry,
    parentSector: korean.parentSector,
    midSector: korean.midSector,
    subSector: korean.subSector,
  }
}
