import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import { useLongPress } from '@/hooks/useLongPress'
import { toJoEokDecimal, toPctSigned } from '@/utils/format'
import { resolveHeatmapColor, type ColorScaleConfig } from '@/utils/heatmapColorScale'
import { layoutOverviewLabel } from '@/utils/overviewLabel'
import { useFontsVersion } from '@/utils/stockLabelFit'
import { IDENTITY, panTransform, pinchTransform, type Point, type ZoomTransform } from '@/utils/mapZoom'
import Popup, { type PopupState } from '@/components/Popup'

export interface OverviewMapItem {
  key: string
  name: string
  // 박스 크기를 정하는 시가총액
  marketValue: number
  // 화면에 그릴 박스의 면적 값 — 없으면 기존처럼 marketValue를 쓴다.
  layoutValue?: number
  // 박스 색과 글자로 쓰는 업종 등락률(%) — 시총 가중 평균이다.
  changeRate: number
  // 우클릭 팝업에 쓰는 값(지도 페이지의 업종 팝업과 같다): 동일 가중 평균(%)과 오른·내린·보합 종목 수.
  simpleAvg?: number | null
  advancers?: number
  decliners?: number
  unchanged?: number
}

// 홈 화면용 약식 지도 — 종목 없이 업종 하나가 박스 하나다. 박스 안에는 업종명과 등락률만 적는다.
export default function OverviewMap({
  items,
  colorScale,
  onSelect,
  onLongPress,
  hoverPopup = true,
  large = false,
  decimalPlaces = 2,
  zoomable = false,
}: {
  items: OverviewMapItem[]
  colorScale: ColorScaleConfig
  onSelect?: (name: string) => void
  // 손가락으로 업종을 길게 누르면 부른다(모바일 전용). 누르면 들어가는 동작과 겹치지 않도록, 길게 누른 뒤에는 뒤따르는 클릭을 무시한다.
  onLongPress?: (item: OverviewMapItem) => void
  // false면 마우스를 올려도 말풍선을 띄우지 않는다(모바일은 길게 누르는 카드로 대신한다).
  hoverPopup?: boolean
  // 박스가 큰 PC 홈은 글자를 더 키운다(최대 34px). 폰은 기존 크기(최대 28px)를 쓴다.
  large?: boolean
  decimalPlaces?: number
  zoomable?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { bind: bindLongPress, consumeClick } = useLongPress()
  const fontsVersion = useFontsVersion()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const itemsSignature = useMemo(() => items.map(item => item.key).join(','), [items])
  const [zoomState, setZoomState] = useState<{ signature: string; transform: ZoomTransform }>({ signature: '', transform: IDENTITY })
  const zoom = zoomable && zoomState.signature === itemsSignature ? zoomState.transform : IDENTITY
  const setZoom = (transform: ZoomTransform) => setZoomState({ signature: itemsSignature, transform })
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<{ start: ZoomTransform; origin: Point; distance: number } | null>(null)
  const suppressClickRef = useRef(false)
  // 마우스를 올리면 뜨는 업종 팝업 — 지도가 작아서 우클릭 대신 올리는 것만으로 보이게 한다. 지도 페이지의 "마우스 올리면 팝업" 방식과 같이 커서 근처에 놓이고 커서를 따라 움직이며, 박스를 벗어나면 닫힌다.
  const [popup, setPopup] = useState<PopupState | null>(null)

  const localPoint = (event: React.PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const beginGesture = () => {
    const points = [...pointersRef.current.values()]
    const start = zoom
    if (points.length >= 2) {
      gestureRef.current = {
        start,
        origin: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
        distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      }
    } else if (points.length === 1) {
      gestureRef.current = { start, origin: points[0], distance: 0 }
    } else {
      gestureRef.current = null
    }
  }
  const handleZoomPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomable) return
    if (pointersRef.current.size === 0) suppressClickRef.current = false
    pointersRef.current.set(event.pointerId, localPoint(event))
    if (pointersRef.current.size >= 2) suppressClickRef.current = true
    beginGesture()
  }
  const handleZoomPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomable || !pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, localPoint(event))
    const gesture = gestureRef.current
    if (!gesture) return
    const points = [...pointersRef.current.values()]
    if (points.length >= 2 && gesture.distance > 0) {
      suppressClickRef.current = true
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      setZoom(pinchTransform(
        gesture.start,
        gesture.distance,
        gesture.origin,
        Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        mid,
        size.width,
        size.height,
      ))
    } else if (points.length === 1 && gesture.start.scale > 1) {
      const dx = points[0].x - gesture.origin.x
      const dy = points[0].y - gesture.origin.y
      if (suppressClickRef.current || Math.hypot(dx, dy) > 8) {
        suppressClickRef.current = true
        setZoom(panTransform(gesture.start, dx, dy, size.width, size.height))
      }
    }
  }
  const handleZoomPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomable) return
    pointersRef.current.delete(event.pointerId)
    beginGesture()
  }

  useEffect(() => {
    if (!popup) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-heatmap-popup]')) return
      setPopup(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setPopup(null)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [popup])

  const openPopup = (item: OverviewMapItem, target: HTMLElement, pointer: { x: number; y: number }) => {
    const map = ref.current
    if (!map) return
    const rect = target.getBoundingClientRect()
    const mapRect = map.getBoundingClientRect()
    const total = (item.advancers ?? 0) + (item.decliners ?? 0) + (item.unchanged ?? 0)
    setPopup({
      title: item.name,
      rows: [
        `시총 가중: ${toPctSigned(item.changeRate)}`,
        ...(item.simpleAvg === undefined ? [] : [`동일 가중: ${item.simpleAvg === null ? '-' : toPctSigned(item.simpleAvg)}`]),
        ...(total > 0 ? [`등락 종목: ▲${item.advancers ?? 0} ▼${item.decliners ?? 0} ■${item.unchanged ?? 0}`] : []),
        `그룹 시총: ${toJoEokDecimal(item.marketValue / 100_000_000)}`,
      ],
      // 팝업은 키가 `sector:`로 시작하면 업종 배지를 붙인다. tooltip이면 마우스 이벤트를 받지 않고 pointer 근처에서 커서를 따라간다.
      targetKey: `sector:${item.key}`,
      tooltip: true,
      pointer,
      anchorRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      mapBounds: { left: mapRect.left, right: mapRect.right, top: mapRect.top, bottom: mapRect.bottom },
    })
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
    if (size.width === 0 || size.height === 0 || items.length === 0) return []
    const root = hierarchy<{ item?: OverviewMapItem; children?: { item: OverviewMapItem }[] }>({ children: items.map(item => ({ item })) })
      .sum(node => node.item?.layoutValue ?? node.item?.marketValue ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    treemap<typeof root.data>().tile(treemapSquarify).size([size.width, size.height]).paddingInner(2)(root)
    return (root.leaves() as unknown as { x0: number; y0: number; x1: number; y1: number; data: { item: OverviewMapItem } }[]).map(leaf => ({
      item: leaf.data.item,
      x: leaf.x0,
      y: leaf.y0,
      width: leaf.x1 - leaf.x0,
      height: leaf.y1 - leaf.y0,
    }))
  }, [items, size])

  // 이동 중에는 지도 레이어만 움직인다. 글자 배치 계산은 항목·배율이 바뀔 때만 다시 한다.
  const labels = useMemo(() => new Map(rects.map(({ item, width, height }) => {
    const rateText = toPctSigned(item.changeRate, decimalPlaces)
    return [item.key, layoutOverviewLabel(item.name, rateText, width * zoom.scale, height * zoom.scale, fontsVersion, { splitInsideWord: true, large })] as const
  })), [decimalPlaces, fontsVersion, large, rects, zoom.scale])

  return (
    <div
      ref={ref}
      onPointerDown={handleZoomPointerDown}
      onPointerMove={handleZoomPointerMove}
      onPointerUp={handleZoomPointerEnd}
      onPointerCancel={handleZoomPointerEnd}
      onClickCapture={event => {
        if (!suppressClickRef.current) return
        suppressClickRef.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
      style={zoomable ? { touchAction: 'none' } : undefined}
      className={`relative min-h-0 w-full flex-1 ${zoomable ? 'overflow-hidden' : ''}`}
    >
      <Popup popup={popup} onExcludeSector={() => undefined} onClose={() => setPopup(null)} />
      <div
        className="absolute inset-0"
        style={zoomable ? { transformOrigin: '0 0', transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` } : undefined}
      >
      {rects.map(({ item, x, y, width, height }) => {
        const background = resolveHeatmapColor(item.changeRate, colorScale)
        const rateText = toPctSigned(item.changeRate, decimalPlaces)
        const label = labels.get(item.key) ?? { lines: [], nameSize: 12, rateSize: null }
        const isPinned = popup?.targetKey === `sector:${item.key}`
        // 마우스를 올리면 지도 페이지의 종목 박스처럼 흰 막을 씌워 밝아지고 테두리가 생긴다(index.css의 .overview-map-box).
        const boxClassName = `overview-map-box absolute flex flex-col items-center justify-center overflow-hidden border-0 p-0.5 text-center leading-tight ${isPinned ? 'is-pinned' : ''}`
        const boxStyle = { left: x, top: y, width, height, backgroundColor: background, color: '#ffffff', '--heatmap-base-color': background } as React.CSSProperties
        // 마우스를 올리면 업종 정보 팝업을 열고 박스를 벗어나면 닫는다(이름이 안 들어가 빠진 박스도 여기서 이름과 등락률을 본다).
        const handlePointerEnter = (event: React.PointerEvent<HTMLElement>) => {
          // 말풍선은 마우스를 올렸을 때만 띄운다 — 손가락으로 업종을 누르면 바로 그 안으로 들어가서 말풍선이 필요 없고, 손가락을 떼도 닫히지 않고 손가락에 가려진다.
          if (!hoverPopup || event.pointerType === 'touch') return
          openPopup(item, event.currentTarget, { x: event.clientX, y: event.clientY })
        }
        const handlePointerLeave = () => setPopup(previous => (previous?.targetKey === `sector:${item.key}` ? null : previous))
        const content = (
          <>
            {/* 한 줄이 박스 폭에 안 맞으면 `/`, 공백, 업종 용어 경계에서 두 줄로 나눈다. 그래도 안 들어가면 이름과 등락률을 그리지 않는다(utils/overviewLabel.ts). 잘린 글자나 `…`는 만들지 않는다. */}
            {label.lines.length > 0 && (
              <span className="max-w-full overflow-hidden font-medium" style={{ fontSize: label.nameSize / zoom.scale }}>
                {label.lines.map((line, index) => <span key={index} className="block whitespace-nowrap">{line}</span>)}
              </span>
            )}
            {label.rateSize !== null && <span className="tabular-nums" style={{ fontSize: label.rateSize / zoom.scale }}>{rateText}</span>}
          </>
        )
        // onSelect가 있으면 업종 지도로 이동하는 버튼으로 그린다.
        const handleSelect = () => {
          if (consumeClick()) return
          onSelect?.(item.name)
        }
        const press = bindLongPress(onLongPress ? () => onLongPress(item) : undefined)
        return onSelect ? (
          <button key={item.key} type="button" aria-label={item.name} onClick={handleSelect} onPointerDown={event => { if (!zoomable) event.stopPropagation(); press.onPointerDown(event) }} onPointerMove={press.onPointerMove} onPointerUp={press.onPointerUp} onPointerCancel={press.onPointerCancel} onContextMenu={press.onContextMenu} onKeyDown={event => event.stopPropagation()} onPointerEnter={handlePointerEnter} onPointerLeave={() => { press.onPointerLeave(); handlePointerLeave() }} className={`${boxClassName} ${onLongPress ? 'select-none [-webkit-touch-callout:none]' : ''}`} style={boxStyle}>
            {content}
          </button>
        ) : (
          <div key={item.key} role="img" aria-label={`${item.name} ${rateText}`} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} className={boxClassName} style={boxStyle}>
            {content}
          </div>
        )
      })}
      </div>
      {zoomable && zoom.scale > 1.05 && <button type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setZoom(IDENTITY)} className="absolute bottom-2 left-2 z-10 h-[32px] rounded-[4px] border-0 bg-ui-panel/95 px-3 text-[13px] font-medium text-ui-white shadow-lg">원래 크기</button>}
    </div>
  )
}
