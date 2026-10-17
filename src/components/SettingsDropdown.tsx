import { useRef, useState } from 'react'
import { usePopupPosition } from '@/hooks/usePopupPosition'
import { ChevronDownIcon } from '@/components/icons/AppIcons'

// 설정창 드롭박스 — (badge를 주면 왼쪽에 지도 업종 헤더 모양 배지가 붙는다) 고른 값이 한 줄로 보이는 28px 버튼이고, 누르면 같은 폭의 목록이 펼쳐진다.
// 목록은 변경 내역 목록과 같은 모양(fixed 위치·var(--ui-panel) 바탕·회색 테두리)이고, 고른 값은 목록에서 뺀다(지금 값은 닫힌 버튼에 보이므로 나머지 선택지만 보여 준다).

const ROW_HEIGHT = 25
// 열린 목록의 한 줄은 닫힌 버튼보다 낮게 둔다.
const MENU_ROW_HEIGHT = 20
// compact는 설명 글자(12px/16px) 줄 높이에 가깝게 18px.
const COMPACT_HEIGHT = 18
const COMPACT_ROW_HEIGHT = 20

interface Option<K extends string> {
  key: K
  label: string
}

interface Props<K extends string> {
  options: Option<K>[]
  value: K
  onChange: (key: K) => void
  ariaLabel: string
  disabled?: boolean
  // 버튼 왼쪽에 지도 업종 헤더와 같은 배지로 붙는 이름.
  badge?: string
  // 설명 글자 줄 높이에 맞춘 작은 크기(개수 선택처럼 한 줄 옆에 붙는 용도).
  compact?: boolean
  // 꺽쇠를 고른 칸과 같은 색 조합으로 그린다(안쪽 짙은 청록 + 청록 외곽선).
  outlinedChevron?: boolean
  className?: string
}

export default function SettingsDropdown<K extends string>({ options, value, onChange, ariaLabel, disabled = false, badge, compact = false, outlinedChevron = false, className = '' }: Props<K>) {
  const [isOpen, setIsOpen] = useState(false)
  // 닫힌 버튼의 배지 폭 — 열린 목록의 글자를 고른 값 글자(배지 오른쪽)와 같은 세로줄에 맞추는 데 쓴다.
  const [badgeWidth, setBadgeWidth] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)
  const position = usePopupPosition(isOpen, setIsOpen, triggerRef, popupRef, undefined, 0.8, false)
  const selected = options.find(option => option.key === value)
  const listIndent = badge ? badgeWidth + 2.5 : 0
  const textPadLeft = badge ? Math.max(4, badgeWidth + 12.5 - listIndent - 1) : undefined

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          // 목록은 배지 오른쪽 끝(배지 폭 + 왼쪽 여백 2.5)에서 시작하고(직각, 회색 테두리), 글자는 버튼의 고른 값 글자와 같은 세로줄에 놓인다(배지 폭 + 12.5).
          setBadgeWidth(badgeRef.current ? badgeRef.current.offsetWidth : 0)
          setIsOpen(open => !open)
        }}
        className={`flex w-full items-center justify-between rounded-[5px] border-0 bg-[var(--accent)]/50 ${badge ? 'pl-[2.5px] pr-2.5' : compact ? 'pl-1.5 pr-1' : 'px-2.5'} text-left ${compact ? 'text-xs' : 'text-[13px]'} font-medium text-ui-white disabled:cursor-not-allowed`}
        style={{ height: compact ? COMPACT_HEIGHT : ROW_HEIGHT }}
      >
        {badge && <span ref={badgeRef} className="whitespace-nowrap rounded-[3px] bg-ui-background/35 px-1.5 text-[12px] font-bold leading-[20px]">{badge}</span>}
        <span className={`truncate ${badge ? 'ml-2.5 mr-auto' : ''}`}>{selected?.label}</span>
        {outlinedChevron ? (
          <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" className={`${compact ? 'h-3 w-3' : 'h-[18px] w-[18px]'} shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" stroke="var(--brand)" strokeWidth={7} />
            <polyline points="6 9 12 15 18 9" stroke="var(--brand-surface)" strokeWidth={3} />
          </svg>
        ) : (
          <ChevronDownIcon strokeWidth={3.5} className={`${compact ? 'h-3 w-3' : 'h-[18px] w-[18px]'} shrink-0 text-brand transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>
      {isOpen && position && (
        <div
          ref={popupRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            top: position.top + (position.openUpward ? 0 : 0),
            left: position.left + listIndent,
            width: position.width - listIndent,
            transform: position.openUpward ? 'translateY(-100%)' : undefined,
          }}
          className="z-50 overflow-hidden rounded-none border border-ui-border bg-ui-background p-0 text-ui-white shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {options.filter(option => option.key !== value).map((option, index) => (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={option.key === value}
              onClick={() => {
                onChange(option.key)
                setIsOpen(false)
              }}
              className={`settings-chip-hover flex w-full items-center justify-between rounded-none border-0 ${compact ? 'pl-1.5 pr-1 text-xs' : 'px-2.5 text-xs'} text-left font-medium text-ui-white ${index > 0 ? 'border-t border-t-ui-white/35' : ''} ${option.key === value ? 'bg-ui-white/20' : 'bg-transparent'}`}
              style={{ height: compact ? COMPACT_ROW_HEIGHT : MENU_ROW_HEIGHT, ...(textPadLeft !== undefined ? { paddingLeft: textPadLeft } : {}) }}
            >
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
