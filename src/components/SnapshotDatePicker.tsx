import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CalendarIcon, ChevronDownIcon } from '@/components/icons/MarketMapIcons'
import { FILLED_ICON_CLASS } from '@/components/NavBarPageActions'
import { useMarketMapSnapshotDays } from '@/hooks/useMarketMap'
import Spinner from '@/components/Spinner'
import { toMarketMapSnapshotDateLabel } from '@/utils/format'
import type { MarketQuery } from '@/types/api'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  market: MarketQuery
  // 지금 화면에 보이는 지도의 스냅샷 시각(ISO). 달력이 처음 보여 줄 달과 선택 표시를 정한다.
  viewedSnapshotTime: string | null
  // 실시간(최신) 지도의 스냅샷 시각. 이 날짜를 고르면 지난 날짜가 아니라 실시간으로 돌아간다.
  liveSnapshotTime: string | null
  // 지난 날짜의 종가 스냅샷 시각, 또는 실시간으로 돌아가려면 null.
  onSelectSnapshotTime: (snapshotTime: string | null) => void
  // 기간 등락률 — 시작일·끝일의 종가 스냅샷 시각(시작일이 앞선다). 기간을 보는 중이면 시작일의 스냅샷 시각이 rangeStartTime으로 들어온다.
  // onSelectRange를 주지 않으면 "기간" 스위치가 없다.
  onSelectRange?: (startSnapshotTime: string, endSnapshotTime: string) => void
  rangeStartTime?: string
  // 지난 날짜를 보는 중이면(아이콘이 이미 청록색) 마우스를 올릴 때 원래 회색으로 바뀐다. 실시간에서는 반대로 청록색이 된다.
  isPast: boolean
  // 달력 아이콘 옆에 놓을 날짜 글자 — 누르는 버튼은 달력 아이콘뿐이고 글자는 눌리지 않는다.
  children: ReactNode
}

interface ShownMonth {
  year: number
  monthIndex: number
}

interface PickedDay {
  date: string
  snapshotTime: string
}

const toShownMonth = (isoDate: string): ShownMonth => ({
  year: Number(isoDate.slice(0, 4)),
  monthIndex: Number(isoDate.slice(5, 7)) - 1,
})

const toMonthKey = ({ year, monthIndex }: ShownMonth) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`

const addMonths = (month: ShownMonth, delta: number): ShownMonth => {
  const moved = new Date(month.year, month.monthIndex + delta, 1)
  return { year: moved.getFullYear(), monthIndex: moved.getMonth() }
}

// 월 선택 화면의 한 칸 — 그 달의 종가 지도 목록을 받아서 비어 있으면(데이터가 없는 달) 누르지 못하게 한다. 받기 전이나 오류일 때는 막지 않는다.
function MonthChoice({ market, month, isCurrent, isAllowed, onChoose }: { market: MarketQuery; month: ShownMonth; isCurrent: boolean; isAllowed: boolean; onChoose: () => void }) {
  const { data: days } = useMarketMapSnapshotDays(market, toMonthKey(month), { retry: 1 })
  const isEmpty = days !== undefined && days.length === 0
  const disabled = !isAllowed || isEmpty
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isCurrent}
      onClick={onChoose}
      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border-0 ${
        isCurrent ? 'bg-[var(--accent)] font-semibold text-black' : disabled ? 'cursor-not-allowed bg-transparent text-gray-600' : 'bg-transparent text-gray-200 hover:bg-white/10'
      }`}
    >
      {month.monthIndex + 1}월
    </button>
  )
}

type MonthGridView = 'day' | 'month' | 'year'

