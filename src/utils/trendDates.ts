// 첫날과 마지막 날을 유지하면서 거래일 순서에 따라 최대 다섯 지점을 고른다.
export function sampleTrendDays<T>(days: readonly T[]): T[] {
  if (days.length <= 5) return [...days]
  return Array.from({ length: 5 }, (_, index) => days[Math.round(index * (days.length - 1) / 4)])
}

// 기간이 길면 모든 거래일의 지도를 받지 않도록 균등 간격으로 최대 limit개만 고른다. 첫날과 마지막 날은 항상 포함한다.
export function sampleDaysUpTo<T>(days: readonly T[], limit: number): T[] {
  if (days.length <= limit) return [...days]
  return Array.from({ length: limit }, (_, index) => days[Math.round(index * (days.length - 1) / (limit - 1))])
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

// 긴 기간의 지도를 한꺼번에 요청하지 않도록 동시 조회를 네 개로 제한한다.
export async function loadTrendDays<T, R>(days: readonly T[], load: (day: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(days.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, days.length) }, async () => {
    while (next < days.length) {
      const index = next++
      results[index] = await load(days[index])
    }
  }))
  return results
}
