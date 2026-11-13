import { useEffect, useRef, useState } from 'react'
import { CalendarIcon } from '@/components/icons/AppIcons'
import { FILLED_ICON_CLASS } from '@/components/NavBarPageActions'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotDateLabel } from '@/utils/format'

// 미국 지도·그래프의 날짜 선택 — 저장된 거래일 목록에서 하루를 고른다. 미국은 하루 한 번 저장되므로 시각이 아니라 날짜만 보여 준다.
// 저장 시각의 날짜는 미국 거래일이다(한국 시각으로는 다음 날 아침에 마감한다).
export default function UsaDatePicker({ snapshotTime, snapshotTimes, onSelect }: {
  snapshotTime: string | null
  snapshotTimes: readonly string[]
  onSelect: (time: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
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
  const newestFirst = [...snapshotTimes].sort((a, b) => b.localeCompare(a))
  const selectedDay = snapshotTime?.slice(0, 10) ?? null
  return (
    <span ref={rootRef} className="relative flex h-6 items-center">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        className={`toolbar-badge-control flex h-6 items-center gap-1 border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-ui-control focus-visible:bg-ui-control ${isOpen ? 'bg-ui-control' : 'bg-transparent'}`}
      >
        <CalendarIcon strokeWidth={2.2} className={`h-[15px] w-[15px] shrink-0 ${isOpen ? FILLED_ICON_CLASS : ''}`} aria-hidden />
        <span data-hint="미국 거래일 기준입니다." className={snapshotTime ? undefined : 'invisible'}>{toSnapshotDateLabel(snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}</span>
      </button>
      {isOpen && (
        <div role="listbox" aria-label="거래일 선택" className="absolute left-0 top-full z-50 mt-1 max-h-[22rem] w-[13rem] overflow-y-auto rounded-md border border-ui-border bg-ui-panel p-1 text-sm font-normal tracking-normal text-ui-white shadow-xl">
          {newestFirst.length === 0 && <p className="px-2 py-1.5 text-ui-muted">저장된 거래일이 없습니다.</p>}
          {newestFirst.map(time => {
            const selected = time.slice(0, 10) === selectedDay
            return (
              <button
                key={time}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => { onSelect(time); setIsOpen(false) }}
                className={`flex w-full items-center border-0 bg-transparent px-2 py-1 text-left font-roboto-latin tabular-nums hover:bg-ui-control ${selected ? 'text-brand' : 'text-ui-white'}`}
              >
                {toSnapshotDateLabel(time)}
              </button>
            )
          })}
        </div>
      )}
    </span>
  )
}