interface MonthGridProps {
  market: MarketQuery
  // 보여 줄 달 — 위에서 정해 주고, 이전·다음 달 버튼은 onMoveMonth로 알린다(기간 달력은 두 달이 함께 움직인다).
  month: ShownMonth
  onMoveMonth: (delta: number) => void
  // 월·년 선택 화면에서 고른 달로 옮긴다.
  onSetMonth: (month: ShownMonth) => void
  // 이 달로 옮겨도 되는지(실시간 달보다 뒤나 데이터가 없는 쪽으로 가지 못하게 한다).
  isMonthAllowed: (month: ShownMonth) => boolean
  showPrevButton?: boolean
  showNextButton?: boolean
  liveDate: string | null
  // 눌러도 되는 날인지 — 종가 지도가 있는지, 1거래일 전 종가가 있는지(맨 처음 데이터 날은 없다)를 함께 알려 준다.
  isSelectable: (date: string, hasClosingMap: boolean, hasPreviousDay: boolean) => boolean
  isSelected: (date: string) => boolean
  // 기간(시작일~끝일)을 이어진 띠로 칠할 때의 양 끝 날짜. 둘 다 있고 서로 다른 날일 때만 띠가 그려진다.
  bandStart: string | null
  bandEnd: string | null
  // 누른 날짜와, 그날 종가 지도의 스냅샷 시각(없는 날이면 undefined).
  onPick: (date: string, snapshotTime: string | undefined) => void
}

