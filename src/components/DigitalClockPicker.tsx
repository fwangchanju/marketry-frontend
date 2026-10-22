import { type KeyboardEvent } from 'react'
import { SettingsOutlinedChevronIcon } from '@/components/icons/AppIcons'

// 업종 지표 드롭박스와 같은 꺾쇠를 위·아래에 재사용한다.
const ARROW_BUTTON = 'flex h-[18px] w-8 items-center justify-center border-0 bg-transparent p-0 outline-none disabled:cursor-not-allowed disabled:opacity-35'

const pad = (value: number) => String(value).padStart(2, '0')

// 디지털 시계 모양의 시각 고르기 — 시는 서버가 정한 값이라 흐리게 고정하고, 분만 위아래 화살표(또는 방향키)로 step분씩 바꾼다.
export default function DigitalClockPicker({ hour, minute, step, onChange, label }: { hour: number; minute: number; step: number; onChange: (minute: number) => void; label: string }) {
  const minMinute = step
  const maxMinute = 60 - step
  const move = (delta: number) => onChange(Math.min(maxMinute, Math.max(minMinute, minute + delta)))
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowUp') move(step)
    else if (event.key === 'ArrowDown') move(-step)
    else return
    event.preventDefault()
  }

  return (
    <div className="flex h-[80px] items-center gap-2 rounded-[4px] bg-[var(--ui-control)] px-3" aria-label={label} role="group">
      <span className="font-mono text-[28px] font-semibold leading-none tabular-nums text-ui-muted" aria-label={`${hour}시`}>{pad(hour)}</span>
      <span className="font-mono text-[28px] font-semibold leading-none text-ui-muted" aria-hidden="true">:</span>
      <div className="flex flex-col items-center gap-0.5">
        <button type="button" aria-label="분 올리기" data-hint={`${step}분 늦추기`} disabled={minute >= maxMinute} onClick={() => move(step)} className={ARROW_BUTTON}>
          <SettingsOutlinedChevronIcon orientation="up" className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <div
          role="spinbutton"
          tabIndex={0}
          aria-label={`${label} 분`}
          aria-valuemin={minMinute}
          aria-valuemax={maxMinute}
          aria-valuenow={minute}
          aria-valuetext={`${minute}분`}
          onKeyDown={handleKeyDown}
          className="font-mono text-[28px] font-semibold leading-none tabular-nums text-ui-white outline-none focus-visible:text-brand"
        >
          {pad(minute)}
        </div>
        <button type="button" aria-label="분 내리기" data-hint={`${step}분 당기기`} disabled={minute <= minMinute} onClick={() => move(-step)} className={ARROW_BUTTON}>
          <SettingsOutlinedChevronIcon orientation="down" className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
