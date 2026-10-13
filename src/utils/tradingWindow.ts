import type { MarketTradingSchedule } from '../types/api'

export interface NxtOnlyWindow {
  // 화면에 그대로 보여주는 시간 범위.
  label: string
  fromMinutes: number
  toMinutes: number
}

// 시간표 조회 실패·누락 시 사용하는 기존 한국 시간 기준.
const NXT_ONLY_WINDOWS: readonly NxtOnlyWindow[] = [
  { label: '08:00 ~ 08:50', fromMinutes: 8 * 60, toMinutes: 8 * 60 + 50 },
  { label: '15:40 ~ 16:00', fromMinutes: 15 * 60 + 40, toMinutes: 16 * 60 },
]

const KST_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

// 지금이 NXT 단독 시간대면 그 시간대를, 아니면 null을 돌려준다.
export function currentNxtOnlyWindow(now: Date, schedule?: MarketTradingSchedule): NxtOnlyWindow | null {
  if (schedule?.date === getKstDate(now)) {
    if (schedule.status === 'HOLIDAY') return null
    if (schedule.status === 'TRADING_DAY') {
      const window = schedule.nxtOnlyWindows.find(window => containsTime(now, window))
      if (!window) return null
      const start = window.startTime.slice(11, 16)
      const end = window.endTime.slice(11, 16)
      return { label: `${start} ~ ${end}`, fromMinutes: toMinutes(start), toMinutes: toMinutes(end) }
    }
  }
  const parts = KST_PARTS.formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  const weekday = value('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return null
  const minutes = Number(value('hour')) * 60 + Number(value('minute'))
  return NXT_ONLY_WINDOWS.find(window => minutes >= window.fromMinutes && minutes < window.toMinutes) ?? null
}

// 시간외 등락률은 조회 날짜의 시간외 시작 이후에 선택한다. 서버가 준 경계가 없으면 15:40을 사용한다.
// 다음 개장까지 이전 거래일 스냅샷을 보여줄 때도 그 스냅샷 날짜의 경계로 판단한다.
const AFTER_HOURS_START = '15:40'

// 애프터 마켓 시작부터 다음 프리 마켓 개장 직전까지 누적/별도 버튼을 표시한다.
// 주말에는 다음 평일 08:00 개장까지 유지한다. 다른 시간대 판단과 같이 공휴일은 별도로 구분하지 않는다.
export function shouldShowAfterHoursControls(now: Date, afterHoursStart?: string | null): boolean {
  const parts = KST_PARTS.formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  const weekday = value('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return true
  const minutes = Number(value('hour')) * 60 + Number(value('minute'))
  const today = `${value('year')}-${value('month')}-${value('day')}`
  const start = afterHoursStart?.slice(0, 10) === today ? afterHoursStart.slice(11, 16) : AFTER_HOURS_START
  const [hour, minute] = start.split(':').map(Number)
  return minutes >= hour * 60 + minute || minutes < 8 * 60
}

export function isAfterHoursSelectable(snapshotTime: string | null | undefined, afterHoursStart?: string | null): boolean {
  if (!snapshotTime) return false
  // snapshotTime은 한국 시각 그대로의 "YYYY-MM-DDTHH:mm:ss" 문자열이다.
  if (afterHoursStart) return snapshotTime >= afterHoursStart
  return snapshotTime.slice(11, 16) >= AFTER_HOURS_START
}

export function isNxtOnlyTime(now: Date, schedule?: MarketTradingSchedule): boolean {
  return currentNxtOnlyWindow(now, schedule) !== null
}

// 화면 문구는 유지하고, 확인된 시간표가 있을 때만 고정 시간을 대체한다.
export type TradingSession = '프리 마켓' | '메인 마켓' | '애프터 마켓' | '마켓 종료'

export function currentTradingSession(now: Date, schedule?: MarketTradingSchedule): TradingSession {
  if (schedule?.date === getKstDate(now)) {
    if (schedule.status === 'HOLIDAY') return '마켓 종료'
    if (schedule.status === 'TRADING_DAY') {
      if (containsTime(now, schedule.preMarket)) return '프리 마켓'
      if (containsTime(now, schedule.regularMarket)) return '메인 마켓'
      if (containsTime(now, schedule.afterMarket)) return '애프터 마켓'
      return '마켓 종료'
    }
  }
  const parts = KST_PARTS.formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  const weekday = value('weekday')
  if (weekday === 'Sat' || weekday === 'Sun') return '마켓 종료'
  const minutes = Number(value('hour')) * 60 + Number(value('minute'))
  if (minutes >= 8 * 60 && minutes < 9 * 60) return '프리 마켓'
  if (minutes >= 9 * 60 && minutes < 15 * 60 + 30) return '메인 마켓'
  if (minutes >= 15 * 60 + 40 && minutes < 20 * 60) return '애프터 마켓'
  return '마켓 종료'
}

export function getKstDate(now: Date): string {
  const parts = KST_PARTS.formatToParts(now)
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function containsTime(now: Date, window: MarketTradingSchedule['preMarket']): boolean {
  if (!window) return false
  // 서버의 LocalDateTime은 한국 시각이므로 브라우저의 시간대에 영향받지 않도록 오프셋을 명시한다.
  return now.getTime() >= new Date(`${window.startTime}+09:00`).getTime()
    && now.getTime() < new Date(`${window.endTime}+09:00`).getTime()
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}
