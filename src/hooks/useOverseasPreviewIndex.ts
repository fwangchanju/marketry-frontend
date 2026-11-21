import { useJapanIndexCloses } from '@/hooks/useJapanIndexCloses'
import { useJapanIndexQuotes } from '@/hooks/useJapanIndexQuotes'
import { useUsaIndexCloses } from '@/hooks/useUsaIndexCloses'
import type { OverseasMarket } from '@/utils/markets'
import { overseasMarketInfo } from '@/utils/markets'
import { graphIndexValue, indexChangeRate, indexRange, intradayRateAt, shiftDate } from '@/utils/indexChange'

const NIKKEI_LABEL = '닛케이'
const INDEX_LOOKBACK_DAYS = 14

// 해외 지도·서머리의 그룹 등락률 미리보기에 넣을 지수 막대.
// 그래프 화면의 기본 보기와 같은 쿼리·같은 값을 쓰고, 값이 확정될 때까지 isFetching으로 알린다.
// 한국의 코스피·코스닥 미리보기와 같은 역할(2026-11-22 사용자 결정: 해외도 한국과 완전히 같게).
export function useOverseasPreviewIndex(market: OverseasMarket, snapshotTime: string | null, liveSnapshotTime: string | null, rangeStart: string | null) {
  // 두 시장의 쿼리를 모두 호출하되, 해당 시장이 아니면 null 인자로 비활성화한다(훅 순서 유지).
  // 쿼리 키는 그래프 소스(useJapanGraphSource·useUsaGraphSource)와 같게 만들어 같은 캐시·같은 fetching 상태를 쓴다.
  const japanSpan = indexRange(rangeStart, snapshotTime, liveSnapshotTime)
  const japanCloses = useJapanIndexCloses(japanSpan ? shiftDate(japanSpan.startDate, -INDEX_LOOKBACK_DAYS) : null, japanSpan?.endDate ?? null)
  const japanQuotes = useJapanIndexQuotes(rangeStart === null && snapshotTime ? snapshotTime.slice(0, 10) : null)
  const usaDay = snapshotTime ? snapshotTime.slice(0, 10) : null
  const usaStartDay = rangeStart ? rangeStart.slice(0, 10) : usaDay
  const usaCloses = useUsaIndexCloses(usaStartDay ? shiftDate(usaStartDay, -INDEX_LOOKBACK_DAYS) : null, usaDay)

  const value = market === 'JAPAN'
    ? graphIndexValue({
        showDelta: false,
        nowRate: rangeStart === null ? intradayRateAt(japanQuotes.data, snapshotTime) : null,
        beforeRate: null,
        dailyRate: japanSpan && japanCloses.data ? indexChangeRate(japanCloses.data, japanSpan.startDate, japanSpan.endDate) : null,
      })
    : usaDay && usaStartDay && usaCloses.data ? indexChangeRate(usaCloses.data, usaStartDay, usaDay) : null

  return {
    graphIndexItems: value === null ? [] : [{
      key: market === 'JAPAN' ? 'market-index:NIKKEI225' : 'market-index:SP500',
      name: market === 'JAPAN' ? NIKKEI_LABEL : overseasMarketInfo('USA').badgeLabel,
      value,
    }],
    isFetching: japanCloses.isFetching || japanQuotes.isFetching || usaCloses.isFetching,
  }
}
