import type { MarketQuery } from '@/types/api'
import { previousMonthKey, resolveSnapshotOnOrBefore } from '@/utils/snapshotPick'
import { useSnapshotDays } from './useHeatmap'

// 다른 시장에서 고른 날짜(date, yyyy-MM-dd)를 이 한국 시장의 종가 스냅샷 시각으로 옮긴다. 이번 달과 지난달 목록을 함께 본다.
// 목록을 받는 중이면 undefined다(호출하는 쪽은 아직 정해지지 않은 것으로 본다).
export function useSnapshotTimeOnOrBefore(market: MarketQuery, date: string | null, enabled: boolean): string | undefined {
  const active = enabled && date !== null
  const month = date?.slice(0, 7) ?? ''
  const current = useSnapshotDays(market, month, { enabled: active, retry: 1 })
  const previous = useSnapshotDays(market, previousMonthKey(month), { enabled: active, retry: 1 })
  if (!active || current.data === undefined || previous.data === undefined) return undefined
  return resolveSnapshotOnOrBefore([...previous.data, ...current.data], date)
}
