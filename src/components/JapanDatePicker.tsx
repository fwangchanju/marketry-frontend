import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotDateLabel } from '@/utils/format'

export default function JapanDatePicker({ snapshotTime, liveTime, rangeStart, holidayColor, onSelect, onSelectRange }: {
  snapshotTime: string | null
  liveTime: string | null
  rangeStart: string | null
  holidayColor: string
  onSelect: (time: string | null) => void
  onSelectRange: (start: string, end: string) => void
}) {
  return (
    <SnapshotDatePicker market="JAPAN" viewedSnapshotTime={snapshotTime} liveSnapshotTime={liveTime}
      rangeStartTime={rangeStart ?? undefined} isPast={rangeStart !== null || (snapshotTime !== null && snapshotTime !== liveTime)}
      onSelectSnapshotTime={onSelect} onSelectRange={onSelectRange} holidayColor={holidayColor}>
      <span data-hint={rangeStart ? '과거 시가총액은 최신 시가총액을 주가 비율로 환산한 값입니다.' : undefined} className={snapshotTime ? undefined : 'invisible'}>{toSnapshotDateLabel(rangeStart ?? snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}</span>
      {rangeStart && snapshotTime && <span>~ {toSnapshotDateLabel(snapshotTime)}</span>}
    </SnapshotDatePicker>
  )
}