// 한 달짜리 달력. 그 달의 종가 지도 목록 조회·불러오는 중/오류 화면을 스스로 맡는다.
function MonthGrid({ market, month, onMoveMonth, onSetMonth, isMonthAllowed, showPrevButton = true, showNextButton = true, liveDate, isSelectable, isSelected, bandStart, bandEnd, onPick }: MonthGridProps) {
  const monthKey = toMonthKey(month)
  // 월·년 선택 화면 — 날짜 화면의 "10월"을 누르면 월 선택, "2026년"을 누르면 년 선택이 나온다. 년을 고르면 그 해의 월 선택으로, 월을 고르면 날짜 화면으로 돌아온다.
  const [view, setView] = useState<MonthGridView>('day')
  const [pickerYear, setPickerYear] = useState(month.year)
  const [decadeStart, setDecadeStart] = useState(Math.floor(month.year / 10) * 10)
  const liveYear = liveDate === null ? null : Number(liveDate.slice(0, 4))
  const openView = (next: MonthGridView) => {
    setPickerYear(month.year)
    setDecadeStart(Math.floor(month.year / 10) * 10)
    setView(next)
  }
  // 서버 오류가 계속되면 기본 재시도(3회)가 달력을 30초 넘게 기다리게 하므로 1번만 다시 시도하고, 그 뒤에는 "다시 시도"로 받는다.
  const { data: days, isLoading, isError, refetch } = useMarketMapSnapshotDays(market, monthKey, { retry: 1 })
  const closingTimeByDate = new Map((days ?? []).map(day => [day.date, day.snapshotTime]))
  // 이전 달 목록도 함께 본다 — 데이터가 없는 달로는 넘어가지 못하게 하고, 앞선 거래일이 있는지도 따진다.
  const previousMonthKey = toMonthKey(addMonths(month, -1))
  const { data: previousMonthDays, isSuccess: isPreviousMonthLoaded } = useMarketMapSnapshotDays(market, previousMonthKey, { retry: 1 })
  // 이전 달 목록을 받았는데 비어 있으면 그 달로는 넘어가지 않는다(받기 전이나 오류일 때는 막지 않는다).
  const isPreviousMonthEmpty = isPreviousMonthLoaded && previousMonthDays.length === 0
  const firstDataDate = [...(previousMonthDays ?? []), ...(days ?? [])].map(day => day.date).sort()[0] ?? null
  const hasPreviousDay = (date: string) => firstDataDate !== null && date > firstDataDate

  // 실시간 날짜가 속한 달보다 뒤로는 데이터가 없다.
  const isNextMonthDisabled = liveDate !== null && monthKey >= liveDate.slice(0, 7)

  const firstWeekday = new Date(month.year, month.monthIndex, 1).getDay()
  const daysInMonth = new Date(month.year, month.monthIndex + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  return (
    <div className="w-60 shrink-0">
      {view === 'day' && (
        <>
          <div className="mb-1 flex items-center justify-between">
            {showPrevButton ? (
              <button type="button" aria-label="이전 달" disabled={isPreviousMonthEmpty} onClick={() => onMoveMonth(-1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600">
                <ChevronDownIcon className="h-4 w-4 rotate-90" />
              </button>
            ) : <span className="h-7 w-7" />}
            {/* 년을 누르면 년 선택, 월을 누르면 월 선택이 나온다. */}
            <span className="flex items-center gap-1">
              <button type="button" aria-label="년 선택" onClick={() => openView('year')} className="border-0 bg-transparent p-0 font-roboto-latin font-semibold tabular-nums text-white hover:text-[var(--accent)]">{month.year}년</button>
              <button type="button" aria-label="월 선택" onClick={() => openView('month')} className="border-0 bg-transparent p-0 font-roboto-latin font-semibold tabular-nums text-white hover:text-[var(--accent)]">{month.monthIndex + 1}월</button>
            </span>
            {showNextButton ? (
              <button type="button" aria-label="다음 달" disabled={isNextMonthDisabled} onClick={() => onMoveMonth(1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600">
                <ChevronDownIcon className="h-4 w-4 -rotate-90" />
              </button>
            ) : <span className="h-7 w-7" />}
          </div>
          <div className="min-h-[13.5rem]">
        <div className="grid grid-cols-7 text-center text-xs text-gray-400">
          {WEEKDAY_LABELS.map(label => (
            <span key={label} className="py-1">{label}</span>
          ))}
        </div>
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#363639]">
              <Spinner showElapsed compact className="h-36 w-36" />
            </div>
          )}
          <div className="grid grid-cols-7 text-center font-roboto-latin tabular-nums" aria-busy={isLoading}>
            {cells.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />
              const date = `${monthKey}-${String(day).padStart(2, '0')}`
              const hasClosingMap = closingTimeByDate.has(date)
              const selectable = isSelectable(date, hasClosingMap, hasPreviousDay(date))
              const selected = isSelected(date)
              // 이미 지나간 날인데 지도가 없는 날(주말·휴장일 등)은 빨간 숫자로 알린다. 불러오는 중이거나 아직 오지 않은 날은 회색 그대로.
              const isMissing = selectable === false && hasClosingMap === false && isLoading === false && isError === false && liveDate !== null && date <= liveDate
              // 기간 띠 — 시작일은 오른쪽 절반, 끝일은 왼쪽 절반, 그 사이 날은 칸 전체를 칠한다. 줄이 바뀌는 곳(일요일·1일 / 토요일·말일)은 끝을 둥글게 한다.
              const hasBand = bandStart !== null && bandEnd !== null && bandStart < bandEnd && date >= bandStart && date <= bandEnd
              const weekday = (firstWeekday + day - 1) % 7
              const bandShape = date === bandStart ? 'left-1/2 right-0' : date === bandEnd ? 'left-0 right-1/2' : `inset-x-0 ${weekday === 0 || day === 1 ? 'rounded-l-full' : ''} ${weekday === 6 || day === daysInMonth ? 'rounded-r-full' : ''}`
              return (
                <div key={date} className="relative my-0.5 flex h-7 items-center justify-center">
                  {hasBand && <span aria-hidden="true" className={`absolute inset-y-0 bg-[var(--accent)]/25 ${bandShape}`} />}
                  <button
                    type="button"
                    disabled={selectable === false}
                    aria-pressed={selected}
                    onClick={() => onPick(date, closingTimeByDate.get(date))}
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full border-0 ${
                      selected
                        ? 'bg-[var(--accent)] font-semibold text-black'
                        : selectable
                          ? 'bg-transparent text-gray-200 hover:bg-white/10'
                          : `cursor-not-allowed bg-transparent ${isMissing ? 'text-red-500/70' : 'text-gray-600'}`
                    }`}
                  >
                    {day}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
          </div>
        </>
      )}
      {view === 'month' && (
        <>
          <div className="mb-1 flex items-center justify-between">
            <button type="button" aria-label="이전 해" disabled={pickerYear <= 2000} onClick={() => setPickerYear(year => year - 1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600">
              <ChevronDownIcon className="h-4 w-4 rotate-90" />
            </button>
            <button type="button" aria-label="년 선택" onClick={() => { setDecadeStart(Math.floor(pickerYear / 10) * 10); setView('year') }} className="border-0 bg-transparent p-0 font-roboto-latin font-semibold tabular-nums text-white hover:text-[var(--accent)]">{pickerYear}년</button>
            <button type="button" aria-label="다음 해" disabled={liveYear !== null && pickerYear >= liveYear} onClick={() => setPickerYear(year => year + 1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600">
              <ChevronDownIcon className="h-4 w-4 -rotate-90" />
            </button>
          </div>
          <div className="grid min-h-[13.5rem] grid-cols-4 content-center gap-y-3 font-roboto-latin tabular-nums" role="group" aria-label="월 선택">
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const choice = { year: pickerYear, monthIndex }
              return (
                <MonthChoice
                  key={monthIndex}
                  market={market}
                  month={choice}
                  isCurrent={choice.year === month.year && choice.monthIndex === month.monthIndex}
                  isAllowed={isMonthAllowed(choice)}
                  onChoose={() => { onSetMonth(choice); setView('day') }}
                />
              )
            })}
          </div>
        </>
      )}
      {view === 'year' && (
        <>
          <div className="mb-1 flex items-center justify-between">
            <button type="button" aria-label="이전 10년" disabled={decadeStart <= 2000} onClick={() => setDecadeStart(start => start - 10)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600">
              <ChevronDownIcon className="h-4 w-4 rotate-90" />
            </button>
            <span className="font-roboto-latin font-semibold tabular-nums">{decadeStart} - {decadeStart + 9}</span>
            <button type="button" aria-label="다음 10년" disabled={liveYear !== null && decadeStart + 10 > liveYear} onClick={() => setDecadeStart(start => start + 10)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600">
              <ChevronDownIcon className="h-4 w-4 -rotate-90" />
            </button>
          </div>
          <div className="grid min-h-[13.5rem] grid-cols-4 content-center gap-y-3 font-roboto-latin tabular-nums" role="group" aria-label="년 선택 목록">
            {/* 올해가 마지막이다 — 그 뒤 연도는 칸 자체를 그리지 않는다. */}
            {Array.from({ length: 12 }, (_, offset) => decadeStart - 1 + offset).filter(year => liveYear === null || year <= liveYear).map(year => {
              const disabled = year < 2000
              const isOutsideDecade = year < decadeStart || year > decadeStart + 9
              return (
                <button
                  key={year}
                  type="button"
                  disabled={disabled}
                  aria-pressed={year === month.year}
                  onClick={() => { setPickerYear(year); setView('month') }}
                  className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border-0 ${
                    year === month.year ? 'bg-[var(--accent)] font-semibold text-black' : disabled ? 'cursor-not-allowed bg-transparent text-gray-700' : isOutsideDecade ? 'bg-transparent text-gray-500 hover:bg-white/10' : 'bg-transparent text-gray-200 hover:bg-white/10'
                  }`}
                >
                  {year}
                </button>
              )
            })}
          </div>
        </>
      )}
      {isError && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
          불러오지 못했습니다
          <button type="button" onClick={() => void refetch()} className="border-0 bg-transparent p-0 text-[var(--accent)] hover:underline">
            다시 시도
          </button>
        </p>
      )}
    </div>
  )
}

