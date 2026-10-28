import type { ColorScaleConfig } from '@/utils/heatmapColorScale'
import { resolveHeatmapColor, resolveHeatmapExtremeColor } from '@/utils/heatmapColorScale'
import { mobileGraphRank } from '@/utils/mobileGraphRank'

export interface MobileGraphItem {
  key: string
  name: string
  value: number
  reference?: boolean
  onSelect?: () => void
}

// PC 홈의 가로 순위 막대처럼 절댓값을 길이로, 부호는 숫자와 색으로 표시한다.
export default function MobileGraphBars({ items, colorScale, highlightColor }: {
  items: MobileGraphItem[]
  colorScale: ColorScaleConfig
  highlightColor: string
}) {
  const sorted = mobileGraphRank(items)
  const max = Math.ceil(Math.max(1, ...sorted.map(item => Math.abs(item.value))) * 2) / 2
  // 항목이 적으면 한 줄이 화면 높이만큼 늘어나지 않게 높이를 제한하고, 8개 이상이면 폰 길이에 맞춰 아래까지 채운다.
  const rowCap = sorted.length < 8 ? 'max-h-[48px]' : ''
  if (!sorted.length) return <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 항목이 없습니다.</p>
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex min-h-full flex-col" style={{ height: `max(100%, ${sorted.length * 24}px)` }}>
        {sorted.map(item => {
          if ('hiddenCount' in item && item.hiddenCount !== undefined) return <div key={item.key} className={`flex min-h-[24px] ${rowCap} flex-1 items-center gap-2 text-[14px] text-ui-muted`}><span className="w-[108px] shrink-0 pr-2 text-right font-bold">외 {item.hiddenCount}개</span><span aria-hidden="true">⋮</span></div>
          if (!('name' in item)) return null
          const content = <>
            <span className="w-[108px] shrink-0 truncate pr-2 text-right font-bold" style={{ color: item.reference ? `color-mix(in srgb, ${highlightColor} var(--ui-data-text-mix), var(--ui-on-light))` : 'var(--ui-white)' }}>{item.name}</span>
            <span className="relative min-w-0 flex-1">
              <span className="block h-[20px] rounded-sm border border-ui-control" style={{ width: `${Math.abs(item.value) / max * 100}%`, backgroundColor: item.reference ? highlightColor : resolveHeatmapColor(item.value, colorScale) }} />
              <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1 font-bold tabular-nums" style={{ left: `${Math.abs(item.value) / max * 100}%`, color: `color-mix(in srgb, ${resolveHeatmapExtremeColor(item.value, colorScale)} var(--ui-data-text-mix), var(--ui-on-light))` }}>{item.value > 0 ? '+' : ''}{item.value.toFixed(2)}%</span>
            </span>
          </>
          const className = `flex min-h-[24px] ${rowCap} flex-1 w-full items-center gap-2 pr-[72px] text-left text-[14px]`
          return item.onSelect
            ? <button key={item.key} type="button" onClick={item.onSelect} className={`${className} border-0 bg-transparent`}>{content}</button>
            : <div key={item.key} className={className}>{content}</div>
        })}
      </div>
    </div>
  )
}
