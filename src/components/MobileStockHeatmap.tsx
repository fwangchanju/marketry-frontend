import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy'
import { useLongPress } from '@/hooks/useLongPress'
import { IDENTITY, panTransform, pinchTransform, type Point, type ZoomTransform } from '@/utils/mapZoom'
import type { HeatmapItem } from '@/types/api'
import { layoutOverviewLabel } from '@/utils/overviewLabel'
import { useFontsVersion } from '@/utils/stockLabelFit'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { toPctSigned } from '@/utils/format'

import type { ColorScaleConfig } from '@/utils/heatmapColorScale'

function stockLayoutValue(stock: HeatmapItem, ratio: number) {
  return ratio <= 0 ? 1 : Math.pow(Math.max(stock.totalMarketValue, 0), ratio / 100)
}

// MOBILE 업종 지도의 맨 아래 단계 — 종목을 칸으로 그린다. 두 손가락으로 지도만 확대한다.
export default function MobileStockHeatmap({ stocks, boxSizeRatio, colorScale, decimalPlaces, onSelect, onLongPress }: {
  stocks: HeatmapItem[]
  boxSizeRatio: number
  colorScale: ColorScaleConfig
  decimalPlaces: number
  onSelect: (stock: HeatmapItem) => void
  // 길게 누르면 눌린 칸과 함께 PC용 팝업을 연다.
  onLongPress: (stock: HeatmapItem, target: HTMLElement) => void
}) {
  const { bind: bindLongPress, consumeClick } = useLongPress()
  const ref = useRef<HTMLDivElement>(null)
  const fontsVersion = useFontsVersion() // 글꼴이 늦게 로드돼 글자 폭이 달라지면 이름을 다시 맞추려고 다시 그리게 한다.
  const [size, setSize] = useState({ width: 0, height: 0 })
  // 두 손가락으로 확대하고 한 손가락으로 이동한다. 박스는 확대한 좌표·크기로 다시 놓아서, 커진 박스에는 이름이 새로 들어간다.
  // 종목 구성이 바뀌면(다른 업종·마켓으로 이동) 확대를 풀고 처음 크기로 돌아간다 — 확대 값에 그때의 종목 구성을 함께 적어 두고, 다르면 처음 크기로 본다.
  const stocksSignature = useMemo(() => stocks.map(stock => stock.stockCode).join(','), [stocks])
  const [zoomState, setZoomState] = useState<{ signature: string; transform: ZoomTransform }>({ signature: '', transform: IDENTITY })
  const zoom = zoomState.signature === stocksSignature ? zoomState.transform : IDENTITY
  const setZoom = (transform: ZoomTransform) => setZoomState({ signature: stocksSignature, transform })
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<{ start: ZoomTransform; origin: Point; distance: number } | null>(null)
  const suppressClickRef = useRef(false)
  const localPoint = (event: React.PointerEvent<HTMLElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const beginGesture = () => {
    const points = [...pointersRef.current.values()]
    const start = zoom
    if (points.length >= 2) {
      gestureRef.current = { start, origin: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) }
    } else if (points.length === 1) {
      gestureRef.current = { start, origin: points[0], distance: 0 }
    } else {
      gestureRef.current = null
    }
  }
  const handleZoomPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (pointersRef.current.size === 0) suppressClickRef.current = false
    pointersRef.current.set(event.pointerId, localPoint(event))
    if (pointersRef.current.size >= 2) suppressClickRef.current = true
    beginGesture()
  }
  const handleZoomPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, localPoint(event))
    const gesture = gestureRef.current
    if (!gesture) return
    const points = [...pointersRef.current.values()]
    if (points.length >= 2 && gesture.distance > 0) {
      suppressClickRef.current = true
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      setZoom(pinchTransform(gesture.start, gesture.distance, gesture.origin, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), mid, size.width, size.height))
    } else if (points.length === 1 && gesture.start.scale > 1) {
      const dx = points[0].x - gesture.origin.x
      const dy = points[0].y - gesture.origin.y
      if (suppressClickRef.current || Math.hypot(dx, dy) > 8) {
        suppressClickRef.current = true
        setZoom(panTransform(gesture.start, dx, dy, size.width, size.height))
      }
    }
  }
  const handleZoomPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    pointersRef.current.delete(event.pointerId)
    // 두 손가락 중 하나를 떼면 남은 손가락으로 이어서 이동한다.
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
  const boxes = useMemo(() => {
    if (size.width <= 0 || size.height <= 0 || stocks.length === 0) return []
    const root = hierarchy<{ stock?: HeatmapItem; children?: { stock: HeatmapItem }[] }>({ children: stocks.map(stock => ({ stock })) })
      .sum(node => node.stock ? stockLayoutValue(node.stock, boxSizeRatio) : 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    const layoutRoot: HierarchyRectangularNode<typeof root.data> = treemap<typeof root.data>().tile(treemapSquarify).size([size.width, size.height]).paddingInner(0)(root)
    return layoutRoot.leaves().map(leaf => ({
      stock: (leaf.data as { stock: HeatmapItem }).stock,
      x: leaf.x0,
      y: leaf.y0,
      width: leaf.x1 - leaf.x0,
      height: leaf.y1 - leaf.y0,
    }))
  }, [boxSizeRatio, size, stocks])

  return (
    <div ref={ref} data-mobile-map-scale={zoom.scale} onPointerDown={handleZoomPointerDown} onPointerMove={handleZoomPointerMove} onPointerUp={handleZoomPointerEnd} onPointerCancel={handleZoomPointerEnd} onClickCapture={event => { if (suppressClickRef.current) { suppressClickRef.current = false; event.stopPropagation() } }} style={{ touchAction: 'none' }} className="relative h-full min-h-0 w-full overflow-hidden bg-ui-surface p-1">
      {boxes.map(box => {
        const { stock } = box
        const x = box.x * zoom.scale + zoom.x + 1
        const y = box.y * zoom.scale + zoom.y + 1
        const width = box.width * zoom.scale - 2
        const height = box.height * zoom.scale - 2
        // 화면 밖으로 나간 박스는 그리지 않는다.
        if (x + width < 0 || y + height < 0 || x > size.width || y > size.height) return null
        const color = resolveHeatmapColor(stock.changeRate, colorScale)
        // 확대된 박스 전체 크기에 업종 지도와 같은 글자 계산을 적용한다. 화면에 잘린 조각은 별도로 기준 삼지 않는다.
        const name = stock.alias ?? stock.stockName
        const rateText = toPctSigned(stock.changeRate, decimalPlaces)
        const label = layoutOverviewLabel(name, rateText, width, height, fontsVersion, { splitInsideWord: true })
        const press = bindLongPress(target => onLongPress(stock, target))
        return (
          <button key={stock.stockCode} type="button" aria-label={`${stock.stockName} ${toPctSigned(stock.changeRate, decimalPlaces)}`} onClick={() => { if (!consumeClick()) onSelect(stock) }} {...press} className="select-none [-webkit-touch-callout:none] absolute flex flex-col items-center justify-center overflow-hidden border-0 p-0.5 text-center leading-tight text-white" style={{ left: x, top: y, width, height, backgroundColor: color }}>
            {label.lines.length > 0 && <span className="max-w-full overflow-hidden font-medium" style={{ fontSize: label.nameSize }}>{label.lines.map((line, index) => <span key={index} className="block whitespace-nowrap">{line}</span>)}</span>}
            {label.rateSize !== null && <span className="tabular-nums" style={{ fontSize: label.rateSize }}>{rateText}</span>}
          </button>
        )
      })}
      {zoom.scale > 1.05 && <button type="button" onClick={() => setZoom(IDENTITY)} className="absolute bottom-2 left-2 z-10 h-[32px] rounded-[4px] border-0 bg-ui-panel/95 px-3 text-[13px] font-medium text-ui-white shadow-lg">원래 크기</button>}
    </div>
  )
}
