import { useQuery } from '@tanstack/react-query'
import { getTreemap, type ChangeRateMode } from '@/api/treemap'
import { treemapKeys } from './queryKeys'
import { subtractMinutesFromSnapshotTime } from '@/utils/snapshotTime'
import { isAfterHoursSelectable } from '@/utils/tradingWindow'
import type { Market, TreemapResponse, MarketQuery } from '@/types/api'
import type { TaxonomySource } from '@/utils/taxonomyNames'

type MarketOverview = NonNullable<TreemapResponse['marketOverview']>

export interface MarketIndexPair {
  now: MarketOverview
  before: MarketOverview | null
}

export interface SectorTreemapPair {
  now: TreemapResponse
  before: TreemapResponse | null
  marketIndexes: MarketIndexPair[]
}

// before로 인정하는 조건(marketry-backend 지시서 결정 4) — 아래 셋을 전부 만족해야 한다.
// 하나라도 아니면 "before 없음"이다.
// - 요청이 성공했다: queryFn이 에러를 잡지 않고 던지므로, 여기 도달했다는 것 자체가 성공이다.
// - 응답 snapshotTime이 null이 아니다: 그 시각이 없으면 백엔드가 빈 응답을 준다.
// - 응답 snapshotTime이 요청한 시각과 같다: 옛 백엔드(snapshotTime 파라미터를 모름)는 최신을 그대로
//   돌려주므로 여기서 걸러진다 — 그걸 before로 쓰면 now와 같아져 변화율이 전부 0으로 보인다.
function isValidBefore(response: TreemapResponse, requestedSnapshotTime: string): boolean {
  return response.snapshotTime !== null && response.snapshotTime === requestedSnapshotTime
}

// ALL STOCK에도 두 지수를 표시한다. 최신 지수가 아니라 업종과 같은 스냅샷을 요청한다.
async function getMarketIndexPair(
  market: Market,
  nowSnapshotTime: string,
  beforeSnapshotTime: string,
): Promise<MarketIndexPair | null> {
  const [nowResponse, beforeResponse] = await Promise.all([
    getTreemap(market, 'KRX', nowSnapshotTime),
    getTreemap(market, 'KRX', beforeSnapshotTime),
  ])
  const nowOverview = nowResponse.marketOverview
  if (!isValidBefore(nowResponse, nowSnapshotTime) || nowOverview?.market !== market || nowOverview.snapshotTime !== nowSnapshotTime) {
    return null
  }
  const beforeOverview = beforeResponse.marketOverview
  return {
    now: nowOverview,
    before: isValidBefore(beforeResponse, beforeSnapshotTime) && beforeOverview?.market === market && beforeOverview.snapshotTime === beforeSnapshotTime
      ? beforeOverview
      : null,
  }
}

/**
 * 섹터 페이지의 now·before 쌍. now는 useGlobalSettings()가 이미 부르는 useTreemap(market, source)
 * 결과를 그대로 받아 쓴다 — 여기서 now를 다시 조회하지 않는다.
 *
 * 쌍은 (market, source, beforeMinutes, now.snapshotTime, basis)에 묶인다. now.snapshotTime만 바뀌면(60초
 * 재조회로 새 tick) placeholderData가 새 쌍이 도착할 때까지 직전 쌍을 그대로 돌려준다 — 그 사이 새
 * now와 옛 before가 섞이는 것도, before를 비워 그래프가 깜빡이는 것도 막는다. market·source·
 * beforeMinutes·basis가 바뀌면(사용자 조작) 직전 쌍을 쓰지 않고 undefined를 돌려줘서 화면이 스피너로
 * 돌아가게 한다.
 *
 * staleTime: Infinity·refetchInterval: false — 과거 시각의 트리는 바뀌지 않으므로 재조회하지 않는다.
 * 옛 백엔드 창구에서 "before 없음"으로 굳은 쌍도 다음 tick(5분 안)에 now.snapshotTime이 바뀌며 키가
 * 바뀌어 새로 받는다.
 */
export function useSectorTreemapPair(
  market: MarketQuery,
  source: TaxonomySource,
  nxtOnly: boolean,
  beforeMinutes: number,
  now: TreemapResponse | undefined,
  basis: ChangeRateMode = 'daily',
  // false면 before를 받지 않는다 — 기간 등락률을 볼 때는 "N분 전 대비"가 의미가 없어서 쓰지 않는다.
  enabled = true,
) {
  const nowSnapshotTime = now?.snapshotTime ?? null

  return useQuery({
    queryKey: treemapKeys.sectorPair(market, source, nxtOnly, beforeMinutes, nowSnapshotTime, basis, now?.afterHoursStart),
    queryFn: async (): Promise<SectorTreemapPair> => {
      if (!now || now.snapshotTime === null) {
        // enabled가 이 경로를 막지만, TypeScript는 그걸 모른다 — 방어적으로 명시한다.
        throw new Error('now.snapshotTime 없이 쌍 쿼리가 실행됐다')
      }
      const beforeSnapshotTime = subtractMinutesFromSnapshotTime(now.snapshotTime, beforeMinutes)
      // 애프터 마켓 시작 이전에는 당일 종가 대비 값이 없다. 누적 값과 섞어 변화율을 계산하지 않는다.
      if (basis === 'afterHours' && (
        !isAfterHoursSelectable(beforeSnapshotTime, now.afterHoursStart) || beforeSnapshotTime.slice(0, 10) !== now.snapshotTime.slice(0, 10)
      )) {
        return { now, before: null, marketIndexes: [] }
      }
      const [beforeResponse, indexPairs] = await Promise.all([
        getTreemap(market, source, beforeSnapshotTime, nxtOnly, basis),
        market === 'ALL_STOCK' && basis === 'daily'
          ? Promise.all([
            getMarketIndexPair('KOSPI', now.snapshotTime, beforeSnapshotTime),
            getMarketIndexPair('KOSDAQ', now.snapshotTime, beforeSnapshotTime),
          ])
          : Promise.resolve<(MarketIndexPair | null)[]>([]),
      ])
      return {
        now,
        before: isValidBefore(beforeResponse, beforeSnapshotTime) ? beforeResponse : null,
        marketIndexes: indexPairs.filter((pair): pair is MarketIndexPair => pair !== null),
      }
    },
    enabled: enabled && nowSnapshotTime !== null,
    staleTime: Infinity,
    refetchInterval: false,
    retry: 1,
    placeholderData: (previousData, previousQuery) => {
      const previousKey = previousQuery?.queryKey
      if (!previousKey) return undefined
      const [, , previousMarket, previousSource, previousNxtOnly, previousBeforeMinutes, , previousBasis, previousAfterHoursStart] = previousKey
      const sameParams =
        previousMarket === market &&
        previousSource === source &&
        previousNxtOnly === nxtOnly &&
        previousBeforeMinutes === beforeMinutes &&
        previousBasis === basis &&
        previousAfterHoursStart === now?.afterHoursStart
      return sameParams ? previousData : undefined
    },
  })
}
