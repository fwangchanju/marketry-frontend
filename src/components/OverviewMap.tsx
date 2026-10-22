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

// 칸 사이 간격(px)과 칸이 간격에 다 깎이지 않게 남기는 최소 두께(px).
const BOX_GAP = 2
const MIN_BOX_SIZE = 1

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
  // 마우스를 올리면 뜨는 업종 팝업 — 지도가 작아서 우클릭 대신 올리는 것만으로 보이게 한다. 지도 페이지의 "마우스 올리면 팝업" 방식과 같이 커서 근처에 놓이고 커서를 따라 움직이며, 박스를 벗어나면 닫힌다.
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

  const rects = (() => {
    if (size.width === 0 || size.height === 0 || items.length === 0) return []
    const root = hierarchy<{ item?: OverviewMapItem; children?: { item: OverviewMapItem }[] }>({ children: items.map(item => ({ item })) })
      .sum(node => node.item?.marketValue ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    // 칸 사이 간격은 d3(paddingInner)에 맡기지 않고 직접 깎는다 — d3는 간격이 칸보다 크면 칸을 0px로 지워 버려, 시총이 작은 신규 상장 칸이 지도에서 사라진다. 작은 칸은 간격을 줄여 최소 MIN_BOX_SIZE는 남긴다.
    treemap<typeof root.data>().tile(treemapSquarify).size([size.width, size.height]).paddingInner(0)(root)
    const inset = (length: number) => Math.max(0, Math.min(BOX_GAP / 2, (length - MIN_BOX_SIZE) / 2))
    return (root.leaves() as unknown as { x0: number; y0: number; x1: number; y1: number; data: { item: OverviewMapItem } }[]).map(leaf => {
      const insetX = inset(leaf.x1 - leaf.x0)
      const insetY = inset(leaf.y1 - leaf.y0)
      return {
        item: leaf.data.item,
        x: leaf.x0 + insetX,
        y: leaf.y0 + insetY,
        width: leaf.x1 - leaf.x0 - insetX * 2,
        height: leaf.y1 - leaf.y0 - insetY * 2,
      }
    })
  })()

  return (
    <div ref={ref} className="relative min-h-0 w-full flex-1">
      <Popup popup={popup} onExcludeSector={() => undefined} onClose={() => setPopup(null)} />
      {rects.map(({ item, x, y, width, height }) => {
        const background = resolveTreemapColor(item.changeRate, colorScale)
        const label = layoutOverviewLabel(item.name, toPctSigned(item.changeRate), width, height, fontsVersion)
        const isPinned = popup?.targetKey === `sector:${item.key}`
        // 마우스를 올리면 지도 페이지의 종목 박스처럼 흰 막을 씌워 밝아지고 테두리가 생긴다(index.css의 .overview-map-box).
        const boxClassName = `overview-map-box absolute flex flex-col items-center justify-center overflow-hidden border-0 text-center leading-tight ${isPinned ? 'is-pinned' : ''}`
        // 안쪽 여백은 박스가 작으면 같이 줄인다 — 고정 2px면 높이가 4px보다 작은 박스(시총이 작은 신규 상장 등)가 여백 때문에 4px로 커져 지도 밖으로 삐져나간다.
        const boxStyle = { left: x, top: y, width, height, padding: Math.max(0, Math.min(2, width / 2, height / 2)), backgroundColor: background, color: '#ffffff', '--treemap-base-color': background } as React.CSSProperties
        // 마우스를 올리면 업종 정보 팝업을 열고 박스를 벗어나면 닫는다(이름이 안 들어가 빠진 박스도 여기서 이름과 등락률을 본다).
        const handlePointerEnter = (event: React.PointerEvent<HTMLElement>) => openPopup(item, event.currentTarget, { x: event.clientX, y: event.clientY })
        const handlePointerLeave = () => setPopup(previous => (previous?.targetKey === `sector:${item.key}` ? null : previous))
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
        // onSelect가 있으면 업종 지도로 이동하는 버튼으로 그린다.
        return onSelect ? (
          <button key={item.key} type="button" aria-label={item.name} onClick={() => onSelect(item.name)} onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} className={boxClassName} style={boxStyle}>
            {content}
          </button>
        ) : (
          <div key={item.key} role="img" aria-label={`${item.name} ${toPctSigned(item.changeRate)}`} onPointerEnter={handlePointerEnter} onPointerLeave={handlePointerLeave} className={boxClassName} style={boxStyle}>
            {content}
          </div>
        )
      })}
    </div>
  )
}
