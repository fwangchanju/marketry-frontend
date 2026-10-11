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
  // 기간 등락률 — 시작일·끝일의 종가 스냅샷 시각(시작일이 앞선다). 구간을 보는 중이면 시작일의 스냅샷 시각이 rangeStartTime으로 들어온다.
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

interface MonthGridProps {
  market: MarketQuery
  // 처음 보여 줄 달을 정하는 날짜(yyyy-MM-dd). 없으면 이번 달.
  initialDate: string | null
  liveDate: string | null
  isSelectable: (date: string, hasClosingMap: boolean) => boolean
  // true면 1거래일 전 종가가 있는 날만 누를 수 있다 — 기간의 시작은 하루 전 종가가 기준이라, 맨 처음 데이터 날은 시작으로 고를 수 없다.
  requirePreviousDay?: boolean
  isSelected: (date: string) => boolean
  // 기간(시작일~끝일)을 이어진 띠로 칠할 때의 양 끝 날짜. 둘 다 있고 서로 다른 날일 때만 띠가 그려진다.
  bandStart: string | null
  bandEnd: string | null
  // 누른 날짜와, 그날 종가 지도의 스냅샷 시각(없는 날이면 undefined).
  onPick: (date: string, snapshotTime: string | undefined) => void
}

// 한 달짜리 달력. 달 이동·그 달의 종가 지도 목록 조회·불러오는 중/오류 화면을 스스로 맡는다.
function MonthGrid({ market, initialDate, liveDate, isSelectable, requirePreviousDay = false, isSelected, bandStart, bandEnd, onPick }: MonthGridProps) {
  const [movedMonth, setMovedMonth] = useState<ShownMonth | null>(null)
  const shownMonth = movedMonth ?? toShownMonth(initialDate ?? new Date().toISOString())
  const monthKey = toMonthKey(shownMonth)
  // 서버 오류가 계속되면 기본 재시도(3회)가 달력을 30초 넘게 기다리게 하므로 1번만 다시 시도하고, 그 뒤에는 "다시 시도"로 받는다.
  const { data: days, isLoading, isError, refetch } = useMarketMapSnapshotDays(market, monthKey, { retry: 1 })
  const closingTimeByDate = new Map((days ?? []).map(day => [day.date, day.snapshotTime]))
  // 앞선 거래일이 있는지 따지려고 이전 달 목록도 함께 본다(시작 달력에서만).
  const previousMonthStart = new Date(shownMonth.year, shownMonth.monthIndex - 1, 1)
  const previousMonthKey = toMonthKey({ year: previousMonthStart.getFullYear(), monthIndex: previousMonthStart.getMonth() })
  const { data: previousMonthDays } = useMarketMapSnapshotDays(market, previousMonthKey, { enabled: requirePreviousDay, retry: 1 })
  const firstDataDate = [...(previousMonthDays ?? []), ...(days ?? [])].map(day => day.date).sort()[0] ?? null
  const hasPreviousDay = (date: string) => requirePreviousDay === false || (firstDataDate !== null && date > firstDataDate)

  const moveMonth = (delta: number) => {
    const moved = new Date(shownMonth.year, shownMonth.monthIndex + delta, 1)
    setMovedMonth({ year: moved.getFullYear(), monthIndex: moved.getMonth() })
  }
  // 실시간 날짜가 속한 달보다 뒤로는 데이터가 없다.
  const isNextMonthDisabled = liveDate !== null && monthKey >= liveDate.slice(0, 7)

  const firstWeekday = new Date(shownMonth.year, shownMonth.monthIndex, 1).getDay()
  const daysInMonth = new Date(shownMonth.year, shownMonth.monthIndex + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  return (
    <div className="w-60 shrink-0">
      <div className="mb-1 flex items-center justify-between">
        <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)} className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-300 hover:text-white">
          <ChevronDownIcon className="h-4 w-4 rotate-90" />
        </button>
        <span className="font-roboto-latin font-semibold tabular-nums">{shownMonth.year}년 {shownMonth.monthIndex + 1}월</span>
        <button
          type="button"
          aria-label="다음 달"
          disabled={isNextMonthDisabled}
          onClick={() => moveMonth(1)}
          className="flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-300 hover:text-white disabled:cursor-not-allowed disabled:text-gray-600 disabled:hover:text-gray-600"
        >
          <ChevronDownIcon className="h-4 w-4 -rotate-90" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-gray-400">
        {WEEKDAY_LABELS.map(label => (
          <span key={label} className="py-1">{label}</span>
        ))}
      </div>
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#202020]">
            <Spinner showElapsed compact className="h-36 w-36" />
          </div>
        )}
        <div className="grid grid-cols-7 text-center font-roboto-latin tabular-nums" aria-busy={isLoading}>
          {cells.map((day, index) => {
            if (day === null) return <span key={`blank-${index}`} />
            const date = `${monthKey}-${String(day).padStart(2, '0')}`
            const selectable = isSelectable(date, closingTimeByDate.has(date)) && hasPreviousDay(date)
            const selected = isSelected(date)
            // 이미 지나간 날인데 지도가 없는 날(주말·휴장일 등)은 빨간 숫자로 알린다. 불러오는 중이거나 아직 오지 않은 날은 회색 그대로.
            const isMissing = selectable === false && closingTimeByDate.has(date) === false && isLoading === false && isError === false && liveDate !== null && date <= liveDate
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
                        ? 'bg-transparent text-gray-200 hover:bg-[#3b3b3b]'
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

// 달력 아이콘을 누르면 아래로 달력 창이 뜬다. 데이터가 있는 날짜(종가 지도가 있는 날과 오늘)만 누를 수 있다.
// "기간"을 켜면 시작일 달력과 끝일 달력이 나란히 뜨고, 둘 다 고르면 그 구간의 등락률 지도로 바뀐다.
export default function SnapshotDatePicker({ market, viewedSnapshotTime, liveSnapshotTime, onSelectSnapshotTime, onSelectRange, rangeStartTime, isPast, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const anchorDate = (viewedSnapshotTime ?? liveSnapshotTime)?.slice(0, 10) ?? null
  const liveDate = liveSnapshotTime?.slice(0, 10) ?? null
  // 구간을 보는 중이면 끝일이 오늘이어도 실시간으로 돌아가는 배지가 필요하다.
  const isLiveButtonVisible = liveDate !== null && (liveDate !== anchorDate || rangeStartTime !== undefined)
  const rangeStartDate = rangeStartTime?.slice(0, 10) ?? null // 기간을 보는 중인지 가리는 데만 쓴다
  // 구간 고르기 — 시작일(왼쪽)과 끝일(오른쪽)을 따로 고른다. 이미 구간을 보는 중이면 그 값에서 시작한다.
  const [isRangeMode, setIsRangeMode] = useState(false)
  const [draftStart, setDraftStart] = useState<PickedDay | null>(null)
  const [draftEnd, setDraftEnd] = useState<PickedDay | null>(null)

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

  // 이미 기간을 보는 중이면 그 시작일·끝일이 채워진 채로 기간 달력(2개)을 열고, 아니면 하루 달력(1개)을 연다.
  const isViewingRange = onSelectRange !== undefined && rangeStartTime !== undefined && viewedSnapshotTime !== null
  const openRangeDraft = () => {
    if (isViewingRange) {
      setDraftStart({ date: rangeStartTime.slice(0, 10), snapshotTime: rangeStartTime })
      setDraftEnd({ date: viewedSnapshotTime.slice(0, 10), snapshotTime: viewedSnapshotTime })
    } else {
      setDraftStart(null)
      setDraftEnd(null)
    }
  }

  const toggleOpen = () => {
    if (isOpen) {
      setIsOpen(false)
      return
    }
    openRangeDraft()
    setIsRangeMode(isViewingRange)
    setIsOpen(true)
  }

  const toggleRangeMode = () => {
    if (isRangeMode) {
      setIsRangeMode(false)
      return
    }
    openRangeDraft()
    setIsRangeMode(true)
  }

  // 시작·종료 날짜는 대기 상태로만 두고, 아래의 "적용"을 눌러야 지도가 바뀐다. 시작은 종료보다, 종료는 시작보다 앞설 수 없다(달력에서 누를 수 없게 막아 둔다).
  const pickRangeDay = (side: 'start' | 'end', date: string, snapshotTime: string | undefined) => {
    if (snapshotTime === undefined) return
    if (side === 'start') setDraftStart({ date, snapshotTime })
    else setDraftEnd({ date, snapshotTime })
  }
  const applyRange = () => {
    if (!onSelectRange || draftStart === null || draftEnd === null) return
    onSelectRange(draftStart.snapshotTime, draftEnd.snapshotTime)
    setIsOpen(false)
  }

  const selectSingleDay = (date: string, snapshotTime: string | undefined) => {
    onSelectSnapshotTime(date === liveDate ? null : (snapshotTime ?? null))
    setIsOpen(false)
  }

  const isRangeCalendar = isRangeMode && onSelectRange !== undefined
  // 구간의 "오늘" — 오늘 종가 지도가 있으면 그 시각, 아직 없으면(장중) 실시간 지도의 시각을 끝일로 쓴다.
  const { data: liveMonthDays } = useMarketMapSnapshotDays(market, liveDate?.slice(0, 7) ?? '', { enabled: isOpen && isRangeCalendar && liveDate !== null, retry: 1 })
  const pickToday = () => {
    if (liveDate === null) return
    const snapshotTime = liveMonthDays?.find(day => day.date === liveDate)?.snapshotTime ?? liveSnapshotTime
    if (snapshotTime === null) return
    pickRangeDay('end', liveDate, snapshotTime)
  }

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
          className="absolute left-0 top-full z-50 mt-1 w-max rounded-md bg-[#202020] p-2 text-sm font-normal tracking-normal text-white shadow-md"
        >
          {/* 위쪽 줄: 왼쪽 하루/기간 스위치, 오른쪽 하루는 실시간·기간은 오늘(종료를 오늘로 — 적용을 눌러야 지도가 바뀐다). */}
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-[#555] pb-2 text-xs">
            <span>
              {onSelectRange && (
                <span role="radiogroup" aria-label="선택 방식" className="inline-flex overflow-hidden rounded-sm border border-[var(--accent)]">
                  {([['하루', false], ['기간', true]] as const).map(([label, rangeValue]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={isRangeMode === rangeValue}
                      onClick={() => (isRangeMode === rangeValue ? undefined : toggleRangeMode())}
                      className={`border-0 px-1.5 py-0.5 text-xs font-medium leading-none ${isRangeMode === rangeValue ? 'bg-[var(--accent)] text-black' : 'bg-transparent text-[var(--accent)] hover:bg-[#3b3b3b]'}`}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              )}
            </span>
            <span>
              {isRangeCalendar ? (
                <button
                  type="button"
                  onClick={pickToday}
                  className="w-[2.05rem] shrink-0 rounded-sm border border-[var(--accent)] bg-transparent px-0 py-0.5 text-center text-xs font-medium leading-none text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
                >
                  오늘
                </button>
              ) : isLiveButtonVisible ? (
                <button
                  type="button"
                  onClick={() => {
                    onSelectSnapshotTime(null)
                    setIsOpen(false)
                  }}
                  className="shrink-0 rounded-sm border border-[var(--accent)] bg-transparent px-1.5 py-0.5 text-center text-xs font-medium leading-none text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
                >
                  실시간
                </button>
              ) : null}
            </span>
          </div>
          {isRangeCalendar ? (
            <div className="flex gap-4">
              <MonthGrid
                key="range-start"
                market={market}
                initialDate={draftStart?.date ?? anchorDate}
                liveDate={liveDate}
                isSelectable={(date, hasClosingMap) => hasClosingMap && (draftEnd === null || date <= draftEnd.date)}
                requirePreviousDay
                isSelected={date => date === draftStart?.date}
                bandStart={draftStart?.date ?? null}
                bandEnd={draftEnd?.date ?? null}
                onPick={(date, snapshotTime) => pickRangeDay('start', date, snapshotTime)}
              />
              <MonthGrid
                key={`range-end-${draftEnd?.date ?? ''}`}
                market={market}
                initialDate={draftEnd?.date ?? anchorDate}
                liveDate={liveDate}
                isSelectable={(date, hasClosingMap) => hasClosingMap && (draftStart === null || date >= draftStart.date)}
                isSelected={date => date === draftEnd?.date}
                bandStart={draftStart?.date ?? null}
                bandEnd={draftEnd?.date ?? null}
                onPick={(date, snapshotTime) => pickRangeDay('end', date, snapshotTime)}
              />
            </div>
          ) : (
            <MonthGrid
              key="single"
              market={market}
              initialDate={anchorDate}
              liveDate={liveDate}
              isSelectable={(date, hasClosingMap) => date === liveDate || hasClosingMap}
              // 하루 달력은 날짜 하나를 새로 고르는 화면이라, 기간을 보는 중이어도 그 기간의 띠나 시작·끝 표시를 보여 주지 않는다.
              isSelected={date => rangeStartDate === null && date === anchorDate}
              bandStart={null}
              bandEnd={null}
              onPick={selectSingleDay}
            />
          )}
          {isRangeCalendar && (
            <div className="mt-1 flex gap-4 border-t border-[#555] pt-2 text-xs">
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
                <button
                  type="button"
                  disabled={draftStart === null || draftEnd === null}
                  onClick={applyRange}
                  className="shrink-0 rounded-sm border border-[var(--accent)] bg-[var(--accent)] px-1.5 py-0.5 text-center text-xs font-medium leading-none text-black hover:brightness-110 disabled:cursor-not-allowed disabled:border-gray-600 disabled:bg-transparent disabled:text-gray-600 disabled:hover:brightness-100"
                >
                  적용
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  )
}
