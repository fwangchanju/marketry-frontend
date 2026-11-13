// 해외 지수의 날짜별 종가로 등락률을 구한다. 일본·미국 그래프의 지수 기준 막대에 쓴다.
export type IndexClose = { date: string; close: number }

const DAY_MS = 24 * 60 * 60 * 1000

// 'YYYY-MM-DD'에서 일수를 더하거나 뺀 날짜. 시간대와 상관없이 달력 날짜만 계산한다.
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

// 시작일 바로 앞 거래일의 종가를 기준으로 종료일 종가까지의 등락률(%)을 구한다. 하루 보기는 시작일과 종료일이 같다.
// 기준 종가나 종료일 종가가 없으면 null이다. 값이 없는 날을 0으로 그리면 틀린 막대가 되므로 막대를 만들지 않는다.
export function indexChangeRate(closes: readonly IndexClose[], startDate: string, endDate: string): number | null {
  const end = closes.find(entry => entry.date === endDate)
  let base: IndexClose | null = null
  for (const entry of closes) {
    if (entry.date < startDate && (base === null || entry.date > base.date)) base = entry
  }
  if (!end || !base || base.close <= 0) return null
  return (end.close / base.close - 1) * 100
}

// 그래프가 지수 막대를 그릴 구간. 기간 보기는 시작일~종료일, 지난 날짜 보기는 그날 하루다.
// 오늘(실시간) 화면은 종가가 아직 저장되지 않아 null이다. 장중 지수 등락률은 따로 저장하게 되면 그때 넣는다.
export function indexRange(rangeStart: string | null, snapshotTime: string | null, liveSnapshotTime: string | null): { startDate: string; endDate: string } | null {
  if (snapshotTime === null) return null
  const endDate = snapshotTime.slice(0, 10)
  if (rangeStart !== null) return { startDate: rangeStart.slice(0, 10), endDate }
  if (liveSnapshotTime !== null && liveSnapshotTime.slice(0, 10) === endDate) return null
  return { startDate: endDate, endDate }
}
