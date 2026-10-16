import { useRef, useState } from 'react'
import { usePopupPosition } from '@/hooks/usePopupPosition'
import { CheckIcon, ChevronDownIcon } from '@/components/icons/AppIcons'

// 설정창 드롭박스 — (badge를 주면 왼쪽에 지도 업종 헤더 모양 배지가 붙는다) 고른 값이 한 줄로 보이는 28px 버튼이고, 누르면 같은 폭의 목록이 펼쳐진다.
// 목록은 변경 내역 목록과 같은 모양(fixed 위치·#363639 바탕·회색 테두리)이고, 고른 줄에는 체크(✓)가 붙는다.

const ROW_HEIGHT = 28

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
  className?: string
}

export default function SettingsDropdown<K extends string>({ options, value, onChange, ariaLabel, disabled = false, badge, className = '' }: Props<K>) {
  const [isOpen, setIsOpen] = useState(false)
  const [indent, setIndent] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLSpanElement>(null)
  const position = usePopupPosition(isOpen, setIsOpen, triggerRef, popupRef, undefined, 0.8, false)
  const selected = options.find(option => option.key === value)

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
          // 목록은 배지 오른쪽부터(고른 값이 보이는 자리 아래로) 펼쳐서, 왼쪽에는 배지만 남게 한다.
          setIndent(badgeRef.current ? badgeRef.current.offsetWidth + 5 : 0)
          setIsOpen(open => !open)
        }}
        className={`flex w-full items-center justify-between rounded-[5px] border-0 bg-[var(--accent)]/45 ${badge ? 'pl-[5px] pr-2.5' : 'px-2.5'} text-left text-[13px] font-medium text-white disabled:cursor-not-allowed`}
        style={{ height: ROW_HEIGHT }}
      >
        {badge && <span ref={badgeRef} className="whitespace-nowrap rounded-[3px] bg-black/35 px-1.5 text-[12px] font-bold leading-[18px]">{badge}</span>}
        <span className={`truncate ${badge ? 'ml-2.5 mr-auto' : ''}`}>{selected?.label}</span>
        <ChevronDownIcon strokeWidth={3.5} className={`h-[18px] w-[18px] shrink-0 text-[#12b8a6] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && position && (
        <div
          ref={popupRef}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            top: position.top + (position.openUpward ? -6 : 6),
            left: position.left + indent,
            width: position.width - indent,
            transform: position.openUpward ? 'translateY(-100%)' : undefined,
          }}
          className="z-50 overflow-hidden rounded-none border border-gray-500 bg-[#363639] p-0 text-white shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {options.map((option, index) => (
            <button
              key={option.key}
              type="button"
              role="option"
              aria-selected={option.key === value}
              onClick={() => {
                onChange(option.key)
                setIsOpen(false)
              }}
              className={`settings-chip-hover flex w-full items-center justify-between rounded-none border-0 px-2.5 text-left text-[13px] font-medium text-white ${index > 0 ? 'border-t border-t-white/30' : ''} ${option.key === value ? 'bg-white/15' : 'bg-transparent'}`}
              style={{ height: ROW_HEIGHT }}
            >
              <span className="truncate">{option.label}</span>
              {option.key === value && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
