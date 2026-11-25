import { useMemo } from 'react'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { useListedStocks } from '@/markets/useMarketQuotes'
import type { SnapshotMarket } from '@/utils/markets'

// 시장에 든 종목. 번들에 든 시장은 그대로, 아니면 서버에서 받는다. 모든 화면이 이 목록을 쓴다.
export function useMarketStocks(market: SnapshotMarket) {
  const { bundledStocks } = SNAPSHOT_MARKETS[market]
  const listed = useListedStocks(market, bundledStocks === null)
  const listedStocks = listed.data
  // 박스 이름은 한글 종목명을 쓰고, 한글 이름이 없으면 종목 코드로 대신한다.
  const stocks = useMemo(() => bundledStocks ?? listedStocks?.map(stock => ({ code: stock.symbol, name: stock.symbol })), [bundledStocks, listedStocks])
  const codes = useMemo(() => (stocks ?? []).map(stock => stock.code), [stocks])
  return {
    stocks,
    codes,
    isLoading: listed.isLoading,
    isError: listed.isError,
    isFetching: listed.isFetching,
    refetch: () => (bundledStocks === null ? listed.refetch() : Promise.resolve()),
  }
}
