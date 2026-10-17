import { useLayoutEffect, useRef, useState } from 'react'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import type { RankColumnsChart } from '@/components/RankColumns'
import { resolveTreemapColor, resolveTreemapExtremeColor, type ColorScaleConfig } from '@/utils/treemapColorScale'

// 자리가 있으면 글자·막대를 키우고, 자리가 모자랄 때만 줄인다. 줄 높이(틀 높이 ÷ 항목 수)와 틀 폭에 맞춰 정한다.
const FONT_HEIGHT_RATIO = 0.38 // 줄 높이에 대한 글자 크기 비율
const FONT_WIDTH_DIVISOR = 15 // 틀 폭 ÷ 이 값을 넘게 키우지 않는다(글자만 커져 막대 칸이 사라지는 것을 막는다)
const FONT_MIN = 10
const FONT_MAX = 16
const NAME_WIDTH_EM = 6.6 // 항목명 칸 폭(글자 크기의 배수)
const VALUE_WIDTH_EM = 4 // 숫자 칸 폭(글자 크기의 배수)
const BAR_HEIGHT_RATIO = 0.6 // 줄 높이에 대한 막대 높이 비율
const BAR_MAX_FONT_RATIO = 1.6 // 막대 높이 상한(글자 크기의 배수)

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const isEmpty = items.length === 0
  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [isEmpty])
  if (items.length === 0) {
    return (
      <div className="relative min-h-0 w-full flex-1">
        <EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" />
      </div>
    )
  }
  const axisMax = Math.max(chart.axisMax, 0.5)
  const rowHeight = size ? size.height / items.length : 40
  const fontSize = size
    ? Math.min(FONT_MAX, Math.max(FONT_MIN, Math.min(rowHeight * FONT_HEIGHT_RATIO, size.width / FONT_WIDTH_DIVISOR)))
    : 14
  const nameWidth = fontSize * NAME_WIDTH_EM
  const valueWidth = fontSize * VALUE_WIDTH_EM
  const barHeight = Math.min(rowHeight * BAR_HEIGHT_RATIO, fontSize * BAR_MAX_FONT_RATIO)

  return (
    <div ref={containerRef} className="flex min-h-0 w-full flex-1 flex-col justify-between" style={{ fontSize }}>
      {items.map(item => {
        const isEllipsis = item.hiddenCount !== undefined
        const selectable = onSelectSector !== undefined && !item.isReference && !isEllipsis
        const nameClassName = 'shrink-0 truncate text-right font-bold'
        const nameColor = item.isReference ? highlightColor : isEllipsis ? 'var(--ui-muted)' : 'var(--ui-white)'
        return (
          <div key={item.key} className="flex min-h-0 flex-1 items-center gap-2">
            {selectable ? (
              <button
                type="button"
                aria-label={item.sectorName}
                onClick={() => onSelectSector(item.sectorName)}
                className={`${nameClassName} cursor-pointer appearance-none border-0 bg-transparent p-0 hover:bg-ui-white/35`}
                style={{ color: nameColor, width: nameWidth }}
              >
                {item.sectorName}
              </button>
            ) : (
              <span className={nameClassName} style={{ color: nameColor, width: nameWidth }}>{item.sectorName}</span>
            )}
            <div className="relative min-w-0 flex-1" style={{ height: barHeight }}>
              {isEllipsis ? (
                <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 leading-none text-ui-muted">⋯</span>
              ) : (
                <>
                  <div
                    className="absolute left-0 top-0 h-full rounded-sm border border-ui-control"
                    style={{
                      width: `calc((100% - ${valueWidth}px) * ${Math.abs(item.value) / axisMax})`,
                      backgroundColor: item.isReference ? highlightColor : resolveTreemapColor(item.value, colorScale),
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1.5 font-bold tabular-nums"
                    style={{
                      left: `calc((100% - ${valueWidth}px) * ${Math.abs(item.value) / axisMax})`,
                      color: resolveTreemapExtremeColor(item.value, colorScale),
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
