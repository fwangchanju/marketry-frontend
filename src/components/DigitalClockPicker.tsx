import { type KeyboardEvent } from 'react'

// 지도 설정창 손잡이(StairChevron)와 같은 얇은 꺾쇠(︿ ﹀)만 쓴다 — 알약 바탕 없이 강조색이고, 올리면 흰색이 된다.
const ARROW_BUTTON = 'flex h-4 w-8 items-center justify-center border-0 bg-transparent p-0 text-brand outline-none transition-colors hover:text-ui-white focus-visible:text-ui-white disabled:cursor-not-allowed disabled:opacity-30'

function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg viewBox="0 0 10 6" className="w-2.5" aria-hidden="true">
      <path d={direction === 'up' ? 'M1 5l4-4 4 4' : 'M1 1l4 4 4-4'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

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
    <div className="flex items-center gap-2 rounded-[4px] bg-[var(--ui-control)] px-3 py-1" aria-label={label} role="group">
      <span className="font-mono text-[28px] font-semibold leading-none tabular-nums text-ui-muted" aria-label={`${hour}시`}>{pad(hour)}</span>
      <span className="font-mono text-[28px] font-semibold leading-none text-ui-muted" aria-hidden="true">:</span>
      <div className="flex flex-col items-center gap-0.5">
        <button type="button" aria-label="분 올리기" data-hint={`${step}분 늦추기`} disabled={minute >= maxMinute} onClick={() => move(step)} className={ARROW_BUTTON}>
          <ArrowIcon direction="up" />
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
          <ArrowIcon direction="down" />
        </button>
      </div>
    </div>
  )
}
