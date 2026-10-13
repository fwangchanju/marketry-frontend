import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import type { RankColumnsChart } from '@/components/RankColumns'
import { resolveMarketMapColor, resolveMarketMapExtremeColor, type ColorScaleConfig } from '@/utils/marketMapColorScale'

const VALUE_WIDTH = 56

function toValueLabel(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

// 모바일 폭용 가로 막대 — RankColumns와 같은 자료를 쓴다. 항목명은 왼쪽, 막대는 오른쪽으로 절댓값만큼 뻗고, 부호는 색과 숫자로 구분한다.
export default function RankBars({
  chart,
  highlightColor,
  colorScale,
  onSelectSector,
}: {
  chart: RankColumnsChart
  highlightColor: string
  colorScale: ColorScaleConfig
  onSelectSector?: (sectorName: string) => void
}) {
  const items = chart.rankedItems
  if (items.length === 0) {
    return (
      <div className="relative min-h-0 w-full flex-1">
        <EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" />
      </div>
    )
  }
  const axisMax = Math.max(chart.axisMax, 0.5)

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col justify-between text-[14px]">
      {items.map(item => {
        const isEllipsis = item.hiddenCount !== undefined
        const selectable = onSelectSector !== undefined && !item.isReference && !isEllipsis
        const nameClassName = 'w-[92px] shrink-0 truncate text-right font-bold'
        const nameColor = item.isReference ? highlightColor : isEllipsis ? '#9ca3af' : '#ffffff'
        return (
          <div key={item.key} className="flex min-h-0 flex-1 items-center gap-2">
            {selectable ? (
              <button
                type="button"
                aria-label={item.sectorName}
                onClick={() => onSelectSector(item.sectorName)}
                className={`${nameClassName} cursor-pointer appearance-none border-0 bg-transparent p-0 hover:bg-white/35`}
                style={{ color: nameColor }}
              >
                {item.sectorName}
              </button>
            ) : (
              <span className={nameClassName} style={{ color: nameColor }}>{item.sectorName}</span>
            )}
            <div className="relative h-[60%] max-h-5 min-w-0 flex-1">
              {isEllipsis ? (
                <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 leading-none text-gray-400">⋯</span>
              ) : (
                <>
                  <div
                    className="absolute left-0 top-0 h-full rounded-sm"
                    style={{
                      width: `calc((100% - ${VALUE_WIDTH}px) * ${Math.abs(item.value) / axisMax})`,
                      backgroundColor: item.isReference ? highlightColor : resolveMarketMapColor(item.value, colorScale),
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1.5 font-bold tabular-nums"
                    style={{
                      left: `calc((100% - ${VALUE_WIDTH}px) * ${Math.abs(item.value) / axisMax})`,
                      color: resolveMarketMapExtremeColor(item.value, colorScale),
                    }}
                  >
                    {toValueLabel(item.value)}
                  </span>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
