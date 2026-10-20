// 첫날과 마지막 날을 유지하면서 거래일 순서에 따라 최대 다섯 지점을 고른다.
export function sampleTrendDays<T>(days: readonly T[]): T[] {
  if (days.length <= 5) return [...days]
  return Array.from({ length: 5 }, (_, index) => days[Math.round(index * (days.length - 1) / 4)])
}

export function trendMonths(startDate: string, endDate: string): string[] {
  const months: string[] = []
  const cursor = new Date(`${startDate.slice(0, 7)}-01T00:00:00Z`)
  const endMonth = endDate.slice(0, 7)
  while (cursor.toISOString().slice(0, 7) <= endMonth) {
    months.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}
