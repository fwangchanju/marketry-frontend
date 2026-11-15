// 한국 밖 시장(지금은 일본·미국, 앞으로 대만 등)의 기본 정보를 적는 한 곳.
// 주소 조각·배지 글자·목록 이름을 여기만 고치면 주소 함수(`overseasRoute`)·배지 목록(`marketMenu`·`customMenu`)·상단 메뉴·서머리 라우트가 따라온다.
// 시장을 하나 더하려면 아래 목록에 한 줄을 더하고, 그 시장의 화면·데이터(지도·그래프·섹터·주식·서머리)를 붙이면 된다.
// 한국 시장(KOREA·KOSPI·KOSDAQ)은 하위 단계가 있어서 `marketOptions.ts`·`marketRoute.ts`가 따로 맡는다.
export const OVERSEAS_MARKETS = [
  // 배지 글자: 툴바 맨 왼쪽 시장 배지에 쓴다. 목록 이름: 배지를 눌렀을 때 열리는 시장 목록에 쓴다(KOREA·JAPAN·USA).
  { id: 'JAPAN', routeSegment: 'japan', badgeLabel: 'NIKKEI 225', menuLabel: 'JAPAN' },
  { id: 'USA', routeSegment: 'usa', badgeLabel: 'S&P 500', menuLabel: 'USA' },
] as const

export type OverseasMarket = (typeof OVERSEAS_MARKETS)[number]['id']
export type OverseasMarketInfo = (typeof OVERSEAS_MARKETS)[number]

// 해외 시장 화면의 주소 앞 조각. 시장 이름이 뒤에 붙는다(/map/japan, /summary/usa, /sector/japan …).
export type OverseasBasePath = '/map' | '/graph' | '/summary' | '/sector' | '/stock'

export function overseasMarketInfo(id: OverseasMarket): OverseasMarketInfo {
  return OVERSEAS_MARKETS.find(market => market.id === id) as OverseasMarketInfo
}

// 주소의 시장 조각(japan·usa …)으로 시장을 찾는다. 해외 시장이 아니면 null이다.
export function overseasMarketBySegment(segment: string | null | undefined): OverseasMarketInfo | null {
  return OVERSEAS_MARKETS.find(market => market.routeSegment === segment) ?? null
}

export function overseasRoute(basePath: OverseasBasePath, id: OverseasMarket): string {
  return `${basePath}/${overseasMarketInfo(id).routeSegment}`
}

// 주소 속에서 시장 조각을 찾는 정규식에 넣는 해외 시장 조각들(japan|usa …).
export const OVERSEAS_SEGMENT_PATTERN = OVERSEAS_MARKETS.map(market => market.routeSegment).join('|')
