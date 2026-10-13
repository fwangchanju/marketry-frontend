import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CalendarIcon, ChevronDownIcon, ClockIcon } from '@/components/icons/MarketMapIcons'
import { FILLED_ICON_CLASS } from '@/components/NavBarPageActions'
import { useMarketMapSnapshotDays, useTradingDayGap } from '@/hooks/useMarketMap'
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
  // 기간 등락률 — 시작일·종료일의 종가 스냅샷 시각(시작일이 앞선다). 기간을 보는 중이면 시작일의 스냅샷 시각이 rangeStartTime으로 들어온다.
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

const maxMonth = (a: ShownMonth, b: ShownMonth) => (toMonthKey(a) >= toMonthKey(b) ? a : b)

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
        isCurrent ? 'bg-cyan-700 font-semibold text-white' : disabled ? 'cursor-not-allowed bg-transparent text-gray-600' : 'bg-transparent text-gray-200 hover:bg-white/10'
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
  // 기간(시작일~종료일)을 이어진 띠로 칠할 때의 양 끝 날짜. 둘 다 있고 서로 다른 날일 때만 띠가 그려진다.
  bandStart: string | null
  bandEnd: string | null
  // 누른 날짜와, 그날 종가 지도의 스냅샷 시각(없는 날이면 undefined).
  onPick: (date: string, snapshotTime: string | undefined) => void
  // false면 불러오는 중 원을 이 달력이 그리지 않는다 — 두 달을 나란히 둘 때 바깥에서 원 하나만 가운데에 그린다.
  showSpinner?: boolean
}

