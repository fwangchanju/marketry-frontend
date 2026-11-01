// 커스텀 종목 표 열 폭 — MARKETRY·거래소·내 분류 세 종목 표가 같은 열 순서와 폭을 쓰도록 한곳에 둔다.
// 열 순서(체크박스 다음): 종목코드, 종목명, 약칭, 시가총액, 종목 크기, 마켓, NXT, 거래소 분류, 대분류, 중분류, 소분류.
//
// 글자 폭이 정해진 열은 px로 고정하고(머리글의 정렬·필터 아이콘 자리까지 포함), 글자가 길어질 수 있는 열(종목명·약칭·거래소 분류·
// 대/중/소분류)은 남는 폭을 같게 나눠 갖는다(표를 table-fixed로 두고 폭을 안 준 열이 나눠 갖는다).
export type StockColumnKey =
  | 'stockCode'
  | 'stockName'
  | 'alias'
  | 'totalMarketValue'
  | 'sizeTier'
  | 'market'
  | 'nxt'
  | 'industry'
  | 'parentSector'
  | 'midSector'
  | 'subSector'

// 맨 왼쪽 체크박스 칸 폭(px).
export const STOCK_CHECKBOX_COLUMN_PX = 29

// 고정 폭 열(px) — 머리글 글자와 본문 글자 중 넓은 쪽에 양쪽 여백 6px씩을 더한 빠듯한 값이다(정렬 화살표는 글자 위아래에 있어 폭을 안 쓴다).
// 종목 크기·마켓·NXT는 머리글 글자 오른쪽에 들어갈 필터 아이콘 자리(아이콘 14px + 간격 4px)를 미리 더해 두었다.
// 종목코드·시가총액은 필터 아이콘이 없다(종목코드는 검색창으로 찾고, 시가총액은 종목 크기 필터가 대신한다).
const FIXED_COLUMN_PX: Partial<Record<StockColumnKey, number>> = {
  stockCode: 66,
  totalMarketValue: 98,
  sizeTier: 86,
  market: 60,
  nxt: 64,
}

// 남는 폭을 나눠 갖는 열의 최소 폭 — 이보다 좁아지면 표가 더 줄지 않고 옆으로 스크롤한다.
const FLEX_COLUMN_MIN_PX = 110

export const stockColumnFixedPx = (key: StockColumnKey): number | undefined => FIXED_COLUMN_PX[key]

// 표 전체의 최소 폭 — 보이는 열로 계산한다.
export const stockTableMinWidthPx = (keys: readonly StockColumnKey[]): number =>
  STOCK_CHECKBOX_COLUMN_PX + keys.reduce((sum, key) => sum + (FIXED_COLUMN_PX[key] ?? FLEX_COLUMN_MIN_PX), 0)

// 표 머리글 줄 높이(px) — 본문 한 줄(29px)의 두 배다. 글자 위아래 화살표와 글자 사이에 숨 쉴 간격을 둔다.
export const STOCK_HEADER_ROW_PX = 58
