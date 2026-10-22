import { SlidingHighlight } from '@/components/SlidingHighlight'

// 설정창의 선택 버튼 묶음 — 지도 설정 "종목 등락 방향"과 같은 양식이다. 선택 칸의 청록 채움(외곽선 포함)이 옆으로 미끄러지고, 안 고른 칸은 회색이다.
// 글자는 칸 가운데에 두고(설정창 공통 스타일이 버튼을 flex로 만들어 가로 정렬을 따로 준다), 묶음은 제목·설명 아래 남은 칸의 세로 가운데에 놓는다(6px 아래로 보정).
export default function SettingsSegmentedControl<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      className="relative mt-4 grid max-w-[16rem] translate-y-[6px] settings-control-inset gap-[6px]"
    >
      <SlidingHighlight count={options.length} index={options.findIndex(option => option.value === value)} className="rounded-[4px] border border-brand bg-brand-surface" />
      {options.map(option => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`relative z-10 min-h-[25px] justify-center rounded-[4px] border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium text-ui-white transition-colors duration-[500ms] ${value === option.value ? '' : 'settings-chip-hover'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