// 한 달짜리 달력. 그 달의 종가 지도 목록 조회·불러오는 중/오류 화면을 스스로 맡는다.
function MonthGrid({ market, month, onMoveMonth, onSetMonth, isMonthAllowed, showPrevButton = true, showNextButton = true, liveDate, isSelectable, isSelected, bandStart, bandEnd, onPick, showSpinner = true }: MonthGridProps) {
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
          {/* 날짜 영역은 요일 줄을 뺀 나머지 높이를 모두 차지해서, 로딩 원이 그 영역 정중앙에 놓인다(날짜 줄이 5줄인 달도 마찬가지). */}
          <div className="flex min-h-[13.5rem] flex-col">
        <div className="grid grid-cols-7 text-center text-[13px] text-gray-400">
          {WEEKDAY_LABELS.map(label => (
            <span key={label} className="py-1">{label}</span>
          ))}
        </div>
        <div className="relative flex-1">
          {isLoading && showSpinner && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#363639] pt-1">
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
              // 기간 띠 — 시작일은 오른쪽 절반, 종료일은 왼쪽 절반, 그 사이 날은 칸 전체를 칠한다. 줄이 바뀌는 곳(일요일·1일 / 토요일·말일)은 끝을 둥글게 한다.
              const hasBand = bandStart !== null && bandEnd !== null && bandStart < bandEnd && date >= bandStart && date <= bandEnd
              const weekday = (firstWeekday + day - 1) % 7
              const bandShape = date === bandStart ? 'left-1/2 right-0' : date === bandEnd ? 'left-0 right-1/2' : `inset-x-0 ${weekday === 0 || day === 1 ? 'rounded-l-full' : ''} ${weekday === 6 || day === daysInMonth ? 'rounded-r-full' : ''}`
              return (
                <div key={date} className="relative my-0.5 flex h-7 items-center justify-center">
                  {hasBand && <span aria-hidden="true" className={`absolute inset-y-0 bg-cyan-700/30 ${bandShape}`} />}
                  <button
                    type="button"
                    disabled={selectable === false}
                    aria-pressed={selected}
                    onClick={() => onPick(date, closingTimeByDate.get(date))}
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full border-0 ${
                      selected
                        ? 'bg-cyan-700 font-semibold text-white'
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
                    year === month.year ? 'bg-cyan-700 font-semibold text-white' : disabled ? 'cursor-not-allowed bg-transparent text-gray-700' : isOutsideDecade ? 'bg-transparent text-gray-500 hover:bg-white/10' : 'bg-transparent text-gray-200 hover:bg-white/10'
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
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-gray-400">
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
  'shrink-0 rounded-lg border-0 bg-cyan-700 px-2.5 py-1 text-center text-[13px] font-semibold leading-none text-white transition-colors hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-cyan-700'

const RESET_BUTTON_CLASS =
  'shrink-0 rounded-lg border-0 bg-zinc-600 px-2.5 py-1 text-center text-[13px] font-semibold leading-none text-white transition-colors hover:bg-zinc-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-600'

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
  // 기간 고르기 — 시작일·종료일 대기 값.
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

  // 기간 달력을 열 때 — 이미 기간을 보는 중이면 그 시작일·종료일을 채우고, 아니면 비운다. 오른쪽 달은 종료일(또는 지금 보는 날)이 있는 달, 왼쪽은 그 전 달이다.
  const prepareRange = () => {
    if (isViewingRange) {
      setDraftStart({ date: rangeStartTime.slice(0, 10), snapshotTime: rangeStartTime })
      setDraftEnd({ date: viewedSnapshotTime.slice(0, 10), snapshotTime: viewedSnapshotTime })
    } else {
      setDraftStart(null)
      setDraftEnd(null)
    }
    // 시작일이 있는 달을 왼쪽에 두고 그 다음 달을 오른쪽에 둔다(한 달 안의 기간이면 둘 다 보인다). 종료일이 그보다 뒤면 종료일이 오른쪽 달이 되게 하고,
    // 오른쪽 달이 실시간 달을 넘지 않게 한다. 기간을 고르는 중이 아니면 오른쪽이 지금 보는 달이다.
    const endMonth = toShownMonth(viewedSnapshotTime ?? anchorDate ?? new Date().toISOString())
    const wantedLeft = isViewingRange && rangeStartTime ? maxMonth(toShownMonth(rangeStartTime), addMonths(endMonth, -1)) : addMonths(endMonth, -1)
    const latestLeft = liveDate === null ? null : addMonths(toShownMonth(liveDate), -1)
    setRangeLeftMonth(latestLeft !== null && toMonthKey(wantedLeft) > toMonthKey(latestLeft) ? latestLeft : wantedLeft)
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
  // 기간 달력은 두 달을 나란히 두므로 달마다 원이 돌지 않게 여기서 로딩을 합쳐 원 하나만 가운데에 그린다(달력 안의 조회와 같은 키라 요청은 늘지 않는다).
  const { isLoading: isRangeLeftLoading } = useMarketMapSnapshotDays(market, toMonthKey(rangeLeftMonth), { enabled: isOpen && isRangeCalendar, retry: 1 })
  const { isLoading: isRangeRightLoading } = useMarketMapSnapshotDays(market, toMonthKey(addMonths(rangeLeftMonth, 1)), { enabled: isOpen && isRangeCalendar, retry: 1 })
  const isRangeLoading = isRangeLeftLoading || isRangeRightLoading
  // 고른 기간의 거래일 수 — 시작일을 포함해 종료일까지 센다(시작일 하루 전 종가가 기준이라 시작일 하루도 기간에 든다). 시작일·종료일을 둘 다 고르기 전이나 아직 못 받았으면 비운다.
  const { data: rangeGap } = useTradingDayGap(isRangeCalendar ? (draftStart?.date ?? null) : null, isRangeCalendar ? (draftEnd?.date ?? null) : null)
  const rangeDayCount = rangeGap !== undefined && draftStart !== null && draftEnd !== null ? `${rangeGap + 1}거래일` : null
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
  // 첫 번째로 누른 날이 시작일, 두 번째가 종료일이다. 시작일보다 앞선 날을 두 번째로 누르면 그 날이 시작일이 되고 앞서 누른 날이 종료일이 된다.
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
  // 이 날이 시작일이 될 수 있는지(=1거래일 전 종가가 필요한지)에 따라 눌러도 되는 날을 정한다.
  const isRangeDaySelectable = (date: string, hasClosingMap: boolean, hasPreviousDay: boolean) => {
    if (!hasClosingMap) return false
    if (draftStart !== null && draftEnd === null) return date >= draftStart.date || hasPreviousDay
    if (draftStart === null && draftEnd !== null) return date > draftEnd.date || hasPreviousDay
    return hasPreviousDay
  }
  // 고른 시작일·종료일 대기 값만 비운다 — 화면의 지도는 그대로고 달력은 열려 있다.
  const resetRange = () => {
    setDraftStart(null)
    setDraftEnd(null)
  }
  const applyRange = () => {
    if (!onSelectRange || draftStart === null || draftEnd === null) return
    onSelectRange(draftStart.snapshotTime, draftEnd.snapshotTime)
    setIsOpen(false)
  }

  // ── 지금 버튼 — 날짜 칸을 가장 최근 지도의 날짜로 채운다(적용을 눌러야 지도가 바뀐다). 하루는 실시간이고, 기간은 종료일이 된다. ──
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

  // 지난 날짜나 기간을 보는 중일 때만 보인다(하루·기간 모드 모두) — 고른 날짜·기간을 모두 풀고 실시간 지도로 바로 돌아간다(적용을 따로 누를 필요 없다).
  // 아래쪽 "초기화"(고른 날짜만 비움)와 헷갈리지 않게 되돌리기 화살표 대신 지도 위의 "실시간" 시계 아이콘과 글자를 쓴다.
  const liveButton = isPast ? (
    <button
      type="button"
      aria-label="실시간으로 돌아가기"
      title="실시간으로 돌아가기"
      onClick={() => {
        onSelectSnapshotTime(null)
        setIsOpen(false)
      }}
      className="flex h-6 shrink-0 items-center gap-1 rounded-lg border-0 bg-zinc-600 px-2 text-[13px] font-semibold leading-none text-white transition-colors hover:bg-zinc-500"
    >
      <ClockIcon className="h-3.5 w-3.5" aria-hidden />
      실시간
    </button>
  ) : null
  // 하루 모드는 날짜 칸을, 기간 모드는 종료일을 가장 최근 거래일로 채운다(휴장일에는 실제 오늘이 아니라 최근 거래일이라 "최근일"이다). "실시간" 버튼은 지난 날짜·기간을 풀고 바로 실시간으로 돌아간다.
  const todayButton = (
    <button
      type="button"
      onClick={pickToday}
      className="shrink-0 rounded-lg border-0 bg-zinc-600 px-2.5 py-1 text-center text-[13px] font-semibold leading-none text-white transition-colors hover:bg-zinc-500"
    >
      최근일
    </button>
  )

  const dayLabel = draftDay
    ? (draftDay.snapshotTime ? toMarketMapSnapshotDateLabel(draftDay.snapshotTime) : `${draftDay.date} (${WEEKDAY_LABELS[new Date(`${draftDay.date}T00:00:00`).getDay()]})`)
    : '-'

  return (
    <span ref={rootRef} className="relative z-40 flex items-center">
      <button
        type="button"
        aria-label="날짜 선택"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggleOpen}
        className={`flex h-6 items-center gap-1.5 border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-[#838385] focus-visible:bg-[#838385] ${isOpen ? 'bg-[#838385]' : 'bg-transparent'}`}
      >
        <CalendarIcon className={`h-[15px] w-[15px] shrink-0 ${isOpen ? FILLED_ICON_CLASS : ''}`} aria-hidden />
        {/* 날짜 글자(기간이면 "~ 종료일"까지)도 버튼 안에 둬서 칩 어디를 눌러도 달력이 열린다. */}
        {children}
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label="날짜 선택 달력"
          className="absolute left-0 top-full z-50 mt-[7px] w-max rounded-md border border-gray-500 bg-[#363639] p-2 text-sm font-normal tracking-normal text-white shadow-xl"
        >
          {/* 위쪽 줄: 왼쪽에 하루/기간 스위치, 오른쪽 끝에 실시간·최근일을 나란히 둔다(하루·기간 모드가 같은 배치). 고른 기간의 거래일 수는 아래쪽 줄의 종료일 오른쪽에 적는다. */}
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-gray-500 pb-2 text-[13px]">
            <span>
              {onSelectRange && (
                <span role="radiogroup" aria-label="선택 방식" className="inline-flex rounded-lg bg-[var(--panel-gray)] p-0.5">
                  {([['하루', false], ['기간', true]] as const).map(([label, rangeValue]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={isRangeMode === rangeValue}
                      onClick={() => switchMode(rangeValue)}
                      className={`rounded-md border-0 px-2 py-1 text-[13px] font-semibold leading-none transition-colors ${isRangeMode === rangeValue ? 'bg-zinc-800 text-white' : 'bg-transparent text-zinc-800 hover:text-black'}`}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1.5">
              {liveButton}
              {todayButton}
            </span>
          </div>
          {isRangeCalendar ? (
            <>
              <div className="relative flex gap-4">
                {isRangeLoading && (
                  // 월 이름·요일 줄(약 60px) 아래의 날짜 영역 전체를 덮고 그 가운데에 원 하나를 둔다.
                  <div className="absolute inset-x-0 bottom-0 top-[3.75rem] z-10 flex items-center justify-center bg-[#363639]">
                    <Spinner showElapsed compact className="h-36 w-36" />
                  </div>
                )}
                <MonthGrid
                  market={market}
                  showSpinner={false}
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
                  showSpinner={false}
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
              <div className="mt-1 flex items-center justify-between gap-3 border-t border-gray-500 pt-2 text-[13px]">
                {/* 시작일 ~ 종료일과 그 오른쪽의 거래일 수는 왼쪽부터 차례로 적고, 초기화와 적용은 오른쪽 끝에 붙여 놓는다. */}
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--accent)]">시작일</span>
                    {draftStart && <span className="text-gray-200">{toMarketMapSnapshotDateLabel(draftStart.snapshotTime)}</span>}
                  </span>
                  <span aria-hidden="true" className="text-white">~</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--accent)]">종료일</span>
                    {draftEnd && <span className="text-gray-200">{toMarketMapSnapshotDateLabel(draftEnd.snapshotTime)}</span>}
                  </span>
                  {/* 고른 기간의 길이라 한눈에 보이게 분류 배지의 "분류" 칸과 같은 짙은 청록 배지로 둔다. */}
                  {rangeDayCount !== null && <span className="rounded bg-cyan-700 px-1.5 py-0.5 font-semibold leading-none text-white">{rangeDayCount}</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  <button type="button" disabled={draftStart === null && draftEnd === null} onClick={resetRange} className={RESET_BUTTON_CLASS}>
                    초기화
                  </button>
                  <button type="button" disabled={draftStart === null || draftEnd === null} onClick={applyRange} className={APPLY_BUTTON_CLASS}>
                    적용
                  </button>
                </span>
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
                // 하루 달력은 날짜 하나를 새로 고르는 화면이라, 기간을 보는 중이어도 그 기간의 띠나 시작일·종료일 표시를 보여 주지 않는다.
                isSelected={date => (draftDay ? date === draftDay.date : rangeStartDate === null && date === anchorDate)}
                bandStart={null}
                bandEnd={null}
                onPick={pickSingleDay}
              />
              <div className="mt-1 flex w-60 items-center justify-between gap-2 border-t border-gray-500 pt-2 text-[13px]">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--accent)]">날짜</span>
                  {draftDay && <span className="text-gray-200">{dayLabel}</span>}
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
