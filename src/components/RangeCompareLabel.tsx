import { useMarketMapSnapshotDays, useTradingDayGap } from '@/hooks/useMarketMap'
import { toMarketMapSnapshotDateLabel } from '@/utils/format'
import type { MarketQuery } from '@/types/api'

interface Props {
  market: MarketQuery
  // 기준이 시작일 1거래일 전의 종가면 "종가 대비", 앞선 거래일이 없어 시작일 지도의 전일종가를 쓰면 "기준가 대비"다.
  isBaseClose: boolean
  // 기간의 시작일·끝일 스냅샷 시각(ISO).
  startSnapshotTime: string
  endSnapshotTime: string
  // 시작일 지도에 없어서 계산에서 뺀 종목 수.
  excludedStockCount: number
}

// 앞의 날짜(시작일 1거래일 전)는 달력 아이콘 옆 글자가 맡는다.
// 기간 등락률을 볼 때 날짜 뒤에 붙는 "기준가 대비 2026-10-02 (금) 종가 (5거래일/10종목 제외)". 끝일이 오늘이고 아직 종가 지도가 나오기 전이면 끝의 "종가" 대신 "현재가"가 보인다. 앞의 시작일 날짜는 달력 아이콘 옆 글자가 맡는다.
// 거래일 수는 시작일을 포함해 끝일까지 센다 — 시작일 하루 전 종가가 기준이라 시작일 하루도 기간에 든다. 아직 못 받았으면 거래일은 빼고 보인다.
export default function RangeCompareLabel({ market, isBaseClose, startSnapshotTime, endSnapshotTime, excludedStockCount }: Props) {
  const { data: gap } = useTradingDayGap(startSnapshotTime.slice(0, 10), endSnapshotTime.slice(0, 10))
  // 끝일의 종가 지도 시각 목록에 이 스냅샷이 있으면 종가, 없으면(장중 실시간 지도) 현재가다. 목록을 받기 전에는 글자를 비워 둬서 종가→현재가로 바뀌어 보이지 않게 한다.
  const { data: endMonthDays } = useMarketMapSnapshotDays(market, endSnapshotTime.slice(0, 7), { retry: 1 })
  const endPriceLabel = endMonthDays === undefined ? '' : endMonthDays.some(day => day.snapshotTime === endSnapshotTime) ? ' 종가' : ' 현재가'
  const details = [
    gap !== undefined ? `${gap + 1}거래일` : null,
    excludedStockCount > 0 ? `${excludedStockCount}종목 제외` : null,
  ].filter(detail => detail !== null)
  return (
    <span>
      {isBaseClose ? '종가' : '기준가'} 대비 {toMarketMapSnapshotDateLabel(endSnapshotTime)}{endPriceLabel}
      {details.length > 0 && <span className="font-normal text-gray-400">{` (${details.join('/')})`}</span>}
    </span>
  )
}
