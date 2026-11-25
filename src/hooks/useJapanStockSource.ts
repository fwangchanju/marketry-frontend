import { useMarketQuotes } from '@/markets/useMarketQuotes'
import stocks from '@/data/japanStocks.json'
import type { OverseasStockSource } from '@/hooks/overseasStockSource'
import { JAPAN_SETTINGS_TAB_STORAGE } from '@/utils/japanMapSettings'

// 일본 종목 표의 종목 목록·시세·통화 — 공통 종목 화면(OverseasStockView)이 받는 모양으로 돌려준다.
// 임시 환산 기준: 1엔당 8.5원 (실시간 환율 연동 전).
const UNIT = { symbol: '¥', suffix: '엔', perEok: 100_000_000, krwRate: 8.5, rateNote: '100엔 당 850원' }

export function useJapanStockSource(): OverseasStockSource {
  const quotes = useMarketQuotes('JAPAN')
  return { market: 'JAPAN', stocks, quotes, unit: UNIT, sectorColumnLabel: '야후 분류', searchAriaLabel: '일본 종목 검색', tabStorageName: JAPAN_SETTINGS_TAB_STORAGE.stock }
}
