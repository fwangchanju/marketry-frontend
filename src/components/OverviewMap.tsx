import { useLayoutEffect, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import { toPctSigned } from '@/utils/format'
import { resolveTreemapColor, type ColorScaleConfig } from '@/utils/treemapColorScale'
import { layoutOverviewLabel } from '@/utils/overviewLabel'

export interface OverviewMapItem {
  key: string
  name: string
  // 박스 크기를 정하는 시가총액
  marketValue: number
  // 박스 색과 글자로 쓰는 업종 등락률(%)
  changeRate: number
}

// 홈 화면용 약식 지도 — 종목 없이 업종 하나가 박스 하나다. 박스 안에는 업종명과 등락률만 적는다.
export default function OverviewMap({
  items,
  colorScale,
  onSelect,
}: {
  items: OverviewMapItem[]
  colorScale: ColorScaleConfig
  onSelect?: (name: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const rects = (() => {
    if (size.width === 0 || size.height === 0 || items.length === 0) return []
    const root = hierarchy<{ item?: OverviewMapItem; children?: { item: OverviewMapItem }[] }>({ children: items.map(item => ({ item })) })
      .sum(node => node.item?.marketValue ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    treemap<typeof root.data>().tile(treemapSquarify).size([size.width, size.height]).paddingInner(2)(root)
    return (root.leaves() as unknown as { x0: number; y0: number; x1: number; y1: number; data: { item: OverviewMapItem } }[]).map(leaf => ({
      item: leaf.data.item,
      x: leaf.x0,
      y: leaf.y0,
      width: leaf.x1 - leaf.x0,
      height: leaf.y1 - leaf.y0,
    }))
  })()

  return (
    <div ref={ref} className="relative min-h-0 w-full flex-1">
      {rects.map(({ item, x, y, width, height }) => {
        const background = resolveTreemapColor(item.changeRate, colorScale)
        const showRateWanted = width >= 44 && height >= 38
        const label = layoutOverviewLabel(item.name, width, height, showRateWanted)
        const boxClassName = 'absolute flex flex-col items-center justify-center overflow-hidden border-0 p-0.5 text-center leading-tight'
        const boxStyle = { left: x, top: y, width, height, backgroundColor: background, color: '#ffffff' }
        const content = (
          <>
            {/* 이름은 숨기지 않는다 — 한 줄에 안 들어가면 `/`(없으면 공백) 자리에서 두 줄로 나누고(utils/overviewLabel.ts), 두 줄도 안 들어가는 아주 작은 박스는 `…` 없이 박스 가장자리에서 그대로 잘린다. */}
            <span className="max-w-full overflow-hidden font-medium" style={{ fontSize: label.nameSize }}>
              {label.lines.map((line, index) => <span key={index} className="block whitespace-nowrap">{line}</span>)}
            </span>
            {label.rateSize !== null && <span className="tabular-nums" style={{ fontSize: label.rateSize }}>{toPctSigned(item.changeRate)}</span>}
          </>
        )
        // onSelect가 없으면 눌러서 이동하지 않는 그냥 박스다(홈 시장 요약 지도).
        return onSelect ? (
          <button key={item.key} type="button" aria-label={item.name} onClick={() => onSelect(item.name)} className={`${boxClassName} hover:brightness-125`} style={boxStyle}>
            {content}
          </button>
        ) : (
          <div key={item.key} role="img" aria-label={`${item.name} ${toPctSigned(item.changeRate)}`} className={boxClassName} style={boxStyle}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
