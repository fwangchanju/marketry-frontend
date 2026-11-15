// 다른 시장에서 고른 날짜를 이 시장의 종가 시각으로 옮긴다.
// 같은 날짜가 없으면(휴장일이 시장마다 다르다) 그 날짜 이전의 가장 가까운 거래일 종가를 쓴다. 이전 거래일이 없으면 undefined.

export interface SnapshotDayLike {
  date: string
  snapshotTime: string
}

export function previousMonthKey(month: string): string {
  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 2
  const previous = new Date(year, monthIndex, 1)
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`
}

export function resolveSnapshotOnOrBefore(days: readonly SnapshotDayLike[], date: string): string | undefined {
  let best: SnapshotDayLike | undefined
  for (const day of days) {
    if (day.date > date) continue
    if (best === undefined || day.date > best.date) best = day
  }
  return best?.snapshotTime
}

// 일본·미국은 스냅샷 시각 목록(시각 문자열)만 받으므로 날짜 기준 항목으로 바꿔 같은 규칙을 쓴다.
export function snapshotTimesAsDays(times: readonly string[]): SnapshotDayLike[] {
  return times.map(time => ({ date: time.slice(0, 10), snapshotTime: time }))
}
