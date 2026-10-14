import { useLayoutEffect, useRef } from 'react'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import {
  resolveTreemapColor,
  resolveTreemapExtremeColor,
  type ColorScaleConfig,
} from '@/utils/treemapColorScale'

export interface RankColumnItem {
  key: string
  sectorName: string
  value: number
  isReference?: boolean
  // 추려서 보여줄 때 상위·하위 사이에 들어가는 "… 외 N개" 칸 — 막대와 숫자가 없고 누를 수 없다.
  hiddenCount?: number
}

export interface RankColumnsChart {
  rankedItems: RankColumnItem[]
  axisMax: number
}

const NAME_BAND_HEIGHT = 112
const LEFT_GUTTER = 40

function toValueLabel(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}`
}

// 모든 모드에서 숫자는 16px로 표시하고, SVG 영역만 회전한 글자 크기에 맞춘다.
function RankColumnValue({ value, color, heightPercent }: { value: number; color: string; heightPercent: number }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const textRef = useRef<SVGTextElement>(null)
  const label = toValueLabel(value)

  useLayoutEffect(() => {
    let active = true
    const fit = () => {
      if (!active || !svgRef.current || !textRef.current) return
      const box = textRef.current.getBBox()
      if (box.width === 0 || box.height === 0) return
      const corners = [
        [box.x, box.y], [box.x + box.width, box.y],
        [box.x, box.y + box.height], [box.x + box.width, box.y + box.height],
      ].map(([x, y]) => [(x + y) / Math.SQRT2, (y - x) / Math.SQRT2])
      const left = Math.min(...corners.map(([x]) => x))
      const top = Math.min(...corners.map(([, y]) => y))
      const size = (box.width + box.height) / Math.SQRT2
      svgRef.current.setAttribute('viewBox', `${left} ${top} ${size} ${size}`)
      svgRef.current.style.width = `${size}px`
      svgRef.current.style.height = `${size}px`
    }
    fit()
    void document.fonts.ready.then(fit)
    return () => { active = false }
  }, [label])

  return (
    <svg
      ref={svgRef}
      className="absolute left-1/2 -translate-x-1/2 overflow-visible font-bold"
      style={{ width: 60, height: 60, bottom: `calc(${heightPercent}% + 6px)` }}
      viewBox="0 -100 100 100"
      role="img"
      aria-label={label}
    >
      <text ref={textRef} x="0" y="0" transform="rotate(-45)" fill={color} style={{ fontSize: 16 }}>{label}</text>
    </svg>
  )
}

// 지수 참조 막대의 key(GroupPage가 정한다) → 시장
const INDEX_MARKET_BY_KEY: Record<string, 'KOSPI' | 'KOSDAQ'> = { 'market-index:KOSPI': 'KOSPI', 'market-index:KOSDAQ': 'KOSDAQ' }

// 막대는 절댓값만큼 위로 자라고, 부호는 색과 값으로 구분한다. 항목명은 아래에 45도 사선으로 모은다.
export default function RankColumns({
  chart,
  highlightColor,
  colorScale,
  onSelectSector,
  onSelectIndex,
}: {
  chart: RankColumnsChart
  highlightColor: string
  colorScale: ColorScaleConfig
  onSelectSector?: (sectorName: string) => void
  // 코스피·코스닥 지수 참조 막대를 눌렀을 때 — 주면 그 막대도 눌러서 이동할 수 있다.
  onSelectIndex?: (market: 'KOSPI' | 'KOSDAQ') => void
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
  // 최소 폭을 강제하지 않고 설정창을 뺀 실제 가용 폭을 모든 항목에 균등 배분한다.
  const columnsStyle = { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }

  return (
    <div
      className="flex min-h-0 min-w-0 w-full flex-1 flex-col text-[16px]"
      style={{ paddingLeft: LEFT_GUTTER, containerType: 'inline-size' }}
    >
      <div className="relative min-h-[110px] flex-1" style={{ paddingTop: 64 }}>
        <div className="relative h-full w-full">
          <div className="absolute inset-0 grid" style={columnsStyle}>
            {items.map(item => {
              if (item.hiddenCount !== undefined) {
                return (
                  <div key={item.key} className="relative h-full min-w-0">
                    <span aria-hidden="true" className="absolute bottom-0 left-1/2 -translate-x-1/2 font-bold leading-none text-gray-400">⋯</span>
                  </div>
                )
              }
              const heightPercent = (Math.abs(item.value) / axisMax) * 100
              return (
                <div key={item.key} className="relative h-full min-w-0" style={{ containerType: 'inline-size' }}>
                  <div
                    className="absolute bottom-0 left-[18%] right-[18%] rounded-sm"
                    style={{
                      backgroundColor: item.isReference ? highlightColor : resolveTreemapColor(item.value, colorScale),
                      height: `${heightPercent}%`,
                    }}
                  />
                  <RankColumnValue
                    value={item.value}
                    color={resolveTreemapExtremeColor(item.value, colorScale)}
                    heightPercent={heightPercent}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="relative shrink-0 border-t border-white/25" style={{ height: NAME_BAND_HEIGHT }}>
        <div className="absolute inset-0 grid" style={columnsStyle}>
          {items.map(item => {
            const indexMarket = item.isReference ? INDEX_MARKET_BY_KEY[item.key] : undefined
            const selectable = item.hiddenCount === undefined && (item.isReference ? onSelectIndex !== undefined && indexMarket !== undefined : onSelectSector !== undefined)
            const nameClassName = 'absolute left-1/2 top-1.5 w-max max-w-[145px] truncate whitespace-nowrap px-1 text-right font-bold'
            const nameStyle = {
              transform: 'translateX(-100%) rotate(-45deg)',
              transformOrigin: 'top right',
              color: item.isReference ? highlightColor : item.hiddenCount !== undefined ? '#9ca3af' : '#ffffff',
            }
            return (
              <div key={item.key} className="relative min-w-0">
                {selectable ? (
                  <button
                    type="button"
                    className={`${nameClassName} cursor-pointer appearance-none border-0 bg-transparent transition-colors hover:bg-white/35 focus-visible:outline focus-visible:outline-white`}
                    style={nameStyle}
                    data-hint={item.sectorName}
                    onClick={() => (indexMarket ? onSelectIndex?.(indexMarket) : onSelectSector?.(item.sectorName))}
                  >
                    {item.sectorName}
                  </button>
                ) : (
                  <span className={nameClassName} style={nameStyle} data-hint={item.sectorName}>{item.hiddenCount !== undefined ? `외 ${item.hiddenCount}개` : item.sectorName}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
