import { SlidingHighlight } from '@/components/SlidingHighlight'

// 설정창의 선택 버튼 묶음 — 지도 설정 "종목 등락 방향"과 같은 양식이다. 선택 칸의 청록 채움이 옆으로 미끄러지고, 안 고른 칸은 회색이다.
// 글자는 칸 가운데에 두고, 묶음은 제목·설명 아래 남은 칸의 세로 가운데에 놓는다.
export default function SettingsSegmentedControl<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      className={`relative mt-auto mb-auto grid max-w-full settings-control-inset gap-[6px] ${disabled ? 'opacity-35' : ''}`}
    >
      <SlidingHighlight count={options.length} index={options.findIndex(option => option.value === value)} className="rounded-[4px] bg-brand-surface" />
      {options.map(option => (
        <button
          key={String(option.value)}
          type="button"
          disabled={disabled}
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className="settings-choice-hover relative z-10 min-h-[25px] justify-center rounded-[4px] border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium text-ui-white transition-colors duration-[500ms] disabled:cursor-not-allowed"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
