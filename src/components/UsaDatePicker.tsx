import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotDateLabel } from '@/utils/format'

// 미국 지도·그래프의 날짜 선택 — 일본·국내와 같은 공통 달력이다. 미국은 하루 한 번 저장되므로 시각이 아니라 날짜만 보여 주고, 기간 선택은 없다.
// 저장 시각의 날짜는 미국 거래일이다(한국 시각으로는 다음 날 아침에 마감한다).
export default function UsaDatePicker({ snapshotTime, liveTime, holidayColor, onSelect }: {
  snapshotTime: string | null
  liveTime: string | null
  holidayColor: string
  onSelect: (time: string | null) => void
}) {
  return (
    <SnapshotDatePicker market="USA" viewedSnapshotTime={snapshotTime} liveSnapshotTime={liveTime}
      isPast={snapshotTime !== null && snapshotTime !== liveTime}
      onSelectSnapshotTime={onSelect} holidayColor={holidayColor}>
      <span data-hint="미국 거래일 기준입니다." className={snapshotTime ? undefined : 'invisible'}>{toSnapshotDateLabel(snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}</span>
    </SnapshotDatePicker>
  )
}
