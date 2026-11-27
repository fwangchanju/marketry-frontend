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

// 하루에 시세가 여러 개인 시장(미국: 프리마켓·정규장·애프터마켓 5분 시세)에서 종가 줄만 고른다(2026-11-27).
// 종가 줄(예: 미국 16:00)이 있는 날은 그 줄만 남기고, 아직 종가가 없는 날(오늘 장중)은 그대로 둔다. closeClock이 없는 시장(일본)은 그대로다.
// 날짜를 고르면 "그날의 종가 지도"가 열리게 하려는 것이다.
export function keepCloseRows(times: readonly string[], closeClock: string | null): string[] {
  if (closeClock === null) return [...times]
  const closeDates = new Set(times.filter(time => time.slice(11, 16) === closeClock).map(time => time.slice(0, 10)))
  return times.filter(time => !closeDates.has(time.slice(0, 10)) || time.slice(11, 16) === closeClock)
}

// 가장 최근 종가 줄의 시각. 없으면 null이다(텔레그램 종가 지도가 이 줄로 그린다).
export function latestCloseTime(times: readonly string[], closeClock: string): string | null {
  for (let index = times.length - 1; index >= 0; index--) {
    if (times[index].slice(11, 16) === closeClock) return times[index]
  }
  return null
}
