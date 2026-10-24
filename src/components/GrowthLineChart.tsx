// 누적 회원 수 선 그래프 — 날짜별 누적 값을 이은 선이다. 맨 아래를 0으로 두고 가장 큰 값이 위쪽 끝에 닿는다.
// 오른쪽 끝(오늘) 값은 숫자로 적고, 가로축에는 처음·가운데·끝 날짜만 적는다.
import { formatCount } from '@/utils/formatCount'

export default function GrowthLineChart({ rows }: { rows: { date: string; total: number }[] }) {
  if (rows.length === 0) return null
  const width = 360
  const height = 150
  const padX = 6
  const padTop = 18
  const padBottom = 6
  const max = Math.max(1, ...rows.map(row => row.total))
  const x = (index: number) => padX + (rows.length === 1 ? (width - padX * 2) / 2 : (index / (rows.length - 1)) * (width - padX * 2))
  const y = (value: number) => padTop + (1 - value / max) * (height - padTop - padBottom)
  const points = rows.map((row, index) => `${x(index).toFixed(1)},${y(row.total).toFixed(1)}`).join(' ')
  const last = rows[rows.length - 1]
  const lastY = y(last.total)
  const valueLabelY = lastY < 34 ? lastY + 14 : lastY - 6
  const label = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
  const middle = rows[Math.floor((rows.length - 1) / 2)]
  return (
    <div className="flex h-full min-h-[140px] w-full flex-col justify-end" role="img" aria-label={`최근 ${rows.length}일 누적 회원 수`}>
      <div className="relative h-full w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
          <line x1={padX} x2={width - padX} y1={height - padBottom} y2={height - padBottom} stroke="var(--ui-border)" strokeWidth="1" />
          <polyline points={points} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span aria-hidden="true" className="absolute -translate-y-full whitespace-nowrap text-xs font-medium leading-none tabular-nums text-ui-text" style={{ right: `${(padX / width) * 100}%`, top: `${(valueLabelY / height) * 100}%` }}>{formatCount(last.total)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] leading-none tabular-nums text-ui-muted">
        <span>{label(rows[0].date)}</span>
        <span>{label(middle.date)}</span>
        <span>{label(last.date)}<span aria-hidden="true" className="invisible"> · {formatCount(last.total)}명</span></span>
      </div>
    </div>
  )
}
