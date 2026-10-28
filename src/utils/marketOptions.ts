import type { MarketQuery } from '@/types/api'

export const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'K-STOCK' }
// 순서는 KOREA / KOSPI / KOSDAQ이다(지도·그룹 화면 공통). 상단 메뉴 목록에 쓰며, 전체 시장의 툴바 배지는 MARKET_LABEL의 K-STOCK을 사용한다.
export const MARKET_OPTIONS: { market: MarketQuery; label: string }[] = [
  { market: 'ALL_STOCK', label: 'KOREA' },
  { market: 'KOSPI', label: 'KOSPI' },
  { market: 'KOSDAQ', label: 'KOSDAQ' },
]
