import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import { overseasMarketInfo, type OverseasMarket } from '@/utils/markets'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotDateLabel } from '@/utils/format'

// 스냅샷 날짜 목록을 쓰는 시장의 날짜 선택. 하루 또는 기간을 고른다. 날짜에 붙는 안내만 시장 목록표에서 받는다.
export default function MarketDatePicker({ market, snapshotTime, liveTime, rangeStart, holidayColor, onSelect, onSelectRange }: {
  market: OverseasMarket
  snapshotTime: string | null
  liveTime: string | null
  rangeStart: string | null
  holidayColor: string
  onSelect: (time: string | null) => void
  onSelectRange: (start: string, end: string) => void
}) {
  return (
    <SnapshotDatePicker market={market} viewedSnapshotTime={snapshotTime} liveSnapshotTime={liveTime}
      rangeStartTime={rangeStart ?? undefined} isPast={rangeStart !== null || (snapshotTime !== null && snapshotTime !== liveTime)}
      onSelectSnapshotTime={onSelect} onSelectRange={onSelectRange} holidayColor={holidayColor}>
      <span data-hint={rangeStart ? '과거 시가총액은 최신 시가총액을 주가 비율로 환산한 값입니다.' : overseasMarketInfo(market).dateHint} className={snapshotTime ? undefined : 'invisible'}>{toSnapshotDateLabel(rangeStart ?? snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}</span>
      {rangeStart && snapshotTime && <span>~ {toSnapshotDateLabel(snapshotTime)}</span>}
    </SnapshotDatePicker>
  )
}
