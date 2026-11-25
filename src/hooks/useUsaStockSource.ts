import { useMarketQuotes } from '@/markets/useMarketQuotes'
import stocks from '@/data/usaStocks.json'
import type { OverseasStockSource } from '@/hooks/overseasStockSource'
import { USA_SETTINGS_TAB_STORAGE } from '@/utils/usaMapSettings'

// 미국 종목 표의 종목 목록·시세·통화 — 공통 종목 화면(OverseasStockView)이 받는 모양으로 돌려준다.
// 임시 환산 기준: 1달러당 1,350원 (실시간 환율 연동 전). 일본 표의 엔 환산과 같은 방식이다.
const UNIT = { symbol: '$', suffix: '달러', perEok: 100_000_000, krwRate: 1350, rateNote: '1달러 당 1,350원' }

export function useUsaStockSource(): OverseasStockSource {
  const quotes = useMarketQuotes('USA')
  return { market: 'USA', stocks, quotes, unit: UNIT, sectorColumnLabel: 'GICS 분류', searchAriaLabel: '미국 종목 검색', tabStorageName: USA_SETTINGS_TAB_STORAGE.stock }
}
