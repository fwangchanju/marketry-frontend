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

// PC 서머리의 가로 순위 막대처럼 절댓값을 길이로, 부호는 숫자와 색으로 표시한다.
export default function MobileGraphBars({ items, colorScale, highlightColor }: {
  items: MobileGraphItem[]
  colorScale: ColorScaleConfig
  highlightColor: string
}) {
  const sorted = mobileGraphRank(items)
  const max = Math.ceil(Math.max(1, ...sorted.map(item => Math.abs(item.value))) * 2) / 2
  // 항목이 적으면 한 줄이 화면 높이만큼 늘어나지 않게 높이를 제한하고, 8개 이상이면 MOBILE 길이에 맞춰 아래까지 채운다.
  const rowCap = sorted.length < 8 ? 'max-h-[96px]' : ''
  if (!sorted.length) return <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 항목이 없습니다.</p>
  return (
    <div className="h-full touch-pan-y overflow-y-auto">
      <div className="flex min-h-full flex-col" style={{ height: `max(100%, ${sorted.length * 48}px)` }}>
        {sorted.map(item => {
          if ('hiddenCount' in item && item.hiddenCount !== undefined) return <div key={item.key} className={`flex min-h-[48px] ${rowCap} flex-1 items-center gap-2 text-[28px] text-ui-muted`}><span className="w-[200px] shrink-0 pr-2 text-right font-bold">외 {item.hiddenCount}개</span><span aria-hidden="true">⋮</span></div>
          if (!('name' in item)) return null
          const content = <>
            {/* 이름 배지 — 업종으로 들어가는 곳은 이 글자 부분뿐이다(줄 전체를 누르면 스크롤하다 잘못 들어가서). PC 그래프의 호버(흰 35%)와 같은 색을 손가락으로 누르는 동안 보여 준다. */}
            <span className="flex w-[200px] shrink-0 items-center justify-end self-stretch pr-2 font-bold" style={{ color: item.reference ? `color-mix(in srgb, ${highlightColor} var(--ui-data-text-mix), var(--ui-on-light))` : 'var(--ui-white)' }}>{item.onSelect ? <button type="button" onClick={item.onSelect} className="h-full max-w-full truncate border-0 bg-transparent px-1 active:bg-ui-white/35">{item.name}</button> : <span className="max-w-full truncate px-1">{item.name}</span>}</span>
            <span className="relative min-w-0 flex-1">
              <span className="block h-[40px] rounded-sm border border-ui-control" style={{ width: `${Math.abs(item.value) / max * 100}%`, backgroundColor: item.reference ? highlightColor : resolveHeatmapColor(item.value, colorScale) }} />
              <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-1 font-bold tabular-nums" style={{ left: `${Math.abs(item.value) / max * 100}%`, color: `color-mix(in srgb, ${resolveHeatmapExtremeColor(item.value, colorScale)} var(--ui-data-text-mix), var(--ui-on-light))` }}>{item.value > 0 ? '+' : ''}{item.value.toFixed(1)}%</span>
            </span>
          </>
          return <div key={item.key} className={`flex min-h-[48px] ${rowCap} flex-1 w-full items-center gap-2 pr-[144px] text-left text-[28px]`}>{content}</div>
        })}
      </div>
    </div>
  )
}
