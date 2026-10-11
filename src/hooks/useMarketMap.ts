import { useQuery } from '@tanstack/react-query'
import { getMarketMap, getMarketMapSnapshotDays, getStockCatalog, getTradingDayGap, type ChangeRateMode } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { MARKET_DATA_CACHE, STATIC_REFERENCE_CACHE } from './cacheConfig'
import type { MarketQuery } from '@/types/api'
import type { TaxonomySource } from '@/utils/taxonomyNames'

export function useMarketMap(
  market: MarketQuery,
  source: TaxonomySource,
  nxtOnly: boolean,
  options?: { enabled?: boolean; basis?: ChangeRateMode; snapshotTime?: string },
) {
  const basis = options?.basis ?? 'daily'
  const snapshotTime = options?.snapshotTime
  return useQuery({
    queryKey: marketMapKeys.map(market, source, nxtOnly, basis, snapshotTime ?? null),
    queryFn: () => getMarketMap(market, source, snapshotTime, nxtOnly, basis),
    enabled: options?.enabled ?? true,
    ...MARKET_DATA_CACHE,
    // 지난 날짜의 지도는 바뀌지 않으니 1분마다 다시 받지 않는다.
    ...(snapshotTime ? { refetchInterval: false } : {}),
  })
}

// 달력에 표시할 날짜 목록(그 달에 종가 지도가 있는 날). 달력을 열 때만 조회한다.
export function useMarketMapSnapshotDays(market: MarketQuery, month: string, options?: { enabled?: boolean; retry?: number | false }) {
  return useQuery({
    queryKey: marketMapKeys.snapshotDays(market, month),
    queryFn: () => getMarketMapSnapshotDays(market, month),
    enabled: options?.enabled ?? true,
    ...(options?.retry === undefined ? {} : { retry: options.retry }),
    ...MARKET_DATA_CACHE,
  })
}

// 지난 날짜(from)가 실시간 날짜(to)보다 몇 거래일 전인지. 두 날짜가 정해진 뒤에만 조회한다.
export function useTradingDayGap(from: string | null, to: string | null) {
  return useQuery({
    queryKey: marketMapKeys.tradingDayGap(from ?? '', to ?? ''),
    queryFn: () => getTradingDayGap(from ?? '', to ?? ''),
    enabled: from !== null && to !== null,
    staleTime: 60_000,
  })
}

// 로그인 없이 읽는 종목 공통 정보 — 읽기 전용 시트가 NXT 여부·시장·거래소 분류명을 얻는다.
export function useStockCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: marketMapKeys.stockCatalog(),
    queryFn: getStockCatalog,
    enabled: options?.enabled ?? true,
    ...STATIC_REFERENCE_CACHE,
  })
}
