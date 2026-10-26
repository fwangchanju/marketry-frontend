import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, ClockIcon } from '@/components/icons/AppIcons'
import { usePopupPosition } from '@/hooks/usePopupPosition'
import { usePopupBounds } from '@/hooks/usePopupBounds'

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))

export default function BannerTimePicker({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [openColumn, setOpenColumn] = useState<'hour' | 'minute' | null>(null)
  const [hour, minute] = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)?.slice(1) ?? ['', '']
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const position = usePopupPosition(isOpen, setIsOpen, triggerRef, popupRef, undefined, 0.8, false, false)
  const popupBounds = usePopupBounds(isOpen, position !== null, triggerRef, popupRef, 208)

  let popupLeft = 8
  const popupWidth = Math.min(208, typeof window === 'undefined' ? 208 : window.innerWidth - 16)
  if (position && typeof window !== 'undefined') {
    popupLeft = Math.max(8, Math.min(position.left, window.innerWidth - popupWidth - 8))
  }

  const updateTime = (nextHour: string, nextMinute: string) => {
    onChange(`${nextHour || '00'}:${nextMinute || '00'}`)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label} 시각 선택`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen(open => !open)}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        className={`relative flex h-[25px] w-[66px] shrink-0 items-center justify-center rounded-[4px] border-0 pl-5 pr-1 text-[13px]/[16px] font-medium tabular-nums text-ui-white transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-35 ${isOpen ? 'bg-brand-surface hover:bg-brand-surface-hover' : isHovered ? 'bg-ui-control-hover' : 'bg-[var(--ui-control)]'}`}
      >
        <ClockIcon aria-hidden="true" className="absolute left-[6px] h-3.5 w-3.5 text-ui-white" />
        <span>{value || 'hh:mm'}</span>
      </button>
      {isOpen && position && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={`${label} 시각 선택`}
          style={{
            position: 'fixed',
            top: popupBounds?.top ?? position.top + (position.openUpward ? -4 : 4),
            left: popupBounds?.left ?? popupLeft,
            width: popupBounds?.width ?? popupWidth,
            maxHeight: popupBounds ? `${popupBounds.maxHeight}px` : undefined,
            overflowY: popupBounds ? 'auto' : undefined,
            visibility: popupBounds?.visible === false ? 'hidden' : undefined,
          }}
          className="z-50 rounded-md border border-ui-border bg-ui-panel p-3 text-sm text-ui-white shadow-xl"
          onClick={event => event.stopPropagation()}
        >
          <div className="mb-2 font-medium">{label} 시각</div>
          <div className="grid grid-cols-2 gap-2">
            {(['hour', 'minute'] as const).map(column => {
              const isHour = column === 'hour'
              const current = isHour ? hour : minute
              const options = isHour ? HOURS : MINUTES
              const labelText = isHour ? '시' : '분'
              return (
                <div key={column} className="relative flex flex-col gap-1 text-xs text-ui-muted">
                  <span>{labelText}</span>
                  <button
                    type="button"
                    aria-label={`${label} ${labelText} 선택`}
                    aria-haspopup="listbox"
                    aria-expanded={openColumn === column}
                    onClick={() => setOpenColumn(openColumn === column ? null : column)}
                    className="flex h-[25px] w-full items-center justify-between rounded-[4px] border-0 bg-ui-control px-2 text-left text-[13px] font-medium text-ui-white focus-visible:outline-none"
                  >
                    <span>{current || labelText}</span>
                    <ChevronDownIcon className={`h-3 w-3 text-brand transition-transform ${openColumn === column ? 'rotate-180' : ''}`} />
                  </button>
                  {openColumn === column && (
                    <div role="listbox" aria-label={`${label} ${labelText} 선택`} className={`absolute left-0 z-10 max-h-40 w-full overflow-y-auto rounded-none border border-ui-border bg-ui-background text-ui-white shadow-xl ${position?.openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                      {options.filter(option => option !== current).map((option, index) => (
                        <button
                          key={option}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            updateTime(isHour ? option : hour, isHour ? minute : option)
                            setOpenColumn(null)
                          }}
                          className={`flex h-5 w-full items-center border-0 bg-transparent px-2 text-left text-xs font-medium text-ui-white settings-chip-hover focus-visible:outline-none ${index > 0 ? 'border-t border-t-ui-white/35' : ''}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <button type="button" onClick={() => setIsOpen(false)} className="mt-3 flex h-[25px] w-full items-center justify-center rounded-[4px] border-0 bg-brand-surface text-[13px] font-semibold text-ui-white hover:bg-brand-surface-hover">완료</button>
        </div>,
        document.body,
      )}
    </>
  )
}
