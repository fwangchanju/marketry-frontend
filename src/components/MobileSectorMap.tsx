import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import { useLongPress } from '@/hooks/useLongPress'
import { toPctSignedGrouped } from '@/utils/format'
import { resolveHeatmapColor, type ColorScaleConfig } from '@/utils/heatmapColorScale'
import { layoutOverviewLabel } from '@/utils/overviewLabel'
import { useFontsVersion } from '@/utils/stockLabelFit'
import { IDENTITY, panTransform, pinchTransform, type Point, type ZoomTransform } from '@/utils/mapZoom'

export interface MobileSectorMapItem {
  key: string
  name: string
  marketValue: number
  layoutValue?: number
  changeRate: number
}

// 모바일 업종 지도 전용 레이아웃. PC OverviewMap의 변경이 모바일 박스 배치에 전파되지 않도록 별도로 둔다.
export default function MobileSectorMap({
  items,
  colorScale,
  onSelect,
  onLongPress,
  decimalPlaces = 1,
}: {
  items: MobileSectorMapItem[]
  colorScale: ColorScaleConfig
  onSelect: (name: string) => void
  onLongPress?: (item: MobileSectorMapItem) => void
  decimalPlaces?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { bind: bindLongPress, consumeClick } = useLongPress()
  const fontsVersion = useFontsVersion()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const signature = useMemo(() => items.map(item => item.key).join(','), [items])
  const [zoomState, setZoomState] = useState<{ signature: string; transform: ZoomTransform }>({ signature: '', transform: IDENTITY })
  const zoom = zoomState.signature === signature ? zoomState.transform : IDENTITY
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<{ start: ZoomTransform; origin: Point; distance: number } | null>(null)
  const suppressClick = useRef(false)

  const localPoint = (event: React.PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const beginGesture = () => {
    const points = [...pointers.current.values()]
    if (points.length >= 2) {
      gesture.current = {
        start: zoom,
        origin: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      }
    } else if (points.length === 1) {
      gesture.current = { start: zoom, origin: points[0], distance: 0 }
    } else {
      gesture.current = null
    }
  }
  const setZoom = (transform: ZoomTransform) => setZoomState({ signature, transform })
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointers.current.size === 0) suppressClick.current = false
    pointers.current.set(event.pointerId, localPoint(event))
    if (pointers.current.size >= 2) suppressClick.current = true
    beginGesture()
  }
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, localPoint(event))
    const active = gesture.current
    if (!active) return
    const points = [...pointers.current.values()]
    if (points.length >= 2 && active.distance > 0) {
      suppressClick.current = true
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      setZoom(pinchTransform(active.start, active.distance, active.origin, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), midpoint, size.width, size.height))
    } else if (points.length === 1 && active.start.scale > 1) {
      const dx = points[0].x - active.origin.x
      const dy = points[0].y - active.origin.y
      if (suppressClick.current || Math.hypot(dx, dy) > 8) {
        suppressClick.current = true
        setZoom(panTransform(active.start, dx, dy, size.width, size.height))
      }
    }
  }
  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    beginGesture()
  }

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const rects = useMemo(() => {
    if (!size.width || !size.height || items.length === 0) return []
    const root = hierarchy<{ item?: MobileSectorMapItem; children?: { item: MobileSectorMapItem }[] }>({ children: items.map(item => ({ item })) })
      .sum(node => node.item?.layoutValue ?? node.item?.marketValue ?? 0)
      // 박스 면적은 설정값으로, 나열 순서는 원래 시가총액 합으로 결정한다.
      .sort((a, b) => (b.data.item?.marketValue ?? b.value ?? 0) - (a.data.item?.marketValue ?? a.value ?? 0))
    treemap<typeof root.data>().tile(treemapSquarify).size([size.width, size.height]).paddingInner(2)(root)
    return (root.leaves() as unknown as { x0: number; y0: number; x1: number; y1: number; data: { item: MobileSectorMapItem } }[]).map(leaf => ({
      item: leaf.data.item,
      x: leaf.x0,
      y: leaf.y0,
      width: leaf.x1 - leaf.x0,
      height: leaf.y1 - leaf.y0,
    }))
  }, [items, size])

  const labels = useMemo(() => new Map(rects.map(({ item, width, height }) => {
    const rateText = toPctSignedGrouped(item.changeRate, decimalPlaces)
    // 업종 지도의 기존 방식처럼 확대된 박스 전체 크기로 글자를 맞춘다.
    return [item.key, layoutOverviewLabel(item.name, rateText, width * zoom.scale, height * zoom.scale, fontsVersion, { splitInsideWord: true })] as const
  })), [decimalPlaces, fontsVersion, rects, zoom.scale])

  return (
    <div ref={ref} data-mobile-map-scale={zoom.scale} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerEnd} onPointerCancel={handlePointerEnd} onClickCapture={event => {
      if (!suppressClick.current) return
      suppressClick.current = false
      event.preventDefault()
      event.stopPropagation()
    }} style={{ touchAction: 'none' }} className="relative min-h-0 w-full flex-1 overflow-hidden">
      <div className="absolute inset-0" style={{ transformOrigin: '0 0', transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}>
        {rects.map(({ item, x, y, width, height }) => {
          const background = resolveHeatmapColor(item.changeRate, colorScale)
          const rateText = toPctSignedGrouped(item.changeRate, decimalPlaces)
          const label = labels.get(item.key) ?? { lines: [], nameSize: 12, rateSize: null }
          const press = bindLongPress(onLongPress ? () => onLongPress(item) : undefined)
          return (
            <button key={item.key} type="button" aria-label={`${item.name} ${rateText}`} onClick={() => { if (!consumeClick()) onSelect(item.name) }} onPointerDown={event => press.onPointerDown(event)} onPointerMove={press.onPointerMove} onPointerUp={press.onPointerUp} onPointerCancel={press.onPointerCancel} onContextMenu={press.onContextMenu} onPointerLeave={press.onPointerLeave} className="overview-map-box absolute flex flex-col items-center justify-center overflow-hidden border-0 p-0.5 text-center leading-tight select-none [-webkit-touch-callout:none]" style={{ left: x, top: y, width, height, backgroundColor: background, color: '#fff', '--heatmap-base-color': background } as React.CSSProperties}>
              <span aria-hidden="true" className="pointer-events-none flex flex-col items-center justify-center overflow-hidden p-0.5 text-center leading-tight">
                {label.lines.length > 0 && <span className="max-w-full overflow-hidden font-medium" style={{ fontSize: label.nameSize / zoom.scale }}>{label.lines.map((line, index) => <span key={index} className="block whitespace-nowrap">{line}</span>)}</span>}
                {label.rateSize !== null && <span className="tabular-nums" style={{ fontSize: label.rateSize / zoom.scale }}>{rateText}</span>}
              </span>
            </button>
          )
        })}
      </div>
      {zoom.scale > 1.05 && <button type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setZoom(IDENTITY)} className="absolute bottom-2 left-2 z-10 h-[32px] rounded-[4px] border-0 bg-ui-panel/95 px-3 text-[13px] font-medium text-ui-white shadow-lg">원래 크기</button>}
    </div>
  )
}
