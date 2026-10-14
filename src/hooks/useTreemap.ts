import { useQuery } from '@tanstack/react-query'
import { getTreemap, getSnapshotDays, getStockCatalog, getTradingDayGap, type ChangeRateMode, type SnapshotDay } from '@/api/treemap'
import { treemapKeys } from './queryKeys'
import { MARKET_DATA_CACHE, STATIC_REFERENCE_CACHE } from './cacheConfig'
import type { MarketQuery } from '@/types/api'
import type { TaxonomySource } from '@/utils/taxonomyNames'

export function useTreemap(
  market: MarketQuery,
  source: TaxonomySource,
  nxtOnly: boolean,
  options?: { enabled?: boolean; basis?: ChangeRateMode; snapshotTime?: string },
) {
  const basis = options?.basis ?? 'daily'
  const snapshotTime = options?.snapshotTime
  return useQuery({
    queryKey: treemapKeys.map(market, source, nxtOnly, basis, snapshotTime ?? null),
    queryFn: () => getTreemap(market, source, snapshotTime, nxtOnly, basis),
    enabled: options?.enabled ?? true,
    ...MARKET_DATA_CACHE,
    // 지난 날짜의 지도는 바뀌지 않으니 1분마다 다시 받지 않는다.
    ...(snapshotTime ? { refetchInterval: false } : {}),
  })
}

// 달력에 표시할 날짜 목록(그 달에 종가 지도가 있는 날). 달력을 열 때만 조회한다.
export function useSnapshotDays(market: MarketQuery, month: string, options?: { enabled?: boolean; retry?: number | false }) {
  return useQuery({
    queryKey: treemapKeys.snapshotDays(market, month),
    queryFn: () => getSnapshotDays(market, month),
    enabled: options?.enabled ?? true,
    ...(options?.retry === undefined ? {} : { retry: options.retry }),
    ...MARKET_DATA_CACHE,
  })
}

// 어떤 날짜의 1거래일 전 거래일 — 종가 지도 목록(거래일만 있다)에서 그 날짜 바로 앞 날을 찾는다. 한 달 앞까지 본다.
// 목록을 받기 전이면 undefined, 앞선 날이 없으면 null.
export function usePreviousTradingDay(market: MarketQuery, date: string | null, options?: { enabled?: boolean }): SnapshotDay | null | undefined {
  const enabled = date !== null && (options?.enabled ?? true)
  const month = date?.slice(0, 7) ?? ''
  const previousMonthStart = date ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 2, 1) : null
  const previousMonth = previousMonthStart ? `${previousMonthStart.getFullYear()}-${String(previousMonthStart.getMonth() + 1).padStart(2, '0')}` : ''
  const current = useSnapshotDays(market, month, { enabled, retry: 1 })
  const previous = useSnapshotDays(market, previousMonth, { enabled, retry: 1 })
  if (!enabled || date === null || current.isLoading || previous.isLoading) return undefined
  const earlier = [...(previous.data ?? []), ...(current.data ?? [])].filter(day => day.date < date).sort((a, b) => a.date.localeCompare(b.date))
  return earlier.at(-1) ?? null
}

// 지난 날짜(from)가 실시간 날짜(to)보다 몇 거래일 전인지. 두 날짜가 정해진 뒤에만 조회한다.
export function useTradingDayGap(from: string | null, to: string | null) {
  return useQuery({
    queryKey: treemapKeys.tradingDayGap(from ?? '', to ?? ''),
    queryFn: () => getTradingDayGap(from ?? '', to ?? ''),
    enabled: from !== null && to !== null,
    staleTime: 60_000,
  })
}

// 로그인 없이 읽는 종목 공통 정보 — 읽기 전용 시트가 NXT 여부·시장·거래소 분류명을 얻는다.
export function useStockCatalog(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: treemapKeys.stockCatalog(),
    queryFn: getStockCatalog,
    enabled: options?.enabled ?? true,
    ...STATIC_REFERENCE_CACHE,
  })
}
