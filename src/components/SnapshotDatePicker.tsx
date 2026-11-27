import { useMarketSnapshotTimes } from '@/markets/useMarketQuotes'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueries } from '@tanstack/react-query'
import { getSnapshotDays } from '@/api/heatmap'
import { heatmapKeys } from '@/hooks/queryKeys'
import { CalendarIcon, ChevronDownIcon } from '@/components/icons/AppIcons'
import ToolbarPopup from '@/components/ToolbarPopup'
import { popupBadgeClass } from '@/components/popupBadgeStyle'
import { MOBILE_TOUCH_MIN_HEIGHT_CLASS, MOBILE_TOUCH_MIN_SIZE_CLASS } from '@/utils/mobilePopupScale'
import { useMobileToolbar } from '@/components/MobileToolbarContext'
import { IconCornerDownRight } from '@tabler/icons-react'
import { useSnapshotDays, useTradingDayGap } from '@/hooks/useHeatmap'
import { useKoreanCalendarHolidays } from '@/hooks/useKoreanCalendarHolidays'
import { isJapanMarketClosed } from '@/utils/japanMarketCalendar'
import { getKstDate } from '@/utils/tradingWindow'
import Spinner from '@/components/Spinner'
import { toSnapshotDateLabel } from '@/utils/format'
import type { MarketQuery } from '@/types/api'
import { keepCloseRows } from '@/utils/snapshotPick'
import { SNAPSHOT_CLOSE_CLOCK } from '@/utils/snapshotCloseClock'

type CalendarMarket = MarketQuery | 'JAPAN' | 'USA'

// 달력에서 고를 수 있는 가장 이른 달. 서버 데이터는 2019년 12월(거래일 2일)부터 있지만 2020년 1월부터만 쓴다.
const CALENDAR_FIRST_MONTH = '2020-01'

// 스냅샷 시장(일본·미국)은 저장된 스냅샷 날짜 목록으로 달력을 채운다. 한국처럼 월별 조회나 휴장 일정 조회를 하지 않는다.
const isSnapshotMarket = (market: CalendarMarket) => market === 'JAPAN' || market === 'USA'

// 스냅샷 시장의 스냅샷 시각 목록. 두 훅을 모두 부르고 해당 시장 것만 켠다(훅은 조건부로 부를 수 없다).
function useSnapshotTimes(market: CalendarMarket, enabled = true) {
  const japan = useMarketSnapshotTimes('JAPAN', market === 'JAPAN' && enabled)
  const usa = useMarketSnapshotTimes('USA', market === 'USA' && enabled)
  return market === 'USA' ? usa : japan
}

// 연 단위 이동 목적지 — 1년 전 같은 달이 비어 있으면 그 앞 12개월 안에서 가장 이른 데이터 달로 간다(데이터는 시작일부터 이어진다고 본다).
// 반환: undefined = 목록을 받는 중, null = 그 안에 데이터가 없음(이동 불가), 그 밖에는 yyyy-MM 달.
function useYearStepTargetMonth(market: CalendarMarket, month: ShownMonth, enabled: boolean): string | null | undefined {
  const windowMonths = Array.from({ length: 12 }, (_, i) => toMonthKey(addMonths(month, i - 12)))
  const isBeforeFirst = (key: string) => key < CALENDAR_FIRST_MONTH
  const korea = useQueries({
    queries: windowMonths.map(key => ({
      queryKey: heatmapKeys.snapshotDays(isSnapshotMarket(market) ? 'KOSPI' : (market as MarketQuery), key),
      queryFn: () => getSnapshotDays(isSnapshotMarket(market) ? 'KOSPI' : (market as MarketQuery), key),
      enabled: enabled && !isSnapshotMarket(market),
      retry: 1,
    })),
  })
  const snapshotTimes = useSnapshotTimes(market, enabled && isSnapshotMarket(market))
  if (!enabled) return undefined
  if (isSnapshotMarket(market)) {
    if (snapshotTimes.data === undefined) return undefined
    const earliest = snapshotTimes.data.map(time => time.slice(0, 7)).filter(key => windowMonths.includes(key) && !isBeforeFirst(key)).sort()[0]
    return earliest ?? null
  }
  // 앞에서부터 보며, 데이터가 있는 첫 달을 고른다. 그 전 달 목록을 아직 받는 중이면 기다린다.
  for (let i = 0; i < korea.length; i++) {
    const result = korea[i]
    if (result.data === undefined) return undefined
    if (result.data.length > 0 && !isBeforeFirst(windowMonths[i])) return windowMonths[i]
  }
  return null
}

// 두 달(yyyy-MM) 사이의 달 수 차이(to - from).
const monthDiffOf = (from: string, to: string) => (Number(to.slice(0, 4)) * 12 + Number(to.slice(5, 7))) - (Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)))

function useCalendarDays(market: CalendarMarket, month: string, options?: { enabled?: boolean; retry?: number | false }) {
  const korea = useSnapshotDays(isSnapshotMarket(market) ? 'KOSPI' : (market as MarketQuery), month, { ...options, enabled: !isSnapshotMarket(market) && (options?.enabled ?? true) })
  const japan = useSnapshotTimes(market, options?.enabled ?? true)
  if (!isSnapshotMarket(market)) return korea
  // 날짜마다 그날의 마지막 시세(미국은 종가 줄이 있으면 그 줄)를 쓴다.
  const byDate = new Map(keepCloseRows((japan.data ?? []).filter(time => time.startsWith(month)), market === 'USA' ? SNAPSHOT_CLOSE_CLOCK.USA : null).map(time => [time.slice(0, 10), time]))
  return { ...japan, data: japan.data === undefined ? undefined : [...byDate].map(([date, snapshotTime]) => ({ date, snapshotTime })) }
}

