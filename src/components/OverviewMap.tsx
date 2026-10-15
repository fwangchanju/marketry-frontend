import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import { toJoEokDecimal, toPctSigned } from '@/utils/format'
import { resolveTreemapColor, type ColorScaleConfig } from '@/utils/treemapColorScale'
import { layoutOverviewLabel } from '@/utils/overviewLabel'
import { useFontsVersion } from '@/utils/stockLabelFit'
import Popup, { type PopupState } from '@/components/Popup'

export interface OverviewMapItem {
  key: string
  name: string
  // 박스 크기를 정하는 시가총액
  marketValue: number
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
}: {
  items: OverviewMapItem[]
  colorScale: ColorScaleConfig
  onSelect?: (name: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fontsVersion = useFontsVersion()
  const [size, setSize] = useState({ width: 0, height: 0 })
  // 우클릭 팝업 — 지도 페이지처럼 박스 가장자리에 붙고, 떠 있는 동안 그 박스는 마우스를 올린 색으로 고정한다. 팝업 밖을 누르거나 Esc를 누르면 닫힌다.
  const [popup, setPopup] = useState<PopupState | null>(null)

  useEffect(() => {
    if (!popup) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-treemap-popup]')) return
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

  const openPopup = (item: OverviewMapItem, totalValue: number, target: HTMLElement) => {
    const map = ref.current
    if (!map) return
    const rect = target.getBoundingClientRect()
    const mapRect = map.getBoundingClientRect()
    const total = (item.advancers ?? 0) + (item.decliners ?? 0) + (item.unchanged ?? 0)
    const share = totalValue > 0 ? (item.marketValue / totalValue) * 100 : null
    setPopup({
      title: item.name,
      rows: [
        `시총 가중: ${toPctSigned(item.changeRate)}`,
        ...(item.simpleAvg === undefined ? [] : [`동일 가중: ${item.simpleAvg === null ? '-' : toPctSigned(item.simpleAvg)}`]),
        ...(total > 0 ? [`등락 종목: ▲${item.advancers ?? 0} ▼${item.decliners ?? 0} ■${item.unchanged ?? 0}`] : []),
        `그룹 시총: ${toJoEokDecimal(item.marketValue / 100_000_000)}`,
        ...(share === null ? [] : [`지도 비중: ${share.toFixed(1)}%`]),
      ],
      // 팝업은 키가 `sector:`로 시작하면 업종 배지를 붙인다.
      targetKey: `sector:${item.key}`,
      tooltip: false,
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

  const totalMarketValue = items.reduce((sum, item) => sum + item.marketValue, 0)

  return (
    <div ref={ref} className="relative min-h-0 w-full flex-1">
      <Popup popup={popup} onExcludeSector={() => undefined} onClose={() => setPopup(null)} />
      {rects.map(({ item, x, y, width, height }) => {
        const background = resolveTreemapColor(item.changeRate, colorScale)
        const label = layoutOverviewLabel(item.name, toPctSigned(item.changeRate), width, height, fontsVersion)
        const isPinned = popup?.targetKey === `sector:${item.key}`
        // 마우스를 올리면 지도 페이지의 종목 박스처럼 흰 막을 씌워 밝아지고 테두리가 생긴다(index.css의 .overview-map-box). 팝업이 떠 있는 동안에도 같은 모양을 유지한다.
        const boxClassName = `overview-map-box absolute flex flex-col items-center justify-center overflow-hidden border-0 p-0.5 text-center leading-tight ${isPinned ? 'is-pinned' : ''}`
        const boxStyle = { left: x, top: y, width, height, backgroundColor: background, color: '#ffffff', '--treemap-base-color': background } as React.CSSProperties
        // 우클릭하면 업종 정보 팝업을 연다. 이름이 안 들어가 빠진 박스는 올리면 이름과 등락률이 뜬다.
        const handleContextMenu = (event: React.MouseEvent<HTMLElement>) => {
          event.preventDefault()
          event.stopPropagation()
          openPopup(item, totalMarketValue, event.currentTarget)
        }
        const hint = label.lines.length === 0 ? `${item.name} ${toPctSigned(item.changeRate)}` : undefined
        const content = (
          <>
            {/* 한 줄에 안 들어가면 `/`(없으면 공백) 자리에서 두 줄로 나누고, 두 줄로도 안 들어가면 이름과 등락률을 모두 그리지 않는다(utils/overviewLabel.ts). 잘린 글자나 `…`는 만들지 않는다. */}
            {label.lines.length > 0 && (
              <span className="max-w-full overflow-hidden font-medium" style={{ fontSize: label.nameSize }}>
                {label.lines.map((line, index) => <span key={index} className="block whitespace-nowrap">{line}</span>)}
              </span>
            )}
            {label.rateSize !== null && <span className="tabular-nums" style={{ fontSize: label.rateSize }}>{toPctSigned(item.changeRate)}</span>}
          </>
        )
        // onSelect가 없으면 눌러서 이동하지 않는 그냥 박스다(홈 시장 요약 지도).
        return onSelect ? (
          <button key={item.key} type="button" aria-label={item.name} data-hint={hint} onClick={() => onSelect(item.name)} onContextMenu={handleContextMenu} className={boxClassName} style={boxStyle}>
            {content}
          </button>
        ) : (
          <div key={item.key} role="img" aria-label={`${item.name} ${toPctSigned(item.changeRate)}`} data-hint={hint} onContextMenu={handleContextMenu} className={boxClassName} style={boxStyle}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
