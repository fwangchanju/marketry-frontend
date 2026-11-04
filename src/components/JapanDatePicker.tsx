import { useEffect, useRef, useState } from 'react'
import { CalendarIcon, ChevronDownIcon } from '@/components/icons/AppIcons'
import { FILLED_ICON_CLASS } from '@/components/NavBarPageActions'
import { toSnapshotDateLabel } from '@/utils/format'
import { JAPAN_CALENDAR_FIRST_MONTH, JAPAN_CALENDAR_LAST_MONTH, JAPAN_SNAPSHOT_TIMES, isJapanMarketClosed } from '@/utils/japanMarketCalendar'
import { getKstDate } from '@/utils/tradingWindow'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const NAV_BUTTON_CLASS = 'flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted'

const toMonthKey = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`

// 일본 지도의 날짜 칩과 달력 — 국내 달력과 같은 모양이다. 국내는 서버의 거래 일정을 묻지만 일본은 아직 서버 일정이 없어 utils/japanMarketCalendar.ts를 쓴다.
// 스냅샷이 있는 날만 누를 수 있고, 주말·휴장일은 휴장 색으로 표시한다.
export default function JapanDatePicker({ snapshotTime, holidayColor, onSelect }: { snapshotTime: string; holidayColor: string; onSelect: (snapshotTime: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedDate = snapshotTime.slice(0, 10)
  const [shown, setShown] = useState({ year: Number(selectedDate.slice(0, 4)), monthIndex: Number(selectedDate.slice(5, 7)) - 1 })
  const rootRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false) }
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false) }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])
  const move = (delta: number) => setShown(previous => {
    const moved = new Date(previous.year, previous.monthIndex + delta, 1)
    return { year: moved.getFullYear(), monthIndex: moved.getMonth() }
  })
  const monthKey = toMonthKey(shown.year, shown.monthIndex)
  const firstWeekday = new Date(shown.year, shown.monthIndex, 1).getDay()
  const daysInMonth = new Date(shown.year, shown.monthIndex + 1, 0).getDate()
  const blanks = Array.from({ length: firstWeekday }, () => null)
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1)
  const today = getKstDate(new Date())
  return (
    <span ref={rootRef} className="relative z-40 flex items-center">
      <button type="button" aria-label="날짜 선택" aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen(open => !open)} className={`toolbar-badge-control flex h-6 items-center gap-1 border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-ui-control focus-visible:bg-ui-control ${isOpen ? 'bg-ui-control' : 'bg-transparent'}`}>
        <CalendarIcon strokeWidth={2.2} className={`h-[15px] w-[15px] shrink-0 ${isOpen ? FILLED_ICON_CLASS : ''}`} aria-hidden />
        {toSnapshotDateLabel(snapshotTime)}
      </button>
      {isOpen && (
        <div role="dialog" aria-label="날짜 선택 달력" className="absolute left-0 top-full z-50 mt-1 w-[16rem] rounded-md border border-ui-border bg-ui-panel p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl">
          <div className="mb-1 flex items-center justify-between">
            <button type="button" aria-label="이전 달" disabled={monthKey <= JAPAN_CALENDAR_FIRST_MONTH} onClick={() => move(-1)} className={NAV_BUTTON_CLASS}><ChevronDownIcon className="h-4 w-4 rotate-90" /></button>
            <span className="font-roboto-latin font-normal tabular-nums">{shown.year}년 {shown.monthIndex + 1}월</span>
            <button type="button" aria-label="다음 달" disabled={monthKey >= JAPAN_CALENDAR_LAST_MONTH} onClick={() => move(1)} className={NAV_BUTTON_CLASS}><ChevronDownIcon className="h-4 w-4 -rotate-90" /></button>
          </div>
          <div className="mb-0.5 grid grid-cols-7 border-b border-ui-border text-center text-[13px] font-normal text-ui-muted">
            {WEEKDAY_LABELS.map(label => <span key={label} className="py-1">{label}</span>)}
          </div>
          <div className="grid min-h-[12rem] grid-cols-7 grid-rows-6 text-center font-roboto-latin tabular-nums">
            {blanks.map((_, index) => <span key={`blank-${index}`} />)}
            {days.map(day => {
              const date = `${monthKey}-${String(day).padStart(2, '0')}`
              const closed = isJapanMarketClosed(date)
              const target = JAPAN_SNAPSHOT_TIMES[date]
              const selected = date === selectedDate
              const isToday = date === today
              return (
                <div key={date} className="my-0.5 flex h-7 items-center justify-center">
                  <button
                    type="button"
                    disabled={!target}
                    aria-pressed={selected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={`${date}${closed ? ' 휴장' : target ? '' : ' 데이터 없음'}`}
                    onClick={() => { if (target) { onSelect(target); setIsOpen(false) } }}
                    style={!selected && !isToday && closed ? { color: holidayColor } : undefined}
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-transparent ${selected ? 'bg-brand font-semibold text-ui-surface' : isToday ? `bg-brand-surface font-semibold text-ui-white ${target ? 'hover:bg-brand hover:text-ui-surface' : 'cursor-not-allowed'}` : target ? 'bg-transparent text-ui-white hover:bg-brand hover:text-ui-surface' : `cursor-not-allowed bg-transparent ${closed ? '' : 'text-ui-muted'}`}`}
                  >
                    {day}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