const APPLY_BUTTON_CLASS =
  'shrink-0 rounded-sm border border-[var(--accent)] bg-[var(--accent)] px-1.5 py-0.5 text-center text-xs font-medium leading-none text-black hover:brightness-110 disabled:cursor-not-allowed disabled:border-gray-600 disabled:bg-transparent disabled:text-gray-600 disabled:hover:brightness-100'

// 달력 아이콘을 누르면 아래로 달력 창이 뜬다. 데이터가 있는 날짜(종가 지도가 있는 날과 오늘)만 누를 수 있다.
// 날짜를 골라도 대기 상태로만 두고 "적용"을 눌러야 지도가 바뀐다.
// "기간"을 켜면 이어진 두 달이 나란히 뜨고(이전·다음 달 버튼은 두 달을 함께 움직인다), 첫 번째로 누른 날이 시작, 두 번째가 종료다.
export default function SnapshotDatePicker({ market, viewedSnapshotTime, liveSnapshotTime, onSelectSnapshotTime, onSelectRange, rangeStartTime, isPast, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const anchorDate = (viewedSnapshotTime ?? liveSnapshotTime)?.slice(0, 10) ?? null
  const liveDate = liveSnapshotTime?.slice(0, 10) ?? null
  const isViewingRange = onSelectRange !== undefined && rangeStartTime !== undefined && viewedSnapshotTime !== null
  const rangeStartDate = rangeStartTime?.slice(0, 10) ?? null // 기간을 보는 중인지 가리는 데만 쓴다

  const [isRangeMode, setIsRangeMode] = useState(false)
  // 하루 고르기 — snapshotTime이 null이면 실시간(오늘)이다.
  const [draftDay, setDraftDay] = useState<{ date: string; snapshotTime: string | null } | null>(null)
  // 기간 고르기 — 시작·종료 대기 값.
  const [draftStart, setDraftStart] = useState<PickedDay | null>(null)
  const [draftEnd, setDraftEnd] = useState<PickedDay | null>(null)
  // 하루 달력의 달, 기간 달력의 왼쪽 달(오른쪽은 그 다음 달).
  const [singleMonth, setSingleMonth] = useState<ShownMonth>(() => toShownMonth(new Date().toISOString()))
  const [rangeLeftMonth, setRangeLeftMonth] = useState<ShownMonth>(() => toShownMonth(new Date().toISOString()))

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // 기간 달력을 열 때 — 이미 기간을 보는 중이면 그 시작·종료를 채우고, 아니면 비운다. 오른쪽 달은 종료(또는 지금 보는 날)가 있는 달, 왼쪽은 그 전 달이다.
  const prepareRange = () => {
    if (isViewingRange) {
      setDraftStart({ date: rangeStartTime.slice(0, 10), snapshotTime: rangeStartTime })
      setDraftEnd({ date: viewedSnapshotTime.slice(0, 10), snapshotTime: viewedSnapshotTime })
    } else {
      setDraftStart(null)
      setDraftEnd(null)
    }
    setRangeLeftMonth(addMonths(toShownMonth(anchorDate ?? new Date().toISOString()), -1))
  }

  const toggleOpen = () => {
    setDraftDay(null)
    if (isOpen) {
      setIsOpen(false)
      return
    }
    setSingleMonth(toShownMonth(anchorDate ?? new Date().toISOString()))
    prepareRange()
    setIsRangeMode(isViewingRange)
    setIsOpen(true)
  }

  const switchMode = (toRange: boolean) => {
    if (toRange === isRangeMode) return
    setDraftDay(null)
    if (toRange) prepareRange()
    else setSingleMonth(toShownMonth(anchorDate ?? new Date().toISOString()))
    setIsRangeMode(toRange)
  }

  const isRangeCalendar = isRangeMode && onSelectRange !== undefined
  // 실시간 지도가 있는 달보다 뒤로는 갈 수 없다.
  const isMonthWithinLive = (month: ShownMonth) => liveDate === null || toMonthKey(month) <= liveDate.slice(0, 7)

  // ── 하루 고르기 ──
  const pickSingleDay = (date: string, snapshotTime: string | undefined) => {
    if (date === liveDate) setDraftDay({ date, snapshotTime: null })
    else if (snapshotTime !== undefined) setDraftDay({ date, snapshotTime })
  }
  const applyDay = () => {
    if (draftDay === null) return
    onSelectSnapshotTime(draftDay.snapshotTime)
    setIsOpen(false)
  }

  // ── 기간 고르기 ──
  // 첫 번째로 누른 날이 시작, 두 번째가 종료다. 시작보다 앞선 날을 두 번째로 누르면 그 날이 시작이 되고 앞서 누른 날이 종료가 된다.
  // 둘 다 정해진 뒤에 누르면 새로 시작한다.
  const pickRangeDay = (date: string, snapshotTime: string | undefined) => {
    if (snapshotTime === undefined) return
    const picked = { date, snapshotTime }
    if (draftStart !== null && draftEnd === null) {
      if (date >= draftStart.date) setDraftEnd(picked)
      else {
        setDraftEnd(draftStart)
        setDraftStart(picked)
      }
    } else if (draftStart === null && draftEnd !== null) {
      if (date <= draftEnd.date) setDraftStart(picked)
      else {
        setDraftStart(draftEnd)
        setDraftEnd(picked)
      }
    } else {
      setDraftStart(picked)
      setDraftEnd(null)
    }
  }
  // 이 날이 시작이 될 수 있는지(=1거래일 전 종가가 필요한지)에 따라 눌러도 되는 날을 정한다.
  const isRangeDaySelectable = (date: string, hasClosingMap: boolean, hasPreviousDay: boolean) => {
    if (!hasClosingMap) return false
    if (draftStart !== null && draftEnd === null) return date >= draftStart.date || hasPreviousDay
    if (draftStart === null && draftEnd !== null) return date > draftEnd.date || hasPreviousDay
    return hasPreviousDay
  }
  const applyRange = () => {
    if (!onSelectRange || draftStart === null || draftEnd === null) return
    onSelectRange(draftStart.snapshotTime, draftEnd.snapshotTime)
    setIsOpen(false)
  }

  // ── 지금 버튼 — 날짜 칸을 가장 최근 지도의 날짜로 채운다(적용을 눌러야 지도가 바뀐다). 하루는 실시간이고, 기간은 종료가 된다. ──
  // 최근 거래일의 종가 지도가 있으면 그 시각, 아직 없으면(장중) 실시간 지도의 시각을 종료로 쓴다.
  const { data: liveMonthDays } = useMarketMapSnapshotDays(market, liveDate?.slice(0, 7) ?? '', { enabled: isOpen && isRangeCalendar && liveDate !== null, retry: 1 })
  const pickToday = () => {
    if (liveDate === null) return
    if (isRangeCalendar) {
      const snapshotTime = liveMonthDays?.find(day => day.date === liveDate)?.snapshotTime ?? liveSnapshotTime
      if (snapshotTime === null) return
      setDraftEnd({ date: liveDate, snapshotTime })
      setRangeLeftMonth(addMonths(toShownMonth(liveDate), -1))
    } else {
      setDraftDay({ date: liveDate, snapshotTime: null })
      setSingleMonth(toShownMonth(liveDate))
    }
  }

  const dayLabel = draftDay
    ? (draftDay.snapshotTime ? toMarketMapSnapshotDateLabel(draftDay.snapshotTime) : `${draftDay.date} (${WEEKDAY_LABELS[new Date(`${draftDay.date}T00:00:00`).getDay()]})`)
    : '-'

  return (
    <span ref={rootRef} className="relative z-40 flex items-center gap-1">
      <button
        type="button"
        aria-label="날짜 선택"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggleOpen}
        className={`flex items-center border-0 bg-transparent p-0 outline-none ${isPast ? 'text-inherit hover:text-gray-400 focus-visible:text-gray-400' : `hover:text-[var(--brand)] focus-visible:text-[var(--brand)] ${isOpen ? 'text-[var(--brand)]' : 'text-inherit'}`}`}
      >
        <CalendarIcon className={`h-[15px] w-[15px] shrink-0 ${isOpen ? FILLED_ICON_CLASS : ''}`} aria-hidden />
      </button>
      {children}
      {isOpen && (
        <div
          role="dialog"
          aria-label="날짜 선택 달력"
          className="absolute left-0 top-full z-50 mt-[7px] w-max rounded-md border border-gray-500 bg-[#363639] p-2 text-sm font-normal tracking-normal text-white shadow-xl"
        >
          {/* 위쪽 줄: 왼쪽 하루/기간 스위치, 오른쪽 지금(날짜 칸을 가장 최근 지도 날짜로 채운다). */}
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-500 pb-2 text-xs">
            <span>
              {onSelectRange && (
                <span role="radiogroup" aria-label="선택 방식" className="inline-flex overflow-hidden rounded-sm border border-[var(--accent)]">
                  {([['하루', false], ['기간', true]] as const).map(([label, rangeValue]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={isRangeMode === rangeValue}
                      onClick={() => switchMode(rangeValue)}
                      className={`border-0 px-1.5 py-0.5 text-xs font-medium leading-none ${isRangeMode === rangeValue ? 'bg-[var(--accent)] text-black' : 'bg-transparent text-[var(--accent)] hover:bg-white/10'}`}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={pickToday}
              className="w-[2.05rem] shrink-0 rounded-sm border border-[var(--accent)] bg-transparent px-0 py-0.5 text-center text-xs font-medium leading-none text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
            >
              지금
            </button>
          </div>
          {isRangeCalendar ? (
            <>
              <div className="flex gap-4">
                <MonthGrid
                  market={market}
                  month={rangeLeftMonth}
                  onMoveMonth={delta => setRangeLeftMonth(month => addMonths(month, delta))}
                  onSetMonth={month => setRangeLeftMonth(month)}
                  isMonthAllowed={month => isMonthWithinLive(addMonths(month, 1))}
                  showNextButton={false}
                  liveDate={liveDate}
                  isSelectable={isRangeDaySelectable}
                  isSelected={date => date === draftStart?.date || date === draftEnd?.date}
                  bandStart={draftStart?.date ?? null}
                  bandEnd={draftEnd?.date ?? null}
                  onPick={pickRangeDay}
                />
                <MonthGrid
                  market={market}
                  month={addMonths(rangeLeftMonth, 1)}
                  onMoveMonth={delta => setRangeLeftMonth(month => addMonths(month, delta))}
                  onSetMonth={month => setRangeLeftMonth(addMonths(month, -1))}
                  isMonthAllowed={isMonthWithinLive}
                  showPrevButton={false}
                  liveDate={liveDate}
                  isSelectable={isRangeDaySelectable}
                  isSelected={date => date === draftStart?.date || date === draftEnd?.date}
                  bandStart={draftStart?.date ?? null}
                  bandEnd={draftEnd?.date ?? null}
                  onPick={pickRangeDay}
                />
              </div>
              <div className="mt-1 flex gap-4 border-t border-gray-500 pt-2 text-xs">
                {/* 시작은 왼쪽 달력 왼쪽, 종료는 오른쪽 달력 왼쪽에 놓고 고른 날짜를 오른쪽에 적는다. 적용은 맨 오른쪽 끝이다. */}
                <div className="flex w-60 shrink-0 items-center gap-2">
                  <span className="text-[var(--accent)]">시작</span>
                  <span className="text-gray-200">{draftStart ? toMarketMapSnapshotDateLabel(draftStart.snapshotTime) : '-'}</span>
                </div>
                <div className="flex w-60 shrink-0 items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-[var(--accent)]">종료</span>
                    <span className="text-gray-200">{draftEnd ? toMarketMapSnapshotDateLabel(draftEnd.snapshotTime) : '-'}</span>
                  </span>
                  <button type="button" disabled={draftStart === null || draftEnd === null} onClick={applyRange} className={APPLY_BUTTON_CLASS}>
                    적용
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <MonthGrid
                market={market}
                month={singleMonth}
                onMoveMonth={delta => setSingleMonth(month => addMonths(month, delta))}
                onSetMonth={setSingleMonth}
                isMonthAllowed={isMonthWithinLive}
                liveDate={liveDate}
                isSelectable={(date, hasClosingMap) => date === liveDate || hasClosingMap}
                // 하루 달력은 날짜 하나를 새로 고르는 화면이라, 기간을 보는 중이어도 그 기간의 띠나 시작·끝 표시를 보여 주지 않는다.
                isSelected={date => (draftDay ? date === draftDay.date : rangeStartDate === null && date === anchorDate)}
                bandStart={null}
                bandEnd={null}
                onPick={pickSingleDay}
              />
              <div className="mt-1 flex w-60 items-center justify-between gap-2 border-t border-gray-500 pt-2 text-xs">
                <span className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">날짜</span>
                  <span className="text-gray-200">{dayLabel}</span>
                </span>
                <button type="button" disabled={draftDay === null} onClick={applyDay} className={APPLY_BUTTON_CLASS}>
                  적용
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </span>
  )
}
