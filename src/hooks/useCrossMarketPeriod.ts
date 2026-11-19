import { resolveSnapshotOnOrBefore, snapshotTimesAsDays } from '@/utils/snapshotPick'
import { useSnapshotSelection, type SnapshotPick } from './useSnapshotSelection'
import type { OverseasMarket } from '@/utils/markets'

// 일본·미국 지도와 그래프의 날짜·기간. 한국 지도·서머리와 같은 저장소를 쓰므로 시장을 옮겨도 고른 기간이 이어진다.
// 저장소의 날짜가 이 시장의 종가 목록에 없으면 이전 거래일 종가로 옮긴다. 목록을 받기 전에는 isResolving이 true다.
// 반환값 selectedTime·rangeStart는 null이면 실시간(또는 기간이 없음)이다.
export function useCrossMarketPeriod(market: OverseasMarket, times: readonly string[] | undefined) {
  const { pinned, range, setSelection } = useSnapshotSelection()

  const resolve = (pick: SnapshotPick | null): string | null | undefined => {
    if (pick === null) return null
    if (pick.market === market) return pick.snapshotTime
    if (times === undefined) return undefined
    return resolveSnapshotOnOrBefore(snapshotTimesAsDays(times), pick.snapshotTime.slice(0, 10)) ?? null
  }

  const pinnedTime = resolve(pinned)
  const rangeTime = resolve(range)
  const selectedTime = pinnedTime ?? null
  // 끝 날짜가 실시간으로 떨어지면 기간도 함께 푼다(시작만 남은 기간은 보여 주지 않는다).
  const rangeStart = selectedTime === null ? null : (rangeTime ?? null)
  const isResolving = (pinned !== null && pinnedTime === undefined) || (range !== null && rangeTime === undefined)

  const select = (time: string | null) => setSelection(time === null ? null : { market, snapshotTime: time }, null)
  const selectRange = (start: string, end: string) => setSelection({ market, snapshotTime: end }, { market, snapshotTime: start })

  return { selectedTime, rangeStart, isResolving, select, selectRange }
}
