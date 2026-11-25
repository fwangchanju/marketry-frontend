import { useMarketQuotes } from '@/markets/useMarketQuotes'
import stocks from '@/data/japanStocks.json'
import type { OverseasSectorSource } from '@/hooks/overseasSectorSource'
import { JAPAN_SETTINGS_TAB_STORAGE } from '@/utils/japanMapSettings'

// 일본 종목 목록은 파일에 들어 있어서 받는 상태가 없다.
const STOCK_CODES = stocks.map(stock => stock.code)
const NO_STOCKS_STATE = { isLoading: false, isError: false, refetch: () => {} }

// 일본 섹터의 종목 목록·시세·통화 — 공통 섹터 화면(OverseasSectorView)이 받는 모양으로 돌려준다.
export function useJapanSectorSource(): OverseasSectorSource {
  const quotes = useMarketQuotes('JAPAN')
  return { market: 'JAPAN', stockCodes: STOCK_CODES, stocksState: NO_STOCKS_STATE, quotes, currency: '엔', tabStorageName: JAPAN_SETTINGS_TAB_STORAGE.sector }
}
