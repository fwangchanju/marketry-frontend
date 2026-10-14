import { useLayoutEffect, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import { toPctSigned } from '@/utils/format'
import { resolveTreemapColor, type ColorScaleConfig } from '@/utils/treemapColorScale'

export interface OverviewMapItem {
  key: string
  name: string
  // 박스 크기를 정하는 시가총액
  marketValue: number
  // 박스 색과 글자로 쓰는 업종 등락률(%)
  changeRate: number
}

// 박스 크기(가로·세로의 기하평균)에 맞춰 글자 크기를 정한다 — 작은 박스는 12px 아래로 내려가지 않고, 큰 박스일수록 커진다(가장 큰 박스는 약 28px).
function nameFontSize(width: number, height: number, name: string): number {
  const span = Math.sqrt(width * height)
  const bySize = Math.round(12 + 16 * Math.sqrt(Math.min(Math.max((span - 70) / 294, 0), 1)))
  // 좁고 긴 박스에서 이름이 가장자리에 붙지 않게, 이름이 폭에 들어가는 크기를 넘지 않는다(12px 아래로는 내리지 않는다).
  const byWidth = Math.floor((width - 8) / Math.max(name.length, 1))
  return Math.max(12, Math.min(bySize, byWidth))
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
        const showRate = width >= 44 && height >= 38
        const nameSize = nameFontSize(width, height, item.name)
        const boxClassName = 'absolute flex flex-col items-center justify-center overflow-hidden border-0 p-0.5 text-center leading-tight'
        const boxStyle = { left: x, top: y, width, height, backgroundColor: background, color: '#ffffff' }
        const content = (
          <>
            {/* 이름은 줄이거나 숨기지 않고 전부 넣는다 — 박스보다 길면 `…` 없이 박스 가장자리에서 그대로 잘린다. */}
            <span className="max-w-full overflow-hidden whitespace-nowrap font-medium" style={{ fontSize: nameSize }}>{item.name}</span>
            {showRate && <span className="tabular-nums" style={{ fontSize: Math.max(12, Math.round(nameSize * 0.7)) }}>{toPctSigned(item.changeRate)}</span>}
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
