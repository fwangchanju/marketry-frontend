import Spinner from '@/components/Spinner'
import { sampleTrendDays } from '@/utils/trendDates'
import { resolveTreemapExtremeColor, type ColorScaleConfig } from '@/utils/treemapColorScale'

export interface PeriodTrendPoint { date: string; changeRate: number }

// 거래일을 모두 연결하되 날짜 눈금은 최대 다섯 개만 표시한다.
export default function PeriodTrendChart({ points, label, colorScale, loading = false, error = false, onRetry }: {
  points: PeriodTrendPoint[]; label: string; colorScale: ColorScaleConfig; loading?: boolean; error?: boolean; onRetry?: () => void
}) {
  if (loading || error && !points.length) return (
    <div className="flex h-full w-full items-center justify-center">
      <Spinner key={loading ? 'loading' : 'error'} showElapsed centerContent className="aspect-square h-[min(14rem,80%)] shrink-0" errorMessage={loading ? undefined : '불러오지 못했습니다.'} onRetry={onRetry} />
    </div>
  )
  if (!points.length) return <div role="status" className="flex h-full items-center justify-center text-center text-sm text-ui-muted">표시할 추이 데이터가 없습니다.</div>
  const minimum = Math.min(0, ...points.map(point => point.changeRate))
  const maximum = Math.max(0, ...points.map(point => point.changeRate))
  const span = maximum - minimum || 1
  const x = (index: number) => points.length === 1 ? 500 : 24 + index / (points.length - 1) * 952
  const y = (value: number) => 180 - (value - minimum) / span * 150
  const last = points.at(-1)!
  const color = resolveTreemapExtremeColor(last.changeRate, colorScale)
  const ticks = sampleTrendDays(points.map((point, index) => ({ ...point, index })))
  return (
    <div role="img" aria-label={`${label} 선택 기간 누적 등락률 선형 그래프`} className="relative h-full w-full">
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
        <line x1="0" x2="1000" y1={y(0)} y2={y(0)} stroke="var(--ui-muted)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <polyline points={points.map((point, index) => `${x(index)},${y(point.changeRate)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <span className="absolute right-0 top-[-22px] text-[14px] font-semibold tabular-nums" style={{ color }}>{last.changeRate > 0 ? '+' : ''}{last.changeRate.toFixed(2)}%</span>
      {ticks.map(({ date, index }) => {
        const day = new Date(`${date}T00:00:00Z`)
        return <div key={date} className="absolute whitespace-nowrap text-center text-[12px] leading-tight text-ui-muted" style={{ top: 'calc(100% + 8px)', left: `${x(index) / 10}%`, transform: index === 0 ? undefined : index === points.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>
          <div>{day.getUTCMonth() + 1}/{day.getUTCDate()}</div><div>({['일', '월', '화', '수', '목', '금', '토'][day.getUTCDay()]})</div>
        </div>
      })}
    </div>
  )
}