function useCalendarGap(market: CalendarMarket, from: string | null, to: string | null) {
  const korea = useTradingDayGap(isSnapshotMarket(market) ? null : from, isSnapshotMarket(market) ? null : to)
  const japan = useSnapshotTimes(market, from !== null && to !== null)
  if (!isSnapshotMarket(market)) return korea
  const days = new Set((japan.data ?? []).map(time => time.slice(0, 10)))
  return { ...japan, data: japan.data && from && to ? [...days].filter(date => date > from && date <= to).length : undefined }
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

interface Props {
  market: CalendarMarket
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
  // 휴장일 날짜에 표시할 현재 등락률 범례의 +8% 색.
  holidayColor?: string
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
function MonthChoice({ market, month, isCurrent, isLive, isAllowed, onChoose }: { market: CalendarMarket; month: ShownMonth; isCurrent: boolean; isLive: boolean; isAllowed: boolean; onChoose: () => void }) {
  const { data: days } = useCalendarDays(market, toMonthKey(month), { retry: 1 })
  const isEmpty = days !== undefined && days.length === 0
  const disabled = !isAllowed || isEmpty
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={isCurrent}
      onClick={onChoose}
      className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 ${isLive ? 'border-brand' : 'border-transparent'} ${
        isCurrent ? 'bg-transparent font-normal text-ui-white hover:bg-brand-surface' : disabled ? 'cursor-not-allowed bg-transparent text-ui-muted' : 'bg-transparent text-ui-white hover:bg-brand-surface'
      }`}
    >
      {month.monthIndex + 1}월
    </button>
  )
}

type MonthGridView = 'day' | 'month' | 'year'

interface MonthGridProps {
  market: CalendarMarket
  holidayColor?: string
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
  // 기간을 고르는 중 마우스가 올라간 날짜 — 시작일과 이 날짜 사이 띠를 미리 보여 준다.
  onHoverDate?: (date: string | null) => void
  // 누른 날짜와, 그날 종가 지도의 스냅샷 시각(없는 날이면 undefined).
  onPick: (date: string, snapshotTime: string | undefined) => void
  // false면 불러오는 중·오류 원을 이 달력이 그리지 않는다 — 두 달을 나란히 둘 때 바깥에서 원 하나만 가운데에 그린다.
  showSpinner?: boolean
  // 6주 행 마지막 칸(토요일 자리)에 들어가는 최근 버튼. 날짜가 올 수 없는 자리라 버튼을 놓아도 겹치지 않는다.
  recentButton?: ReactNode
}

// 한 달짜리 달력. 그 달의 종가 지도 목록 조회·불러오는 중/오류 화면을 스스로 맡는다.
function MonthGrid({ market, holidayColor, month, onMoveMonth, onSetMonth, isMonthAllowed, showPrevButton = true, showNextButton = true, liveDate, isSelectable, isSelected, bandStart, bandEnd, onHoverDate, onPick, showSpinner = true, recentButton }: MonthGridProps) {
  const monthKey = toMonthKey(month)
  const todayDate = getKstDate(new Date())
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
  const { data: days, isLoading, isError, refetch } = useCalendarDays(market, monthKey, { retry: 1 })
  const closingTimeByDate = new Map((days ?? []).map(day => [day.date, day.snapshotTime]))
  // 이전 달 목록도 함께 본다 — 데이터가 없는 달로는 넘어가지 못하게 하고, 앞선 거래일이 있는지도 따진다.
  const previousMonthKey = toMonthKey(addMonths(month, -1))
  const { data: previousMonthDays, isSuccess: isPreviousMonthLoaded } = useCalendarDays(market, previousMonthKey, { retry: 1 })
  // 이전 달 목록을 받았는데 비어 있으면 그 달로는 넘어가지 않는다(받기 전이나 오류일 때는 막지 않는다).
  const isPreviousMonthEmpty = previousMonthKey < CALENDAR_FIRST_MONTH || (isPreviousMonthLoaded && previousMonthDays?.length === 0)
  // 연 단위 이동 — 1년 전 같은 달에 데이터가 없으면 그 앞 12개월 안에서 가장 이른 데이터 달로 간다. 그 안에 데이터가 없으면 이동하지 않는다.
  const yearStepTarget = useYearStepTargetMonth(market, month, showPrevButton)
  const isPreviousYearEmpty = yearStepTarget === null
  const firstDataDate = [...(previousMonthDays ?? []), ...(days ?? [])].map(day => day.date).sort()[0] ?? null
  const hasPreviousDay = (date: string) => firstDataDate !== null && date > firstDataDate

  // 실시간 날짜가 속한 달보다 뒤로는 데이터가 없다.
  const isNextMonthDisabled = liveDate !== null && monthKey >= liveDate.slice(0, 7)
  const isNextYearDisabled = liveDate !== null && toMonthKey(addMonths(month, 12)) > liveDate.slice(0, 7)

  const firstWeekday = new Date(month.year, month.monthIndex, 1).getDay()
  const daysInMonth = new Date(month.year, month.monthIndex + 1, 0).getDate()
  const monthCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  // 모든 달을 6주 높이로 고정해 월 이동 시 달력 팝업 높이가 흔들리지 않게 한다.
  const cells: (number | null)[] = [...monthCells, ...Array.from({ length: 42 - monthCells.length }, () => null)]
  const koreaHolidays = useKoreanCalendarHolidays(monthKey, cells, liveDate, !isSnapshotMarket(market))
  const japanTimes = useSnapshotTimes(market)
  const japanDates = new Set((japanTimes.data ?? []).map(time => time.slice(0, 10)))
  const latestJapanDate = japanTimes.data?.at(-1)?.slice(0, 10)
  const firstJapanDate = japanTimes.data?.[0]?.slice(0, 10)
  // 스냅샷 시장은 저장된 첫날~마지막 날 사이에 스냅샷이 없는 평일을 휴장으로 본다. 일본은 휴장일 목록(isJapanMarketClosed)도 같이 쓴다.
  const holidayDates = isSnapshotMarket(market) ? new Set(cells.flatMap(day => {
    if (day === null) return []
    const date = `${monthKey}-${String(day).padStart(2, '0')}`
    return ((market === 'JAPAN' && isJapanMarketClosed(date)) || (firstJapanDate && latestJapanDate && date >= firstJapanDate && date <= latestJapanDate && !japanDates.has(date))) ? [date] : []
  })) : koreaHolidays.holidayDates
  const pendingScheduleDates = isSnapshotMarket(market) ? new Set<string>() : koreaHolidays.pendingScheduleDates

  return (
    <div className="relative w-60 shrink-0">
      {/* 불러오는 중이나 오류일 때는 월 이름·요일 줄까지 덮고 가운데에 원 하나만 둔다. 로딩과 오류의 원 크기는 같아서 서로 바뀌어도 움직이지 않는다. */}
      {view === 'day' && showSpinner && (isLoading || isError) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ui-panel">
          {isLoading ? (
            <Spinner showElapsed className={CALENDAR_SPINNER_CLASS} />
          ) : (
            <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => void refetch()} className={CALENDAR_SPINNER_CLASS} />
          )}
        </div>
      )}
      {view === 'day' && (
        <>
          <div className="mb-1 flex items-center justify-between">
            {showPrevButton ? (
              <span className="flex items-center">
                <button type="button" aria-label="이전 해" disabled={isPreviousYearEmpty} onClick={() => onMoveMonth(yearStepTarget ? monthDiffOf(monthKey, yearStepTarget) : -12)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
                  <ChevronDownIcon className="h-4 w-4 rotate-90" />
                  <ChevronDownIcon className="-ml-2.5 h-4 w-4 rotate-90" />
                </button>
                <button type="button" aria-label="이전 달" disabled={isPreviousMonthEmpty} onClick={() => onMoveMonth(-1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
                  <ChevronDownIcon className="h-4 w-4 rotate-90" />
                </button>
              </span>
            ) : <span className="h-7 w-14" />}
            {/* 년을 누르면 년 선택, 월을 누르면 월 선택이 나온다. */}
            <span className="flex items-center gap-1">
              <button type="button" aria-label="년 선택" onClick={() => openView('year')} className="border-0 bg-transparent p-0 font-roboto-latin font-normal tabular-nums text-ui-white hover:text-brand">{month.year}년</button>
              <button type="button" aria-label="월 선택" onClick={() => openView('month')} className="border-0 bg-transparent p-0 font-roboto-latin font-normal tabular-nums text-ui-white hover:text-brand">{month.monthIndex + 1}월</button>
            </span>
            {showNextButton ? (
              <span className="flex items-center">
                <button type="button" aria-label="다음 달" disabled={isNextMonthDisabled} onClick={() => onMoveMonth(1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
                  <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                </button>
                <button type="button" aria-label="다음 해" disabled={isNextYearDisabled} onClick={() => onMoveMonth(12)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
                  <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                  <ChevronDownIcon className="-ml-2.5 h-4 w-4 -rotate-90" />
                </button>
              </span>
            ) : <span className="h-7 w-14" />}
          </div>
          {/* 날짜 영역은 요일 줄을 뺀 나머지 높이를 모두 차지해서, 로딩 원이 그 영역 정중앙에 놓인다(날짜 줄이 5줄인 달도 마찬가지). */}
          <div className="flex min-h-[13.5rem] flex-col">
        <div className="mb-0.5 grid grid-cols-7 border-b border-ui-border text-center text-[13px] font-normal text-ui-muted">
          {WEEKDAY_LABELS.map(label => (
            <span key={label} className="py-1">{label}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="grid grid-cols-7 grid-rows-6 text-center font-roboto-latin tabular-nums" aria-busy={isLoading}>
            {cells.map((day, index) => {
              if (day === null) return recentButton !== undefined && index === cells.length - 1
                ? <div key={`blank-${index}`} className="flex items-center justify-center">{recentButton}</div>
                : <span key={`blank-${index}`} />
              const date = `${monthKey}-${String(day).padStart(2, '0')}`
              const isToday = date === todayDate
              const hasClosingMap = closingTimeByDate.has(date)
              // 휴장일은 전 거래일 지도 데이터가 연결돼 있어도 선택할 수 없게 한다.
              const selectable = (isSnapshotMarket(market) || date >= '2020-01-02') && !holidayDates.has(date) && !pendingScheduleDates.has(date) && isSelectable(date, hasClosingMap, hasPreviousDay(date))
              const selected = isSelected(date)
              const weekday = (firstWeekday + day - 1) % 7
              // 주말은 항상 거래 휴장일이고, 평일은 서버 거래 일정이 HOLIDAY라고 확인된 경우에만 휴장 색을 쓴다.
              // 평일의 데이터 누락(FAILED)은 기존 흐린 색을 유지한다.
              const isHoliday = weekday === 0 || weekday === 6 || holidayDates.has(date)
              // 기간 띠 — 시작일은 오른쪽 절반, 종료일은 왼쪽 절반, 그 사이 날은 칸 전체를 칠한다. 줄이 바뀌는 곳(일요일·1일 / 토요일·말일)은 끝을 둥글게 한다.
              const hasBand = bandStart !== null && bandEnd !== null && bandStart < bandEnd && date >= bandStart && date <= bandEnd
              const bandShape = date === bandStart ? 'left-1/2 right-0' : date === bandEnd ? 'left-0 right-1/2' : `inset-x-0 ${weekday === 0 || day === 1 ? 'rounded-l-full' : ''} ${weekday === 6 || day === daysInMonth ? 'rounded-r-full' : ''}`
              return (
                <div key={date} className={`relative my-0.5 flex h-7 items-center justify-center ${MOBILE_TOUCH_MIN_HEIGHT_CLASS}`}>
                  {hasBand && <span aria-hidden="true" className={`absolute inset-y-0 bg-ui-control ${bandShape}`} />}
                  <button
                    type="button"
                    disabled={selectable === false}
                    aria-pressed={selected}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => onPick(date, closingTimeByDate.get(date))}
                    onMouseEnter={() => { if (selectable !== false) onHoverDate?.(date) }}
                    onMouseLeave={() => onHoverDate?.(null)}
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 ${MOBILE_TOUCH_MIN_SIZE_CLASS} ${isToday ? 'border-brand' : 'border-transparent'} ${
                      selected
                        ? 'bg-brand-surface font-semibold text-ui-white'
                        : isToday
                          ? `bg-transparent font-semibold text-ui-white ${selectable ? 'hover:bg-brand-surface hover:text-ui-white' : 'cursor-not-allowed'}`
                        : selectable
                          ? 'bg-transparent text-ui-white hover:bg-brand-surface hover:text-ui-white'
                          : `cursor-not-allowed bg-transparent ${isHoliday && holidayColor ? '' : 'text-ui-muted'}`
                    }`}
                    style={!selected && !isToday && isHoliday && holidayColor ? { color: holidayColor } : undefined}
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
            <span className="flex items-center">
              <button type="button" aria-label="이전 10년" disabled={pickerYear <= 2020} onClick={() => setPickerYear(year => Math.max(2020, year - 10))} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
                <ChevronDownIcon className="h-4 w-4 rotate-90" />
                <ChevronDownIcon className="-ml-2.5 h-4 w-4 rotate-90" />
              </button>
              <button type="button" aria-label="이전 해" disabled={pickerYear <= 2020} onClick={() => setPickerYear(year => Math.max(2020, year - 1))} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
                <ChevronDownIcon className="h-4 w-4 rotate-90" />
              </button>
            </span>
            <button type="button" aria-label="년 선택" onClick={() => { setDecadeStart(Math.floor(pickerYear / 10) * 10); setView('year') }} className="border-0 bg-transparent p-0 font-roboto-latin font-normal tabular-nums text-ui-white hover:text-brand">{pickerYear}년</button>
            <span className="flex items-center">
              <button type="button" aria-label="다음 해" disabled={liveYear !== null && pickerYear >= liveYear} onClick={() => setPickerYear(year => year + 1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
                <ChevronDownIcon className="h-4 w-4 -rotate-90" />
              </button>
              <button type="button" aria-label="다음 10년" disabled={liveYear !== null && pickerYear >= liveYear} onClick={() => setPickerYear(year => (liveYear !== null ? Math.min(liveYear, year + 10) : year + 10))} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
                <ChevronDownIcon className="h-4 w-4 -rotate-90" />
                <ChevronDownIcon className="-ml-2.5 h-4 w-4 -rotate-90" />
              </button>
            </span>
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
                  isLive={liveDate !== null && choice.year === Number(liveDate.slice(0, 4)) && choice.monthIndex === Number(liveDate.slice(5, 7)) - 1}
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
            <button type="button" aria-label="이전 10년" disabled={decadeStart <= 2020} onClick={() => setDecadeStart(start => start - 10)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
              <ChevronDownIcon className="h-4 w-4 rotate-90" />
            </button>
            <span className="font-roboto-latin font-normal tabular-nums">{decadeStart} - {decadeStart + 9}</span>
            <button type="button" aria-label="다음 10년" disabled={liveYear !== null && decadeStart + 10 > liveYear} onClick={() => setDecadeStart(start => start + 10)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-ui-text hover:text-brand disabled:cursor-not-allowed disabled:text-ui-muted disabled:hover:text-ui-muted">
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
                  className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 ${year === liveYear ? 'border-brand' : 'border-transparent'} ${
                    year === month.year ? 'bg-transparent font-normal text-ui-white hover:bg-brand-surface' : disabled ? 'cursor-not-allowed bg-transparent text-ui-surface' : isOutsideDecade ? 'bg-transparent text-ui-muted hover:bg-brand-surface' : 'bg-transparent text-ui-white hover:bg-brand-surface'
                  }`}
                >
                  {year}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// 달력의 로딩·오류 원 크기 — 한 달 달력(너비 240px, 높이 약 248px) 안에 들어가는 가장 큰 크기다. 안의 크기는 모두 원 너비에 대한 비율이라 메인 영역과 같은 모양이다.
const CALENDAR_SPINNER_CLASS = 'h-[14.5rem] w-[14.5rem]'

// 팝업 배지 공통 양식(popupBadgeClass)의 색만 여기서 붙인다. 크기·글자는 공통 양식이 PC·MOBILE에 맞춰 정한다.
const APPLY_BUTTON_COLOR = 'bg-brand-surface text-ui-white hover:bg-brand-surface-hover disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-brand-surface'
const RESET_BUTTON_COLOR = 'bg-ui-control text-ui-white hover:bg-ui-control-hover disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-ui-control'
// 거래일 배지와 같은 모양의 YTD 버튼 — 누르면 연초~최근일 날짜만 고른다.
const YTD_BUTTON_COLOR = 'bg-ui-control text-ui-text hover:bg-ui-control-hover disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-ui-control'

// 달력 아이콘을 누르면 아래로 달력 창이 뜬다. 데이터가 있는 날짜(종가 지도가 있는 날과 오늘)만 누를 수 있다.
// 날짜를 골라도 대기 상태로만 두고 "적용"을 눌러야 지도가 바뀐다.
// "기간"을 켜면 이어진 두 달이 나란히 뜨고(이전·다음 달 버튼은 두 달을 함께 움직인다), 첫 번째로 누른 날이 시작, 두 번째가 종료다.
export default function SnapshotDatePicker({ market, viewedSnapshotTime, liveSnapshotTime, onSelectSnapshotTime, onSelectRange, rangeStartTime, isPast, children, holidayColor }: Props) {
  const { isMobile } = useMobileToolbar()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
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
  // 기간 선택 중 마우스가 올라간 날짜 — 시작일만 고른 상태에서 두 날짜 사이 띠를 미리 보여 준다.
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  // 하루·기간 달력의 왼쪽 달(오른쪽은 그 다음 달). 두 모드가 같은 달 데이터 캐시를 공유한다.
  const [rangeLeftMonth, setRangeLeftMonth] = useState<ShownMonth>(() => toShownMonth(new Date().toISOString()))

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) setIsOpen(false)
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

  // 하루 모드에서 넘어오면 선택 날짜를 시작일로 유지한다. 이미 적용한 기간을 다시 열면 두 날짜를 복원한다.
  const prepareRange = (selectedStart: PickedDay | null = null) => {
    if (selectedStart) {
      setDraftStart(selectedStart)
      setDraftEnd(null)
    } else if (isViewingRange) {
      setDraftStart({ date: rangeStartTime.slice(0, 10), snapshotTime: rangeStartTime })
      setDraftEnd({ date: viewedSnapshotTime.slice(0, 10), snapshotTime: viewedSnapshotTime })
    } else {
      setDraftStart(null)
      setDraftEnd(null)
    }
    // MOBILE은 한 달만 보이므로 지금 보는 달을 그대로 연다. PC는 두 달을 보이므로 왼쪽 달(오른쪽은 그 다음 달)을 기준으로 잡는다.
    const endMonth = toShownMonth(selectedStart?.date ?? viewedSnapshotTime ?? anchorDate ?? new Date().toISOString())
    if (isMobile) {
      const latestMonth = liveDate === null ? null : toShownMonth(liveDate)
      setRangeLeftMonth(latestMonth !== null && toMonthKey(endMonth) > toMonthKey(latestMonth) ? latestMonth : endMonth)
      return
    }
    // 시작일이 있는 달을 왼쪽에 두고 그 다음 달을 오른쪽에 둔다(한 달 안의 기간이면 둘 다 보인다). 종료일이 그보다 뒤면 종료일이 오른쪽 달이 되게 하고,
    // 오른쪽 달이 실시간 달을 넘지 않게 한다. 기간을 고르는 중이 아니면 오른쪽이 지금 보는 달이다.
    const wantedLeft = selectedStart ? toShownMonth(selectedStart.date) : isViewingRange && rangeStartTime ? maxMonth(toShownMonth(rangeStartTime), addMonths(endMonth, -1)) : addMonths(endMonth, -1)
    const latestLeft = liveDate === null ? null : addMonths(toShownMonth(liveDate), -1)
    setRangeLeftMonth(latestLeft !== null && toMonthKey(wantedLeft) > toMonthKey(latestLeft) ? latestLeft : wantedLeft)
  }

  const toggleOpen = () => {
    setDraftDay(null)
    if (isOpen) {
      setIsOpen(false)
      return
    }
    prepareRange()
    setIsRangeMode(isViewingRange)
    setIsOpen(true)
  }

  const switchMode = (toRange: boolean) => {
    if (toRange === isRangeMode) return
    if (toRange) {
      const selectedDay = draftDay ?? (isPast && viewedSnapshotTime ? { date: viewedSnapshotTime.slice(0, 10), snapshotTime: viewedSnapshotTime } : null)
      // 오늘 선택은 snapshotTime이 null이므로 종가 목록 또는 현재 스냅샷의 시각을 이어받는다.
      const snapshotTime = selectedDay?.snapshotTime
        ?? [...(rangeLeftDays.data ?? []), ...(rangeRightDays.data ?? [])].find(day => day.date === selectedDay?.date)?.snapshotTime
        ?? (selectedDay?.date === liveDate ? liveSnapshotTime : null)
      prepareRange(selectedDay && snapshotTime ? { date: selectedDay.date, snapshotTime } : null)
      setDraftDay(null)
    } else {
      setDraftDay(null)
      const anchorMonth = toShownMonth(anchorDate ?? new Date().toISOString())
      if (isMobile) {
        const latestMonth = liveDate === null ? null : toShownMonth(liveDate)
        setRangeLeftMonth(latestMonth !== null && toMonthKey(anchorMonth) > toMonthKey(latestMonth) ? latestMonth : anchorMonth)
      } else {
        const wantedLeft = addMonths(anchorMonth, -1)
        const latestLeft = liveDate === null ? null : addMonths(toShownMonth(liveDate), -1)
        setRangeLeftMonth(latestLeft !== null && toMonthKey(wantedLeft) > toMonthKey(latestLeft) ? latestLeft : wantedLeft)
      }
    }
    setIsRangeMode(toRange)
  }

  const isRangeCalendar = isRangeMode && onSelectRange !== undefined
  const displayRangeStart = isOpen && isRangeCalendar ? draftStart?.date ?? null : isViewingRange ? rangeStartDate : null
  const displayRangeEnd = isOpen && isRangeCalendar ? draftEnd?.date ?? null : isViewingRange ? viewedSnapshotTime?.slice(0, 10) ?? null : null
  const { data: displayRangeGap } = useCalendarGap(market, displayRangeStart, displayRangeEnd)
  const displayDayDate = isOpen && !isRangeCalendar
    ? draftDay?.date ?? (isPast && !isViewingRange ? anchorDate : null)
    : isPast && !isViewingRange ? viewedSnapshotTime?.slice(0, 10) ?? null : null
  const { data: displayDayGap } = useCalendarGap(market, displayDayDate, displayDayDate !== null ? liveDate : null)
  const tradingDayBadge = isRangeCalendar
    ? displayRangeGap !== undefined ? `${displayRangeGap + 1}거래일` : null
    : displayDayDate !== null && displayDayGap !== undefined ? `${displayDayGap} 거래일 전` : null
  // 두 모드가 같은 두 달의 요청을 공유하고, 로딩·오류 표시는 두 달 위에 하나만 둔다.
  const rangeLeftDays = useCalendarDays(market, toMonthKey(rangeLeftMonth), { enabled: isOpen, retry: 1 })
  const rangeRightDays = useCalendarDays(market, toMonthKey(addMonths(rangeLeftMonth, 1)), { enabled: isOpen && !isMobile, retry: 1 })
  const isCalendarLoading = rangeLeftDays.isLoading || (!isMobile && rangeRightDays.isLoading)
  const isCalendarError = !isCalendarLoading && (rangeLeftDays.isError || (!isMobile && rangeRightDays.isError))
  // 오류 화면의 "다시 시도"는 실패한 달만 다시 받는다.
  const retryRange = () => {
    if (rangeLeftDays.isError) void rangeLeftDays.refetch()
    if (!isMobile && rangeRightDays.isError) void rangeRightDays.refetch()
  }
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
  // 기간 띠 — 두 날짜를 모두 고르면 그 사이를, 시작일만 골랐으면 마우스가 올라간 날짜까지를 칠한다(두 날짜 순서는 자동으로 맞춘다).
  const rangeBand: { start: string | null; end: string | null } = (() => {
    if (draftStart && draftEnd) return { start: draftStart.date, end: draftEnd.date }
    if (draftStart && hoverDate && hoverDate !== draftStart.date) {
      return hoverDate > draftStart.date ? { start: draftStart.date, end: hoverDate } : { start: hoverDate, end: draftStart.date }
    }
    return { start: null, end: null }
  })()
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
  const { data: liveMonthDays } = useCalendarDays(market, liveDate?.slice(0, 7) ?? '', { enabled: isOpen && liveDate !== null, retry: 1 })
  const pickToday = () => {
    if (liveDate === null) return
    if (isRangeCalendar) {
      const snapshotTime = liveMonthDays?.find(day => day.date === liveDate)?.snapshotTime ?? liveSnapshotTime
      if (snapshotTime === null) return
      setDraftEnd({ date: liveDate, snapshotTime })
      setRangeLeftMonth(isMobile ? toShownMonth(liveDate) : addMonths(toShownMonth(liveDate), -1))
    } else {
      setDraftDay({ date: liveDate, snapshotTime: null })
      setRangeLeftMonth(isMobile ? toShownMonth(liveDate) : addMonths(toShownMonth(liveDate), -1))
    }
  }

  // ── YTD 버튼 — 날짜만 고른다(수익률 계산은 하지 않는다). 시작일은 최근일이 속한 해의 1월에서 가져온다. ──
  // 기간 시작일은 1거래일 전 종가가 있어야 하므로 1월과 그 전 달을 함께 보고, 데이터가 있는 가장 이른 날 다음 날부터 고른다.
  const ytdYear = liveDate === null ? null : Number(liveDate.slice(0, 4))
  const { data: ytdJanDays } = useCalendarDays(market, ytdYear === null ? '' : `${ytdYear}-01`, { enabled: isOpen && ytdYear !== null, retry: 1 })
  const { data: ytdPrevDays } = useCalendarDays(market, ytdYear === null ? '' : `${ytdYear - 1}-12`, { enabled: isOpen && ytdYear !== null, retry: 1 })
  const ytdStart = (() => {
    if (ytdYear === null || ytdJanDays === undefined || ytdPrevDays === undefined) return null
    const firstDataDate = [...ytdPrevDays, ...ytdJanDays].map(day => day.date).sort()[0] ?? null
    return firstDataDate === null ? null : ytdJanDays.find(day => day.date > firstDataDate) ?? null
  })()
  const pickYtd = () => {
    if (liveDate === null || ytdStart === null) return
    const endSnapshotTime = liveMonthDays?.find(day => day.date === liveDate)?.snapshotTime ?? liveSnapshotTime
    if (endSnapshotTime === null) return
    if (!isRangeMode) switchMode(true)
    setDraftStart(ytdStart)
    setDraftEnd({ date: liveDate, snapshotTime: endSnapshotTime })
    setRangeLeftMonth({ year: Number(ytdStart.date.slice(0, 4)), monthIndex: 0 })
  }

  // 지난 날짜나 기간을 보는 중일 때만 보인다(하루·기간 모드 모두) — 고른 날짜·기간을 모두 풀고 실시간 지도로 바로 돌아간다(적용을 따로 누를 필요 없다).
  // 아래쪽 "초기화"(고른 날짜만 비움)와 헷갈리지 않게 되돌리기 화살표 대신 지도 위의 "실시간" 시계 아이콘과 글자를 쓴다.
  // 하루 모드는 날짜 칸을, 기간 모드는 종료일을 가장 최근 거래일로 채운다(휴장일에는 실제 오늘이 아니라 최근 거래일이라 "최근일"이다). "실시간" 버튼은 지난 날짜·기간을 풀고 바로 실시간으로 돌아간다.
  const todayButton = (
    <button
      type="button"
      aria-label="최근"
      data-hint="최근 거래일로 이동"
      onClick={pickToday}
      className="flex h-7 w-7 shrink-0 items-center justify-center border-0 bg-transparent text-ui-text transition-colors hover:text-brand"
    >
      <IconCornerDownRight stroke={2} className="h-4 w-4" aria-hidden />
    </button>
  )

  const dayLabel = draftDay
    ? (draftDay.snapshotTime ? toSnapshotDateLabel(draftDay.snapshotTime) : `${draftDay.date} (${WEEKDAY_LABELS[new Date(`${draftDay.date}T00:00:00`).getDay()]})`)
    : '-'
  // 아직 새로 고른 날이 없어도 지난 날짜를 보는 중이면 지금 보는 날짜를 흐리게 보여 준다(고르면 흰색으로 바뀐다).
  const viewedDayLabel = draftDay === null && isPast && !isViewingRange && viewedSnapshotTime !== null ? toSnapshotDateLabel(viewedSnapshotTime) : null

  return (
    <span ref={rootRef} className="relative z-40 flex items-center">
      <button
        type="button"
        aria-label="날짜 선택"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggleOpen}
        className={`toolbar-badge-control flex h-6 items-center gap-1 border-0 px-1.5 font-medium text-inherit outline-none transition-colors hover:bg-ui-control focus-visible:bg-ui-control ${isOpen ? 'bg-ui-control' : 'bg-transparent'}`}
      >
        <CalendarIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />
        {/* 날짜 글자(기간이면 "~ 종료일"까지)도 버튼 안에 둬서 칩 어디를 눌러도 달력이 열린다. */}
        {children}
      </button>
      {isOpen && (
        <ToolbarPopup
          open={isOpen}
          triggerRef={rootRef}
          popupRef={popupRef}
          ariaLabel="날짜 선택 달력"
          className={`${isMobile ? 'w-64' : 'w-[32.125rem]'} rounded-md border border-ui-border bg-ui-panel p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl`}
        >
          {/* 위쪽 줄: 왼쪽에 하루/기간 스위치와 선택 날짜, 오른쪽 끝에 거래일 배지(MOBILE만). 최근 버튼은 달력 6주 행의 마지막 칸으로 옮겼다. */}
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-ui-border pb-2 text-[13px]">
            <span className="flex min-w-0 items-center gap-3">
              {onSelectRange && (
                <span role="radiogroup" aria-label="선택 방식" className="inline-flex items-center gap-1">
                  {([['하루', false], ['기간', true]] as const).map(([label, rangeValue]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={isRangeMode === rangeValue}
                      onClick={() => switchMode(rangeValue)}
                      className={`${popupBadgeClass('switch')} ${isRangeMode === rangeValue ? 'bg-brand-surface text-ui-white' : 'bg-ui-control text-ui-text hover:bg-ui-control-hover'}`}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              )}
              {isMobile ? null : isRangeCalendar ? (
            <span className="flex min-w-0 items-center gap-1">
              {draftStart && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 font-normal text-brand">시작일</span>
                  <span className="truncate text-ui-white">{toSnapshotDateLabel(draftStart.snapshotTime)}</span>
                </span>
              )}
              {draftStart && draftEnd && <span aria-hidden="true" className="text-ui-white">~</span>}
              {draftEnd && (
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 font-normal text-brand">종료일</span>
                  <span className="truncate text-ui-white">{toSnapshotDateLabel(draftEnd.snapshotTime)}</span>
                </span>
              )}
              {tradingDayBadge !== null && <span className="ml-1 inline-flex h-5 shrink-0 items-center rounded bg-ui-control px-1.5 text-[0.8125rem] font-normal leading-none text-ui-text">{tradingDayBadge}</span>}
            </span>
              ) : (
            <span className="flex items-center gap-1.5">
              {draftDay ? (
                <>
                  <span className="font-normal text-brand">날짜</span>
                  <span className="text-ui-white">{dayLabel}</span>
                </>
              ) : viewedDayLabel !== null && (
                <>
                  <span className="font-normal text-brand">날짜</span>
                  <span className="text-ui-muted">{viewedDayLabel}</span>
                </>
              )}
              {tradingDayBadge !== null && <span className="ml-0.5 inline-flex h-5 shrink-0 items-center rounded bg-ui-control px-1.5 text-[0.8125rem] font-normal leading-none text-ui-text">{tradingDayBadge}</span>}
            </span>
              )}
            </span>
            {isMobile && tradingDayBadge !== null && (
              <span className={`${popupBadgeClass('tag')} bg-ui-control text-ui-text`}>{tradingDayBadge}</span>
            )}
          </div>
          {isRangeCalendar ? (
            <>
              <div className="relative flex gap-4">
                {(isCalendarLoading || isCalendarError) && (
                  // 월 이름·요일 줄까지 덮고 가운데에 원 하나만 둔다. 어느 한 달이라도 못 받으면 오류 원 하나를 둔다.
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-ui-panel">
                    {isCalendarLoading ? (
                      <Spinner showElapsed className={CALENDAR_SPINNER_CLASS} />
                    ) : (
                      <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={retryRange} className={CALENDAR_SPINNER_CLASS} />
                    )}
                  </div>
                )}
                {isMobile ? (
                  <MonthGrid
                    market={market}
                    holidayColor={holidayColor}
                    showSpinner={false}
                    month={rangeLeftMonth}
                    onMoveMonth={delta => setRangeLeftMonth(month => addMonths(month, delta))}
                    onSetMonth={setRangeLeftMonth}
                    isMonthAllowed={isMonthWithinLive}
                    liveDate={liveDate}
                    isSelectable={isRangeDaySelectable}
                    isSelected={date => date === draftStart?.date || date === draftEnd?.date}
                    bandStart={rangeBand.start}
                    bandEnd={rangeBand.end}
                    onHoverDate={setHoverDate}
                    onPick={pickRangeDay}
                    recentButton={todayButton}
                  />
                ) : (
                  <>
                    <MonthGrid
                      market={market}
                      holidayColor={holidayColor}
                      showSpinner={false}
                      month={rangeLeftMonth}
                      onMoveMonth={delta => setRangeLeftMonth(month => addMonths(month, delta))}
                      onSetMonth={month => setRangeLeftMonth(month)}
                      isMonthAllowed={month => isMonthWithinLive(addMonths(month, 1))}
                      showNextButton={false}
                      liveDate={liveDate}
                      isSelectable={isRangeDaySelectable}
                      isSelected={date => date === draftStart?.date || date === draftEnd?.date}
                      bandStart={rangeBand.start}
                      bandEnd={rangeBand.end}
                      onHoverDate={setHoverDate}
                      onPick={pickRangeDay}
                    />
                    <MonthGrid
                      market={market}
                      holidayColor={holidayColor}
                      showSpinner={false}
                      month={addMonths(rangeLeftMonth, 1)}
                      onMoveMonth={delta => setRangeLeftMonth(month => addMonths(month, delta))}
                      onSetMonth={month => setRangeLeftMonth(addMonths(month, -1))}
                      isMonthAllowed={isMonthWithinLive}
                      showPrevButton={false}
                      liveDate={liveDate}
                      isSelectable={isRangeDaySelectable}
                      isSelected={date => date === draftStart?.date || date === draftEnd?.date}
                      bandStart={rangeBand.start}
                      bandEnd={rangeBand.end}
                      onHoverDate={setHoverDate}
                      onPick={pickRangeDay}
                      recentButton={todayButton}
                    />
                  </>
                )}
              </div>
              <div className="mt-1 flex min-w-0 items-center justify-between gap-2 border-t border-ui-border pt-2 text-[13px]">
                <button type="button" aria-label="YTD 기간 선택" onClick={pickYtd} disabled={ytdStart === null} className={`${popupBadgeClass('tag')} ${YTD_BUTTON_COLOR}`}>
                  YTD
                </button>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button type="button" disabled={draftStart === null && draftEnd === null} onClick={resetRange} className={`${popupBadgeClass('action')} ${RESET_BUTTON_COLOR}`}>
                    선택 해제
                  </button>
                  <button type="button" disabled={draftStart === null || draftEnd === null} onClick={applyRange} className={`${popupBadgeClass('action')} ${APPLY_BUTTON_COLOR}`}>
                    적용
                  </button>
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="relative flex gap-4">
                {(isCalendarLoading || isCalendarError) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-ui-panel">
                    {isCalendarLoading ? (
                      <Spinner showElapsed className={CALENDAR_SPINNER_CLASS} />
                    ) : (
                      <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={retryRange} className={CALENDAR_SPINNER_CLASS} />
                    )}
                  </div>
                )}
                {isMobile ? (
                  <MonthGrid
                    market={market}
                    holidayColor={holidayColor}
                    showSpinner={false}
                    month={rangeLeftMonth}
                    onMoveMonth={delta => setRangeLeftMonth(month => addMonths(month, delta))}
                    onSetMonth={setRangeLeftMonth}
                    isMonthAllowed={isMonthWithinLive}
                    liveDate={liveDate}
                    isSelectable={(date, hasClosingMap) => date === liveDate || hasClosingMap}
                    // 하루 달력에는 날짜 하나만 선택하므로 기간 범위 표시는 쓰지 않는다.
                    isSelected={date => (draftDay ? date === draftDay.date : rangeStartDate === null && date === anchorDate)}
                    bandStart={null}
                    bandEnd={null}
                    onPick={pickSingleDay}
                    recentButton={todayButton}
                  />
                ) : (
                  <>
                    <MonthGrid
                      market={market}
                      holidayColor={holidayColor}
                      showSpinner={false}
                      month={rangeLeftMonth}
                      onMoveMonth={delta => setRangeLeftMonth(month => addMonths(month, delta))}
                      onSetMonth={month => setRangeLeftMonth(month)}
                      isMonthAllowed={month => isMonthWithinLive(addMonths(month, 1))}
                      showNextButton={false}
                      liveDate={liveDate}
                      isSelectable={(date, hasClosingMap) => date === liveDate || hasClosingMap}
                      // 하루 달력에는 날짜 하나만 선택하므로 기간 범위 표시는 쓰지 않는다.
                      isSelected={date => (draftDay ? date === draftDay.date : rangeStartDate === null && date === anchorDate)}
                      bandStart={null}
                      bandEnd={null}
                      onPick={pickSingleDay}
                    />
                    <MonthGrid
                      market={market}
                      holidayColor={holidayColor}
                      showSpinner={false}
                      month={addMonths(rangeLeftMonth, 1)}
                      onMoveMonth={delta => setRangeLeftMonth(month => addMonths(month, delta))}
                      onSetMonth={month => setRangeLeftMonth(addMonths(month, -1))}
                      isMonthAllowed={isMonthWithinLive}
                      showPrevButton={false}
                      liveDate={liveDate}
                      isSelectable={(date, hasClosingMap) => date === liveDate || hasClosingMap}
                      isSelected={date => (draftDay ? date === draftDay.date : rangeStartDate === null && date === anchorDate)}
                      bandStart={null}
                      bandEnd={null}
                      onPick={pickSingleDay}
                      recentButton={todayButton}
                    />
                  </>
                )}
              </div>
              <div className={`mt-1 flex ${isMobile ? 'w-60' : 'w-[31rem]'} items-center justify-between gap-2 border-t border-ui-border pt-2 text-[13px]`}>
                <button type="button" aria-label="YTD 기간 선택" onClick={pickYtd} disabled={ytdStart === null} className={`${popupBadgeClass('tag')} ${YTD_BUTTON_COLOR}`}>
                  YTD
                </button>
                <button type="button" disabled={draftDay === null} onClick={applyDay} className={`${popupBadgeClass('action')} ${APPLY_BUTTON_COLOR}`}>
                  적용
                </button>
              </div>
            </>
          )}
        </ToolbarPopup>
      )}
    </span>
  )
}
