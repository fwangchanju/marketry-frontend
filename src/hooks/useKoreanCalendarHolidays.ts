import { useQueries } from '@tanstack/react-query'
import { getMarketTradingSchedule } from '@/api/heatmap'
import { INFREQUENT_DATA_CACHE } from '@/hooks/cacheConfig'
import { heatmapKeys } from '@/hooks/queryKeys'
import { KOREAN_PUBLIC_HOLIDAY_DATES } from '@/utils/koreanPublicHolidayDates'
import { KOREAN_MARKET_ADDITIONAL_HOLIDAYS } from '@/utils/koreanMarketHolidays'

// 전 거래일 데이터가 연결된 휴장일도 있으므로, 종가 지도 유무와 무관하게 평일 일정을 확인한다.
export function useKoreanCalendarHolidays(monthKey: string, cells: (number | null)[], liveDate: string | null, enabled = true) {
  const candidates = cells.flatMap(day => {
    if (!enabled || day === null) return []
    const date = `${monthKey}-${String(day).padStart(2, '0')}`
    const weekday = new Date(`${date}T00:00:00`).getDay()
    return weekday >= 1 && weekday <= 5 && (liveDate === null || date <= liveDate) ? [date] : []
  })
  const schedules = useQueries({
    queries: candidates.map(date => ({
      queryKey: heatmapKeys.tradingSchedule(date),
      queryFn: () => getMarketTradingSchedule(date),
      retry: 1,
      ...INFREQUENT_DATA_CACHE,
    })),
  })
  return {
    holidayDates: new Set([
      ...[...KOREAN_PUBLIC_HOLIDAY_DATES].filter(date => date.startsWith(`${monthKey}-`)),
      ...[...KOREAN_MARKET_ADDITIONAL_HOLIDAYS].filter(date => date.startsWith(`${monthKey}-`)),
      ...schedules.flatMap((result, index) => result.data?.status === 'HOLIDAY' ? [candidates[index]] : []),
    ]),
    pendingScheduleDates: new Set(candidates.filter((_, index) => schedules[index].isPending)),
  }
}
