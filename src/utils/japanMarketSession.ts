import { isJapanMarketClosed } from './japanMarketCalendar.ts'

// 도쿄 거래소 세션. 한국 증시와 세션 구조가 달라 이름과 판정을 공유하지 않는다.
// 시차가 없어 한국 시각과 같다.
export type JapanSession = '오전 장' | '점심 휴장' | '오후 장' | '장 마감'

export const JAPAN_SESSION_GUIDE: readonly { session: JapanSession; term: string; range: string }[] = [
  { session: '오전 장', term: '前場 젠바', range: '09:00~11:30' },
  { session: '점심 휴장', term: '昼休み 히루야스미', range: '11:30~12:30' },
  { session: '오후 장', term: '後場 고바', range: '12:30~15:30' },
  { session: '장 마감', term: '大引け 오비케', range: '15:30' },
]

// 그 시각이 어느 세션인지 — 장이 열려 있지 않은 시각은 모두 장 마감이다.
export function japanSessionAt(snapshotTime: string): JapanSession {
  if (isJapanMarketClosed(snapshotTime.slice(0, 10))) return '장 마감'
  const clock = snapshotTime.slice(11, 16)
  if (clock >= '09:00' && clock < '11:30') return '오전 장'
  if (clock >= '11:30' && clock < '12:30') return '점심 휴장'
  if (clock >= '12:30' && clock < '15:30') return '오후 장'
  return '장 마감'
}
