import { useTradingDayGap } from '@/hooks/useMarketMap'
import { toMarketMapSnapshotDateLabel } from '@/utils/format'

interface Props {
  // 기간의 시작일·끝일 스냅샷 시각(ISO).
  startSnapshotTime: string
  endSnapshotTime: string
  // 시작일 지도에 없어서 계산에서 뺀 종목 수.
  excludedStockCount: number
}

// 기간 등락률을 볼 때 날짜 뒤에 붙는 "~ 2026-10-02 (금) (5거래일·10종목 제외)". 앞의 시작일 날짜는 달력 아이콘 옆 글자가 맡는다.
// 시작일의 기준가(= 그 전 거래일 종가)와 끝일의 종가/현재가 설명은 상단이 길어지지 않게 종목 팝업에서 보여 준다.
// 거래일 수는 시작일을 포함해 끝일까지 센다 — 시작일 하루 전 종가가 기준이라 시작일 하루도 기간에 든다. 아직 못 받았으면 거래일은 빼고 보인다.
// 괄호 안의 구분 점은 가운뎃점(U+00B7)이다.
export default function RangeCompareLabel({ startSnapshotTime, endSnapshotTime, excludedStockCount }: Props) {
  const { data: gap } = useTradingDayGap(startSnapshotTime.slice(0, 10), endSnapshotTime.slice(0, 10))
  const details = [
    gap !== undefined ? `${gap + 1}거래일` : null,
    excludedStockCount > 0 ? `${excludedStockCount}종목 제외` : null,
  ].filter(detail => detail !== null)
  return (
    <span>
      ~ {toMarketMapSnapshotDateLabel(endSnapshotTime)}
      {details.length > 0 && <span className="font-normal text-gray-400">{` (${details.join('\u00B7')})`}</span>}
    </span>
  )
}
