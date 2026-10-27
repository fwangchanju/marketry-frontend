import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePersistedState } from './usePersistedState'
import { marketFromRouteSegment } from '@/utils/marketRoute'
import type { MarketQuery } from '@/types/api'

// 마켓 우선순위: 경로 세그먼트(/map|group/kospi 등) > 홈의 ?market= > 세션스토리지 저장값 > 기본값.
// 홈에서만 마켓 쿼리를 쓴다. 지도·그래프 경로는 경로 세그먼트가 우선한다.
//
// usePersistedState(key, routeMarket ?? defaultMarket)처럼 우선순위를 initialValue 하나로 욱여넣으면
// 안 된다 — sessionStorage에 저장값이 있으면 그 값이 initialValue를 이기므로(usePersistedState.ts:17-20)
// 브라우저에서는 저장값이 경로를 눌러버린다. 그래서 저장 상태(storedMarket)와 이번 렌더가 실제로 쓰는
// 값(market)을 분리하고, 우선순위 계산 자체는 저장값을 거치지 않고 매 렌더 순수하게 다시 한다.
export function useRouteAwareMarket(
  storageKey: string,
  defaultMarket: MarketQuery,
): [MarketQuery, (market: MarketQuery) => void] {
  const { pathname, search } = useLocation()
  const [storedMarket, setStoredMarket] = usePersistedState<MarketQuery>(storageKey, defaultMarket)

  const routeMarket = marketFromRouteSegment(pathname.split('/')[2])
  // 모바일 홈에서 전체/코스피/코스닥을 바꿀 때는 같은 /home 화면에서 쿼리만 바꾼다.
  // 다른 화면에서는 기존처럼 경로가 저장값보다 우선한다.
  const requestedMarket = pathname === '/home' ? new URLSearchParams(search).get('market') : null
  const queryMarket = requestedMarket === 'KOSPI' || requestedMarket === 'KOSDAQ' || requestedMarket === 'ALL_STOCK'
    ? requestedMarket
    : null
  const market = routeMarket ?? queryMarket ?? storedMarket

  // 경로/쿼리로 정해진 마켓을 저장해둬야, 마켓 세그먼트가 없는 다음 방문(/sector, /map)에서 폴백으로 쓸 수 있다.
  useEffect(() => {
    if (market !== storedMarket) setStoredMarket(market)
  }, [market, storedMarket, setStoredMarket])

  return [market, setStoredMarket]
}
