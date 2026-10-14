import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMarketTradingSchedule } from '@/api/treemap'
import { getKstDate } from '@/utils/tradingWindow'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'
import { treemapKeys } from './queryKeys'

export function useMarketTradingSchedule() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const update = () => setNow(new Date())
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])
  // 상태 표시와 NXT 필터는 스냅샷 날짜와 무관하게 오늘의 같은 시간표 캐시를 사용한다.
  const date = getKstDate(now)
  const { data: schedule } = useQuery({
    queryKey: treemapKeys.tradingSchedule(date),
    queryFn: () => getMarketTradingSchedule(date),
    ...INFREQUENT_DATA_CACHE,
  })
  return { now, schedule }
}
