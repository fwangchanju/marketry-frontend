// 한국 밖 시장(지금은 일본·미국, 앞으로 대만 등)의 기본 정보를 적는 한 곳.
// 주소 조각·배지 글자·목록 이름을 여기만 고치면 주소 함수(`snapshotRoute`)·배지 목록(`marketMenu`·`customMenu`)·상단 메뉴·서머리 라우트가 따라온다.
// 시장을 하나 더하려면 아래 목록에 한 줄을 더하고, 그 시장의 화면·데이터(지도·그래프·섹터·주식·서머리)를 붙이면 된다.
// 한국 시장(KOREA·KOSPI·KOSDAQ)은 하위 단계가 있어서 `marketOptions.ts`·`marketRoute.ts`가 따로 맡는다.
export const SNAPSHOT_MARKET_LIST = [
  // dateHint: 날짜 배지에 마우스를 올렸을 때의 안내(저장 날짜가 현지 거래일인 시장만).
  // 배지 글자: 툴바 맨 왼쪽 시장 배지에 쓴다. 목록 이름: 배지를 눌렀을 때 열리는 시장 목록에 쓴다(KOREA·JAPAN·USA).
  { id: 'JAPAN', routeSegment: 'japan', badgeLabel: 'NIKKEI 225', menuLabel: 'JAPAN', dateHint: undefined },
  { id: 'USA', routeSegment: 'usa', badgeLabel: 'S&P 500', menuLabel: 'USA', dateHint: undefined },
] as const

export type SnapshotMarket = (typeof SNAPSHOT_MARKET_LIST)[number]['id']
// 회원 분류(내 기준·MARKETRY 업데이트)를 나누는 시장 — 한국과 스냅샷 시장.
export type ClassificationMarket = 'KOREA' | SnapshotMarket
export type SnapshotMarketInfo = (typeof SNAPSHOT_MARKET_LIST)[number]

// 스냅샷 시장 화면의 주소 앞 조각. 시장 이름이 뒤에 붙는다(/map/japan, /summary/usa, /sector/japan …).
export type SnapshotBasePath = '/map' | '/graph' | '/summary' | '/sector' | '/stock'

export function snapshotMarketInfo(id: SnapshotMarket): SnapshotMarketInfo {
  return SNAPSHOT_MARKET_LIST.find(market => market.id === id) as SnapshotMarketInfo
}

// 주소의 시장 조각(japan·usa …)으로 시장을 찾는다. 스냅샷 시장이 아니면 null이다.
export function snapshotMarketBySegment(segment: string | null | undefined): SnapshotMarketInfo | null {
  return SNAPSHOT_MARKET_LIST.find(market => market.routeSegment === segment) ?? null
}

export function snapshotRoute(basePath: SnapshotBasePath, id: SnapshotMarket): string {
  return `${basePath}/${snapshotMarketInfo(id).routeSegment}`
}

// 주소 속에서 시장 조각을 찾는 정규식에 넣는 스냅샷 시장 조각들(japan|usa …).
export const SNAPSHOT_SEGMENT_PATTERN = SNAPSHOT_MARKET_LIST.map(market => market.routeSegment).join('|')
