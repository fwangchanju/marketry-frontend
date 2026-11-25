import { useListedStocks, useMarketQuotes } from '@/markets/useMarketQuotes'
import { useMemo } from 'react'
import type { OverseasSectorSource } from '@/hooks/overseasSectorSource'
import { USA_SETTINGS_TAB_STORAGE } from '@/utils/usaMapSettings'

// 미국 섹터의 종목 목록·시세·통화 — 공통 섹터 화면(OverseasSectorView)이 받는 모양으로 돌려준다. 미국 종목 목록은 서버에서 받는다.
export function useUsaSectorSource(): OverseasSectorSource {
  const quotes = useMarketQuotes('USA')
  const stocksQuery = useListedStocks('USA')
  const stockCodes = useMemo(() => (stocksQuery.data ?? []).map(stock => stock.symbol), [stocksQuery.data])
  return {
    market: 'USA',
    stockCodes,
    stocksState: { isLoading: stocksQuery.isLoading, isError: stocksQuery.isError, refetch: () => { void stocksQuery.refetch() } },
    quotes,
    currency: '달러',
    tabStorageName: USA_SETTINGS_TAB_STORAGE.sector,
  }
}
