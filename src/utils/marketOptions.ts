import type { MarketQuery } from '@/types/api'

export const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'ALL STOCK' }
// 순서는 KOSPI / KOSDAQ / ALL STOCK이다(지도·그룹 화면 공통). 상단 메뉴 줄의 Map·Group 목록이 이걸 쓴다.
export const MARKET_OPTIONS: { market: MarketQuery; label: string }[] = [
  { market: 'KOSPI', label: 'KOSPI' },
  { market: 'KOSDAQ', label: 'KOSDAQ' },
  { market: 'ALL_STOCK', label: 'ALL STOCK' },
]
