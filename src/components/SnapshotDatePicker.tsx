import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CalendarIcon, ChevronDownIcon } from '@/components/icons/MarketMapIcons'
import { FILLED_ICON_CLASS } from '@/components/NavBarPageActions'
import { useMarketMapSnapshotDays } from '@/hooks/useMarketMap'
import Spinner from '@/components/Spinner'
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
  // 지난 날짜를 보는 중이면(아이콘이 이미 청록색) 마우스를 올릴 때 원래 회색으로 바뀐다. 실시간에서는 반대로 청록색이 된다.
  isPast: boolean
  // 달력 아이콘 옆에 놓을 날짜 글자 — 누르는 버튼은 달력 아이콘뿐이고 글자는 눌리지 않는다.
  children: ReactNode
}

interface ShownMonth {
  year: number
  monthIndex: number
}

const toShownMonth = (isoDate: string): ShownMonth => ({
  year: Number(isoDate.slice(0, 4)),
  monthIndex: Number(isoDate.slice(5, 7)) - 1,
})

const toMonthKey = ({ year, monthIndex }: ShownMonth) => `${year}-${String(monthIndex + 1).padStart(2, '0')}`

// 달력 아이콘을 누르면 아래로 달력 창이 뜬다. 데이터가 있는 날짜(종가 지도가 있는 날과 오늘)만 누를 수 있다.
export default function SnapshotDatePicker({ market, viewedSnapshotTime, liveSnapshotTime, onSelectSnapshotTime, isPast, children }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const [movedMonth, setMovedMonth] = useState<ShownMonth | null>(null)
  const anchorDate = (viewedSnapshotTime ?? liveSnapshotTime)?.slice(0, 10) ?? null
  const liveDate = liveSnapshotTime?.slice(0, 10) ?? null

  const shownMonth = movedMonth ?? (anchorDate ? toShownMonth(anchorDate) : toShownMonth(new Date().toISOString()))
  const monthKey = toMonthKey(shownMonth)
  // 서버 오류가 계속되면 기본 재시도(3회)가 달력을 30초 넘게 기다리게 하므로 1번만 다시 시도하고, 그 뒤에는 "다시 시도"로 받는다.
  const { data: days, isLoading, isError, refetch } = useMarketMapSnapshotDays(market, monthKey, { enabled: isOpen, retry: 1 })
  const closingTimeByDate = new Map((days ?? []).map(day => [day.date, day.snapshotTime]))

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

  const toggleOpen = () => {
    // 열 때마다 지금 보는 날짜의 달에서 시작한다.
    setMovedMonth(null)
    setIsOpen(open => !open)
  }

  const moveMonth = (delta: number) => {
    const moved = new Date(shownMonth.year, shownMonth.monthIndex + delta, 1)
    setMovedMonth({ year: moved.getFullYear(), monthIndex: moved.getMonth() })
  }

  // 실시간 날짜가 속한 달보다 뒤로는 데이터가 없다.
  const isNextMonthDisabled = liveDate !== null && monthKey >= liveDate.slice(0, 7)

  const selectDate = (date: string) => {
    onSelectSnapshotTime(date === liveDate ? null : (closingTimeByDate.get(date) ?? null))
    setIsOpen(false)
  }

  const firstWeekday = new Date(shownMonth.year, shownMonth.monthIndex, 1).getDay()
  const daysInMonth = new Date(shownMonth.year, shownMonth.monthIndex + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

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
          className="absolute left-0 top-full z-50 mt-1 w-60 rounded-md bg-[#202020] p-2 text-sm font-normal tracking-normal text-white shadow-md"
        >
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
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#202020]/80">
              <Spinner showElapsed className="h-44 w-44" />
            </div>
          )}
          <div className={`grid grid-cols-7 text-center font-roboto-latin tabular-nums ${isLoading ? 'opacity-30' : ''}`} aria-busy={isLoading}>
            {cells.map((day, index) => {
              if (day === null) return <span key={`blank-${index}`} />
              const date = `${monthKey}-${String(day).padStart(2, '0')}`
              const isSelectable = date === liveDate || closingTimeByDate.has(date)
              const isSelected = date === anchorDate
              // 이미 지나간 날인데 지도가 없는 날(주말·휴장일 등)은 빨간 숫자로 알린다. 불러오는 중이거나 아직 오지 않은 날은 회색 그대로.
              const isMissing = isSelectable === false && isLoading === false && isError === false && liveDate !== null && date <= liveDate
              return (
                <button
                  key={date}
                  type="button"
                  disabled={isSelectable === false}
                  aria-pressed={isSelected}
                  onClick={() => selectDate(date)}
                  className={`mx-auto my-0.5 flex h-7 w-7 items-center justify-center rounded-full border-0 ${
                    isSelected
                      ? 'bg-[var(--accent)] font-semibold text-black'
                      : isSelectable
                        ? 'bg-transparent text-gray-200 hover:bg-[#3b3b3b]'
                        : `cursor-not-allowed bg-transparent ${isMissing ? 'text-red-500/70' : 'text-gray-600'}`
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-[#555] pt-2 text-xs text-gray-400">
            {isError ? (
              <span className="flex items-center gap-1.5">
                불러오지 못했습니다
                <button type="button" onClick={() => void refetch()} className="border-0 bg-transparent p-0 text-[var(--accent)] hover:underline">
                  다시 시도
                </button>
              </span>
            ) : (
              <span>종가 지도</span>
            )}
            {liveDate !== null && liveDate !== anchorDate && (
              <button
                type="button"
                onClick={() => {
                  onSelectSnapshotTime(null)
                  setIsOpen(false)
                }}
                className="border-0 bg-transparent p-0 text-[var(--accent)] hover:underline"
              >
                실시간으로
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  )
}
