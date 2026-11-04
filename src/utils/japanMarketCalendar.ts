// 도쿄 거래소 일정. 시차가 없어 한국 시각과 같다.
// 휴장일은 2026년 목록만 넣었다(공휴일·대체 휴일·연말연시). 다음 해는 JPX 발표를 확인해 추가한다.
export const JAPAN_MARKET_HOLIDAYS_2026: ReadonlySet<string> = new Set([
  '2026-01-01', '2026-01-02', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29',
  '2026-05-04', '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22',
  '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23', '2026-12-31',
])

// 달력에서 옮겨 다닐 수 있는 달의 범위 — 휴장일을 확인한 해까지만 연다.
export const JAPAN_CALENDAR_FIRST_MONTH = '2026-01'
export const JAPAN_CALENDAR_LAST_MONTH = '2026-12'

// 지금 가진 종가 스냅샷. 사용자가 제공한 2026-11-04 종가 목록 하나뿐이고, 시각은 정규장 마감 시각이다.
export const JAPAN_SNAPSHOT_TIMES: Readonly<Record<string, string>> = { '2026-11-04': '2026-11-04T15:30:00' }
export const JAPAN_LATEST_SNAPSHOT_TIME = '2026-11-04T15:30:00'

export const JAPAN_SESSION_GUIDE = [
  { label: '오전장', session: '메인 마켓', range: '09:00~11:30' },
  { label: '점심 휴장', session: '마켓 종료', range: '11:30~12:30' },
  { label: '오후장', session: '메인 마켓', range: '12:30~15:30' },
] as const

export function isJapanMarketClosed(date: string): boolean {
  const weekday = new Date(`${date}T00:00:00`).getDay()
  return weekday === 0 || weekday === 6 || JAPAN_MARKET_HOLIDAYS_2026.has(date)
}
