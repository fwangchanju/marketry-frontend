import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarIcon, ChevronDownIcon } from '@/components/icons/AppIcons'
import { usePopupPosition } from '@/hooks/usePopupPosition'
import { usePopupBounds } from '@/hooks/usePopupBounds'
import { useHeatmapColorScale } from '@/hooks/useHeatmapColorScale'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { KOREAN_PUBLIC_HOLIDAY_DATES } from '@/utils/koreanPublicHolidayDates'
import { DROPDOWN_GAP_PX } from '@/components/dropdownStyle'

type CalendarView = 'day' | 'month' | 'year'
type ShownMonth = { year: number; monthIndex: number }

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const MIN_YEAR = 2000
const MAX_YEAR = 2099
const POPUP_WIDTH = 256

function getKstToday(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function parseDate(value: string | null): ShownMonth | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return { year, monthIndex: month - 1 }
}

function toDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function moveMonth(month: ShownMonth, delta: number): ShownMonth {
  const date = new Date(Date.UTC(month.year, month.monthIndex + delta, 1))
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() }
}

export default function BannerDatePicker({
  label,
  displayValue,
  selectedDate,
  disabled,
  dateAnimationKey,
  onSelect,
}: {
  label: string
  displayValue: string
  selectedDate: string | null
  disabled: boolean
  dateAnimationKey?: number
  onSelect: (date: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isDateHighlighted, setIsDateHighlighted] = useState(false)
  const previousDateAnimationKey = useRef(dateAnimationKey)
  const [view, setView] = useState<CalendarView>('day')
  const [shownMonth, setShownMonth] = useState<ShownMonth>(() => parseDate(selectedDate) ?? parseDate(getKstToday())!)
  const [pickerYear, setPickerYear] = useState(shownMonth.year)
  const [decadeStart, setDecadeStart] = useState(Math.floor(shownMonth.year / 10) * 10)
  const { data: colorScale } = useHeatmapColorScale()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const closeOnScroll = useCallback(() => setIsOpen(false), [])
  const position = usePopupPosition(isOpen, setIsOpen, triggerRef, popupRef, undefined, 0.8, false, false)
  const popupBounds = usePopupBounds(isOpen, position !== null, triggerRef, popupRef, POPUP_WIDTH, closeOnScroll)

  useEffect(() => {
    if (dateAnimationKey === undefined || previousDateAnimationKey.current === dateAnimationKey) return
    previousDateAnimationKey.current = dateAnimationKey
    setIsDateHighlighted(true)
    const timer = window.setTimeout(() => setIsDateHighlighted(false), 1500)
    return () => window.clearTimeout(timer)
  }, [dateAnimationKey])

  const toggleCalendar = () => {
    if (disabled) return
    if (isOpen) {
      setIsOpen(false)
      return
    }
    const initialMonth = parseDate(selectedDate) ?? parseDate(getKstToday())!
    setShownMonth(initialMonth)
    setPickerYear(initialMonth.year)
    setDecadeStart(Math.floor(initialMonth.year / 10) * 10)
    setView('day')
    setIsOpen(true)
  }

  const openYearView = () => {
    const year = view === 'month' ? pickerYear : shownMonth.year
    setPickerYear(year)
    setDecadeStart(Math.floor(year / 10) * 10)
    setView('year')
  }

  const firstWeekday = new Date(Date.UTC(shownMonth.year, shownMonth.monthIndex, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(shownMonth.year, shownMonth.monthIndex + 1, 0)).getUTCDate()
  const dayCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const cells = [...dayCells, ...Array.from({ length: 42 - dayCells.length }, () => null)]
  const currentMonthKey = `${shownMonth.year}-${String(shownMonth.monthIndex + 1).padStart(2, '0')}`
  const todayDate = getKstToday()
  const nextMonth = moveMonth(shownMonth, 1)
  const canMovePrevious = currentMonthKey > `${MIN_YEAR}-01`
  const canMoveNext = nextMonth.year <= MAX_YEAR
  const holidayColor = colorScale ? resolveHeatmapColor(8, colorScale) : undefined

  const selectDay = (day: number) => {
    onSelect(toDateKey(shownMonth.year, shownMonth.monthIndex, day))
    setIsOpen(false)
  }

  const selectToday = () => {
    const today = getKstToday()
    onSelect(today)
    setShownMonth(parseDate(today)!)
    setIsOpen(false)
  }

  let popupLeft = 8
  let popupWidth = POPUP_WIDTH
  if (position && typeof window !== 'undefined') {
    popupWidth = Math.min(POPUP_WIDTH, window.innerWidth - 16)
    popupLeft = Math.max(8, Math.min(position.left, window.innerWidth - popupWidth - 8))
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label} 날짜 선택 ${displayValue || '날짜 미선택'}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={toggleCalendar}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        className={`relative flex h-[25px] w-[140px] shrink-0 items-center rounded-[4px] border-0 pl-6 pr-1 text-left text-[13px]/[16px] font-medium tabular-nums text-ui-white transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-35 ${isOpen ? 'bg-brand-surface hover:bg-brand-surface-hover' : isHovered ? 'bg-ui-control-hover' : 'bg-[var(--ui-control)]'}`}
      >
        <CalendarIcon aria-hidden="true" className="absolute left-[5px] h-3.5 w-3.5 text-ui-white" />
        <span className={`truncate transition-colors duration-300 ${isDateHighlighted ? 'text-[var(--brand)]' : ''}`}>{displayValue || 'yyyy. mm. dd.'}</span>
      </button>
      {isOpen && position && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={`${label} 날짜 선택 달력`}
          data-banner-date-picker=""
          style={{
            position: 'fixed',
            top: popupBounds?.top ?? position.top + (position.openUpward ? -DROPDOWN_GAP_PX : DROPDOWN_GAP_PX),
            left: popupBounds?.left ?? popupLeft,
            width: popupBounds?.width ?? popupWidth,
            maxHeight: popupBounds ? `${popupBounds.maxHeight}px` : undefined,
            overflowY: popupBounds ? 'auto' : undefined,
            visibility: popupBounds?.visible === false ? 'hidden' : undefined,
          }}
          className="z-50 rounded-md border border-ui-border bg-ui-panel p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="mb-2 flex justify-end border-b border-ui-border pb-2">
            <button
              type="button"
              onClick={selectToday}
              className="flex h-6 shrink-0 items-center justify-center rounded border-0 bg-ui-control px-2.5 text-center text-[13px] font-semibold leading-none text-ui-white transition-colors hover:bg-ui-control-hover"
            >
              오늘
            </button>
          </div>
          <div className="relative w-full min-w-0">
            {view === 'day' && (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center">
                    <button type="button" aria-label="이전 해" disabled={shownMonth.year <= MIN_YEAR} onClick={() => setShownMonth(month => moveMonth(month, -12))} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted">
                      <ChevronDownIcon className="h-4 w-4 rotate-90" />
                      <ChevronDownIcon className="-ml-2.5 h-4 w-4 rotate-90" />
                    </button>
                    <button type="button" aria-label="이전 달" disabled={!canMovePrevious} onClick={() => setShownMonth(month => moveMonth(month, -1))} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted">
                      <ChevronDownIcon className="h-4 w-4 rotate-90" />
                    </button>
                  </span>
                  <span className="flex items-center gap-1">
                    <button type="button" aria-label="년 선택" onClick={openYearView} className="border-0 bg-transparent p-0 font-roboto-latin font-semibold tabular-nums text-ui-white hover:text-brand">{shownMonth.year}년</button>
                    <button type="button" aria-label="월 선택" onClick={() => { setPickerYear(shownMonth.year); setView('month') }} className="border-0 bg-transparent p-0 font-roboto-latin font-semibold tabular-nums text-ui-white hover:text-brand">{shownMonth.monthIndex + 1}월</button>
                  </span>
                  <span className="flex items-center">
                    <button type="button" aria-label="다음 달" disabled={!canMoveNext} onClick={() => setShownMonth(month => moveMonth(month, 1))} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted">
                      <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                    </button>
                    <button type="button" aria-label="다음 해" disabled={shownMonth.year >= MAX_YEAR} onClick={() => setShownMonth(month => moveMonth(month, 12))} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted">
                      <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                      <ChevronDownIcon className="-ml-2.5 h-4 w-4 -rotate-90" />
                    </button>
                  </span>
                </div>
                <div className="flex min-h-[13.5rem] flex-col">
                  <div className="mb-0.5 grid grid-cols-7 border-b border-ui-border text-center text-[13px] font-semibold text-ui-muted">
                    {WEEKDAY_LABELS.map(day => <span key={day} className="py-1">{day}</span>)}
                  </div>
                  <div className="grid flex-1 grid-cols-7 grid-rows-6 text-center font-roboto-latin tabular-nums">
                    {cells.map((day, index) => {
                      if (day === null) return <span key={`blank-${index}`} />
                      const date = toDateKey(shownMonth.year, shownMonth.monthIndex, day)
                      const isToday = date === todayDate
                      const isSelected = date === selectedDate
                      const weekday = (firstWeekday + day - 1) % 7
                      const isHoliday = weekday === 0 || weekday === 6 || KOREAN_PUBLIC_HOLIDAY_DATES.has(date)
                      return (
                        <div key={date} className="my-0.5 flex h-7 items-center justify-center">
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            aria-current={isToday ? 'date' : undefined}
                            onClick={() => selectDay(day)}
                            className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-transparent ${
                              isSelected
                                ? 'bg-brand font-semibold text-ui-surface'
                                : isToday ? 'bg-brand-surface font-semibold text-ui-white hover:bg-brand hover:text-ui-surface' : `bg-transparent hover:bg-brand hover:text-ui-surface ${isHoliday ? holidayColor ? '' : 'text-ui-muted' : 'text-ui-white'}`
                            }`}
                            style={!isSelected && !isToday && isHoliday && holidayColor ? { color: holidayColor } : undefined}
                          >
                            {day}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
            {view === 'month' && (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <button type="button" aria-label="이전 해" disabled={pickerYear <= MIN_YEAR} onClick={() => setPickerYear(year => year - 1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted"><ChevronDownIcon className="h-4 w-4 rotate-90" /></button>
                  <button type="button" aria-label="년 선택" onClick={openYearView} className="border-0 bg-transparent p-0 font-roboto-latin font-semibold tabular-nums text-ui-white hover:text-brand">{pickerYear}년</button>
                  <button type="button" aria-label="다음 해" disabled={pickerYear >= MAX_YEAR} onClick={() => setPickerYear(year => year + 1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted"><ChevronDownIcon className="h-4 w-4 -rotate-90" /></button>
                </div>
                <div role="group" aria-label="월 선택" className="grid min-h-[13.5rem] grid-cols-4 content-center gap-y-3 font-roboto-latin tabular-nums">
                  {Array.from({ length: 12 }, (_, monthIndex) => (
                    <button key={monthIndex} type="button" aria-pressed={pickerYear === shownMonth.year && monthIndex === shownMonth.monthIndex} onClick={() => { setShownMonth({ year: pickerYear, monthIndex }); setView('day') }} className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border-0 ${pickerYear === shownMonth.year && monthIndex === shownMonth.monthIndex ? 'bg-ui-control font-semibold text-ui-white hover:bg-brand-surface' : 'bg-transparent text-ui-white hover:bg-brand-surface'}`}>{monthIndex + 1}월</button>
                  ))}
                </div>
              </>
            )}
            {view === 'year' && (
              <>
                <div className="mb-1 flex items-center justify-between">
                  <button type="button" aria-label="이전 10년" disabled={decadeStart <= MIN_YEAR} onClick={() => setDecadeStart(start => start - 10)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted"><ChevronDownIcon className="h-4 w-4 rotate-90" /></button>
                  <span className="font-roboto-latin font-semibold tabular-nums">{decadeStart} - {decadeStart + 9}</span>
                  <button type="button" aria-label="다음 10년" disabled={decadeStart + 10 > MAX_YEAR} onClick={() => setDecadeStart(start => start + 10)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-ui-white disabled:cursor-not-allowed disabled:text-ui-muted"><ChevronDownIcon className="h-4 w-4 -rotate-90" /></button>
                </div>
                <div role="group" aria-label="년 선택 목록" className="grid min-h-[13.5rem] grid-cols-4 content-center gap-y-3 font-roboto-latin tabular-nums">
                  {Array.from({ length: 12 }, (_, offset) => decadeStart - 1 + offset).map(year => (
                    <button key={year} type="button" disabled={year < MIN_YEAR || year > MAX_YEAR} aria-pressed={year === shownMonth.year} onClick={() => { setPickerYear(year); setDecadeStart(Math.floor(year / 10) * 10); setView('month') }} className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border-0 ${year === shownMonth.year ? 'bg-ui-control font-semibold text-ui-white hover:bg-brand-surface' : year < MIN_YEAR || year > MAX_YEAR ? 'cursor-not-allowed bg-transparent text-ui-muted' : 'bg-transparent text-ui-white hover:bg-brand-surface'}`}>{year}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
