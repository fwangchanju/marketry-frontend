import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTreemapLayout, type DisplayGroup, type LaidOutSector } from '@/hooks/useTreemapLayout'
import SectorBox from './SectorBox'
import Popup, { type PopupContent, type PopupState } from './Popup'
import type { ColorScaleConfig } from '@/utils/treemapColorScale'
import type { StockLabelMode } from '@/hooks/useGlobalSettings'

interface Props {
  groups: DisplayGroup[]
  selfSectorName: string | null
  // depth는 지금 드릴다운 깊이(path.length) — 줌 방향(들어가는지/나가는지) 판단과, 뎁스별 진입 지점을
  // 기억해뒀다가 나갈 때 그대로 되감기 위한 키로 쓴다.
  depth: number
  onSelectSector: (sectorName: string) => void
  onExcludeSector: (sectorId: number, sectorName: string) => void
  heightClassName?: string
  // 셋 다 null = 전부 꺼짐. [min, max]면 그 뎁스 범위(현재 화면 기준 상대 뎁스)에서만 표시.
  marketValueDepthRange: [number, number] | null
  weightedAvgDepthRange: [number, number] | null
  simpleAvgDepthRange: [number, number] | null
  upDownCountDepthRange: [number, number] | null
  // 0이면 종목별 동일 크기, 100이면 시가총액 비례로 박스 크기를 계산한다.
  boxSizeMarketCapRatio: number
  // 가로 늘리기 배율(1이면 그대로) — 분류마다 다르게 정한다(utils/mapStretch.ts).
  stretch?: number
  // 박스를 놓는 방식(시험용) — utils/mapStretch.ts.
  tile?: 'squarify' | 'binary'
  // 커스텀 모드가 아닐 때는(기본 분류 트리) 섹터 제외 액션 자체를 제공하지 않는다.
  canExclude: boolean
  // 하위 StockBox까지 그대로 관통해서 전달 — 박스 색칠 설정의 단일 출처(어드민 라이브 프리뷰에서는
  // 저장 전 draft config가 그대로 여기 들어와서 드래그 중에도 실시간으로 반영된다).
  colorScale: ColorScaleConfig
  // 하위 StockBox까지 그대로 관통해서 전달 — 종목명/등락률 표시 여부를 가르는 넓이 비중(%) 기준.
  labelMinAreaPercent: number
  // 하위 StockBox까지 그대로 관통해서 전달 — 종목명만/등락률만/둘 다 보여줄지.
  stockLabelMode: StockLabelMode
  // 종목 정보 팝업을 우클릭(false)/마우스 올리기(true) 중 뭘로 띄울지 — 업종 팝업은 항상 우클릭.
  stockPopupOnHover: boolean
  // 하위 SectorBox/StockBox까지 그대로 관통해서 전달 — 등락률(%) 표시 소수점 자릿수.
  decimalPlaces: number
  topPickSectorKeys: Set<string>
  strongIndustryColor: string
  // 0이 아닌 뎁스가 오면 그 뎁스로 진입할 때 썼던 위치로 줄어드는 애니메이션을 재생한다.
  zoomOutRequestDepth: number | null
  onZoomOutComplete: (depth: number) => void
}

// 컨테이너 기준 0~1 비율 좌표 — 컨테이너 크기가 나중에 달라져도(리사이즈) 값이 그대로 유효하다.
interface RelativeRect {
  left: number
  top: number
  width: number
  height: number
}

// 사라지는(줌인 땐 옛 화면, 줌아웃 땐 방금까지 보던 화면) 스냅샷을 실제 화면 위에 겹쳐 그렸다가
// 트랜지션 끝나면 치우는 "고스트" 레이어. direction에 따라 실제 콘텐츠보다 위/아래 어느 쪽에 그릴지가 다르다
// (줌인: 실제 콘텐츠가 고스트를 덮으며 커짐 / 줌아웃: 고스트가 실제 콘텐츠를 덮은 채 줄어들며 사라짐).
interface GhostOverlay {
  sectors: LaidOutSector[]
  depth: number
  direction: 'in' | 'out'
  style: React.CSSProperties
}

const ZOOM_IN_DURATION = 500
const ZOOM_OUT_DURATION = 440
// 처음에 빠르게 튀어나오고 끝에서 부드럽게 멈추는 곡선 — 누른 박스에서 "터져 나오는" 느낌을 준다.
const ZOOM_EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
// 진입은 시작이 부드러운 표준 곡선 — 빠르게 튀어나가는 곡선을 쓰면 첫 프레임에서 박스가 툭 튀어나와 보인다.
const ZOOM_IN_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
// 진입 때 새 화면이 투명에서 나타나는 시간 비율(시작 박스 자리에서 갑자기 나타나지 않게 한다).
const ZOOM_IN_FADE_RATIO = 0.35
// 진입/복귀 때 주변(형제) 화면에 덮는 어두운 막 — 누른 박스만 밝게 남아서 "여기서 시작했다"는 인상을 준다.
const DIM_OPACITY = 0.55
// 진입 때 옛 화면이 누른 박스를 중심으로 이 배율까지 커지며 사라진다 — 나갈 때 큰 화면이 줄어드는 움직임과 대칭.
const OLD_SCREEN_SCALE = 1.15
const DIM_IN_DURATION = 120 // 진입: 막이 어두워지는 시간(이후 나머지 시간 동안 걷힌다)
const noop = () => {}

function toRelativeRect(rect: DOMRect, containerRect: DOMRect): RelativeRect {
  return {
    left: (rect.left - containerRect.left) / containerRect.width,
    top: (rect.top - containerRect.top) / containerRect.height,
    width: rect.width / containerRect.width,
    height: rect.height / containerRect.height,
  }
}

// 전체 크기(스케일 1)로 그려진 컨테이너가, 특정 작은 사각형(rect) 위치/크기인 것처럼 보이게 만드는 transform.
// transform-origin을 0 0으로 두고 translate 뒤에 scale을 적용하면(둘 다 컨테이너 픽셀 기준),
// 왼쪽위 모서리가 정확히 rect의 왼쪽위로, 나머지 모서리도 비율대로 rect 크기에 맞게 줄어든다.
function toShrinkTransform(rect: RelativeRect, containerRect: DOMRect): string {
  const left = rect.left * containerRect.width
  const top = rect.top * containerRect.height
  return `translate(${left}px, ${top}px) scale(${rect.width}, ${rect.height})`
}

export default function Treemap({
  groups,
  selfSectorName,
  depth,
  onSelectSector,
  onExcludeSector,
  heightClassName = 'h-[70vh]',
  marketValueDepthRange,
  weightedAvgDepthRange,
  simpleAvgDepthRange,
  upDownCountDepthRange,
  boxSizeMarketCapRatio,
  stretch,
  tile,
  canExclude,
  colorScale,
  labelMinAreaPercent,
  stockLabelMode,
  stockPopupOnHover,
  decimalPlaces,
  topPickSectorKeys,
  strongIndustryColor,
  zoomOutRequestDepth,
  onZoomOutComplete,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [popup, setPopup] = useState<PopupState | null>(null)
  // 실제(현재) 콘텐츠 wrapper에 거는 transform/opacity — 줌인일 때만 쓴다(작게 시작해서 꽉 차게 커짐).
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties | undefined>(undefined)
  // 사라지는 옛 화면을 실제 콘텐츠 위/아래에 겹쳐 그리는 고스트 — 형제 섹터들이 순간 사라지지 않고
  // 서서히 페이드아웃(줌인)/줄어들며 사라지도록(줌아웃) 보여준다.
  const [ghost, setGhost] = useState<GhostOverlay | null>(null)
  // 주변을 어둡게 덮는 막 — zIndex 0은 실제 콘텐츠 아래(진입: 커지는 박스는 덮지 않고 고스트만 어둡게),
  // 5는 실제 콘텐츠 위·복귀 고스트(10) 아래(복귀: 위쪽 화면이 덮여 있다가 걷힌다).
  const [dim, setDim] = useState<{ zIndex: number; style: React.CSSProperties } | null>(null)
  // 진입 때 커지는 박스 테두리 강조 — 실제 콘텐츠 wrapper 안에 그려서 박스와 함께 커지며 옅어진다.
  const [startHighlight, setStartHighlight] = useState<React.CSSProperties | null>(null)
  // 좌클릭으로 줌인이 시작될 때 헤더 hover 테두리가 잠깐 반짝이지 않게 끈다 — onHeaderPressStart
  // (헤더 pointerdown, 왼쪽 버튼만)로 눌리는 즉시 켜고, handleSelectSector(click, 줌인 시작)에서도
  // 다시 켠다(중복이지만 무해). 줌 애니메이션이 끝나고 사용자가 다시 마우스를 움직이면(아래
  // onPointerMove) 꺼진다. 예전엔 index.css의 CSS :active로 이 "누르는 순간"을 처리했는데, :active는
  // 버튼을 구분 못 해서 우클릭(팝업) 프레스 중에도 같이 켜지는 버그가 있어 JS로 옮겼다.
  const [suppressSectorHoverBorder, setSuppressSectorHoverBorder] = useState(false)
  // 섹터 진입(클릭) 시점에 캡처한 "그 박스가 화면에서 차지하던 위치" — 뎁스별로 기억해뒀다가
  // 다시 나갈 때 정확히 그 자리로 줄어드는 반대 애니메이션에 재사용한다.
  const entryRectsRef = useRef<Map<number, RelativeRect>>(new Map())
  // 클릭~실제 path 반영(재렌더) 사이에 잠깐 들고 있는 값들 — 클릭 시점엔 아직 depth/groups가 안 바뀌어
  // 있어서, 새 depth로 렌더된 뒤(useLayoutEffect)에야 확정해서 쓴다.
  const pendingEnterRectRef = useRef<RelativeRect | null>(null)
  const outgoingSnapshotRef = useRef<{ sectors: LaidOutSector[]; depth: number } | null>(null)
  const prevDepthRef = useRef(depth)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const entry = entries[0]
      if (!entry) return
      // contentRect가 소수점 단위라, 브라우저 줌/DPI 조합에 따라 실제로는 안 바뀐 크기를 매 프레임
      // 미세하게 다르게(예: 1234.4 → 1234.6) 보고하는 경우가 있다. 정수로 반올림해서 비교하고,
      // 값이 그대로면 리렌더(트리맵 재계산)를 아예 건너뛰어 이 흔들림이 무한 재계산으로 이어지지 않게 막는다.
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 시가총액 차이를 거듭제곱으로 압축하는 비율을 레이아웃 계산에 전달한다.
  const sectors = useTreemapLayout(groups, selfSectorName, size.width, size.height, boxSizeMarketCapRatio, stretch, tile)

  // 팝업을 마우스 좌표가 아니라 우클릭한 박스(섹터 전체 박스, 혹은 종목 박스)의 화면상 위치에 붙인다.
  // 여기서는 그 박스의 뷰포트 기준 rect만 그대로 popup 상태에 실어두고, 그 rect의 어느 가장자리에
  // 어느 쪽으로 붙일지(오른쪽/왼쪽, 위/아래 뒤집기)는 실제 팝업 크기를 알아야 정확히 판단할 수 있어서
  // Popup 쪽에서 렌더 후 측정해서 계산한다(Popup.tsx 참고).
  const handleOpenPopup = (content: PopupContent, target: HTMLElement) => {
    const map = containerRef.current
    if (!map) return
    const rect = target.getBoundingClientRect()
    const mapRect = map.getBoundingClientRect()
    setPopup({
      ...content,
      anchorRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      mapBounds: { left: mapRect.left, right: mapRect.right, top: mapRect.top, bottom: mapRect.bottom },
    })
  }

  // 커서 이동 방식 팝업을 닫는다 — 이미 다른 대상의 팝업으로 바뀌었으면(targetKey 불일치) 건드리지 않는다.
  const handleClosePopup = (targetKey: string) => {
    setPopup(prev => (prev?.targetKey === targetKey && prev.tooltip ? null : prev))
  }

  // 팝업이 떠 있는 대상(섹터/종목)의 식별 키 — 그 박스에만 초록 하이라이트를 붙이는 데 쓴다.
  // popup 상태 자체가 곧 하이라이트 대상의 단일 출처라 별도 state 없이 파생시킨다.
  const highlightedKey = popup?.targetKey ?? null

  useEffect(() => {
    if (!popup) return
    const handlePointerDown = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-treemap-popup]')) return
      setPopup(null)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
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

  // 섹터 클릭 시점의(=아직 이전 뎁스 화면인 상태의) 박스 위치와, 지금 화면 전체(형제 포함) 스냅샷을
  // 미리 잡아두고 실제 이동을 요청한다. 새 뎁스로 리렌더된 뒤 아래 useLayoutEffect가 이 값들을 읽어서
  // "그 자리에서 확대되면서, 형제들은 서서히 사라지는" 애니메이션을 만든다.
  const handleSelectSector = (sectorName: string, rect: DOMRect) => {
    setSuppressSectorHoverBorder(true)
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (containerRect && containerRect.width > 0 && containerRect.height > 0) {
      pendingEnterRectRef.current = toRelativeRect(rect, containerRect)
    }
    outgoingSnapshotRef.current = { sectors, depth }
    onSelectSector(sectorName)
  }

  useLayoutEffect(() => {
    const containerRect = containerRef.current?.getBoundingClientRect()

    if (depth > prevDepthRef.current) {
      // 줌인: 이번 뎁스 진입에 쓰인 rect를 건너뛴 구간 전부에 저장해두고(나중에 되감기용 — "전체" 화면에서는
      // 세부 섹터를 바로 클릭해서 여러 뎁스를 한 번에 건너뛸 수 있다), 방금 새로 그려진(꽉 찬 크기)
      // 실제 콘텐츠를 그 rect 자리/크기로 순간 이동시켰다가 다음 프레임에 원래 크기로 트랜지션한다 —
      // FLIP(First-Last-Invert-Play) 기법. 옛 화면 스냅샷은 고스트로 실제 콘텐츠 아래 깔아서, 실제
      // 콘텐츠가 커지며 덮어가는 동안 형제들이 서서히 페이드아웃하듯 보이게 한다.
      const pendingRect = pendingEnterRectRef.current
      const snapshot = outgoingSnapshotRef.current
      pendingEnterRectRef.current = null
      outgoingSnapshotRef.current = null
      if (pendingRect && containerRect) {
        for (let d = prevDepthRef.current; d < depth; d++) {
          entryRectsRef.current.set(d, pendingRect)
        }
        const originX = (pendingRect.left + pendingRect.width / 2) * containerRect.width
        const originY = (pendingRect.top + pendingRect.height / 2) * containerRect.height
        const ghostOrigin = `${originX}px ${originY}px`
        setGhost(
          snapshot
            ? {
                sectors: snapshot.sectors,
                depth: snapshot.depth,
                direction: 'in',
                style: { opacity: 1, transform: 'none', transformOrigin: ghostOrigin, transition: 'none' },
              }
            : null,
        )
        setStartHighlight({ opacity: 1, transition: 'none' })
        setZoomStyle({
          transform: toShrinkTransform(pendingRect, containerRect),
          opacity: 0,
          transition: 'none',
        })
        setDim({ zIndex: 0, style: { opacity: 0, transition: 'none' } })
        requestAnimationFrame(() => {
          setGhost(prev =>
            prev
              ? {
                  ...prev,
                  style: {
                    opacity: 0,
                    transform: `scale(${OLD_SCREEN_SCALE})`,
                    transformOrigin: ghostOrigin,
                    transition: `opacity ${ZOOM_IN_DURATION}ms ease-out, transform ${ZOOM_IN_DURATION}ms ${ZOOM_IN_EASE}`,
                  },
                }
              : null,
          )
          setStartHighlight({ opacity: 0, transition: `opacity ${ZOOM_IN_DURATION}ms ease-out` })
          setZoomStyle({
            transform: 'none',
            opacity: 1,
            transition: `transform ${ZOOM_IN_DURATION}ms ${ZOOM_IN_EASE}, opacity ${ZOOM_IN_DURATION * ZOOM_IN_FADE_RATIO}ms ease-out`,
          })
          setDim({ zIndex: 0, style: { opacity: DIM_OPACITY, transition: `opacity ${DIM_IN_DURATION}ms ease-out` } })
        })
        const dimFadeTimer = window.setTimeout(
          () => setDim({ zIndex: 0, style: { opacity: 0, transition: `opacity ${ZOOM_IN_DURATION - DIM_IN_DURATION}ms ease-in` } }),
          DIM_IN_DURATION,
        )
        const timer = window.setTimeout(() => {
          setGhost(null)
          setDim(null)
          setStartHighlight(null)
        }, ZOOM_IN_DURATION)
        prevDepthRef.current = depth
        return () => {
          window.clearTimeout(timer)
          window.clearTimeout(dimFadeTimer)
        }
      }
    } else if (depth < prevDepthRef.current) {
      // 줌아웃: onZoomOutComplete가 이미 실제 이동을 끝낸 뒤라(아래 useEffect에서 이동 전에 스냅샷만
      // 먼저 떠둠), 지금 sectors는 이미 "더 얕은 뎁스"의 실제 콘텐츠(형제 포함)다. 방금까지 보던
      // 화면(스냅샷)을 고스트로 그 위에 통째로 덮어 씌운 채, 나갈 때 썼던 rect 자리로 줄이면서
      // 페이드아웃시켜 걷어내고, 배경(실제 콘텐츠)도 같은 시간 동안 페이드인시켜 둘이 하나의
      // 전환처럼 이어지게 한다(배경만 트랜지션 없이 툭 나타나면 고스트랑 따로 노는 것처럼 보였다).
      const rect = entryRectsRef.current.get(depth)
      const snapshot = outgoingSnapshotRef.current
      outgoingSnapshotRef.current = null
      if (rect && containerRect && snapshot) {
        setZoomStyle({ opacity: 0, transition: 'none' })
        setGhost({
          sectors: snapshot.sectors,
          depth: snapshot.depth,
          direction: 'out',
          style: { transform: 'none', opacity: 1, transition: 'none' },
        })
        setDim({ zIndex: 5, style: { opacity: DIM_OPACITY, transition: 'none' } })
        requestAnimationFrame(() => {
          setDim({ zIndex: 5, style: { opacity: 0, transition: `opacity ${ZOOM_OUT_DURATION}ms ease-in` } })
          setZoomStyle({ opacity: 1, transition: `opacity ${ZOOM_OUT_DURATION}ms ease-in` })
          setGhost(prev =>
            prev
              ? {
                  ...prev,
                  style: {
                    transform: toShrinkTransform(rect, containerRect),
                    opacity: 0,
                    transition: `transform ${ZOOM_OUT_DURATION}ms ${ZOOM_EASE}, opacity ${ZOOM_OUT_DURATION}ms ease-in`,
                  },
                }
              : null,
          )
        })
        const timer = window.setTimeout(() => {
          setGhost(null)
          setDim(null)
        }, ZOOM_OUT_DURATION)
        prevDepthRef.current = depth
        return () => window.clearTimeout(timer)
      }
    }
    prevDepthRef.current = depth
  }, [depth, groups])

  // 줌아웃 트리거 — breadcrumb 클릭으로 부모가 zoomOutRequestDepth를 지정하면, 지금(=곧 사라질) 화면의
  // 스냅샷을 먼저 떠두고 바로 실제 이동을 요청한다. 실제 애니메이션은 위 useLayoutEffect가 depth가
  // 줄어든 걸 감지해서 재생한다(이동이 이미 끝난 뒤라 실제 콘텐츠가 밑에 다 그려져 있는 상태).
  useEffect(() => {
    if (zoomOutRequestDepth == null) return
    outgoingSnapshotRef.current = { sectors, depth }
    onZoomOutComplete(zoomOutRequestDepth)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomOutRequestDepth])

  return (
    // d3 반올림 오차로 우측 하단 박스가 컨테이너를 아주 살짝 넘칠 수 있는데, overflow가 열려있으면 그게
    // 페이지 스크롤바를 만들고, 스크롤바가 생기면 컨테이너 너비가 줄어서 ResizeObserver가 다시 계산 →
    // 이번엔 안 넘쳐서 스크롤바가 사라지고 너비가 늘고 → 다시 계산... 무한 루프(우측 하단이 떨리는 현상)로
    // 이어진다. overflow-hidden으로 이 삐져나옴 자체를 화면에서 잘라내 루프의 시작을 막는다.
    <div
      ref={containerRef}
      className={`relative isolate w-full overflow-hidden bg-black ${heightClassName} ${suppressSectorHoverBorder ? 'treemap-suppress-sector-border' : ''}`}
      onPointerMove={() => {
        if (suppressSectorHoverBorder && !ghost) setSuppressSectorHoverBorder(false)
      }}
      onPointerLeave={() => setSuppressSectorHoverBorder(false)}
    >
      {/* 줌인일 땐 고스트(옛 화면)를 실제 콘텐츠보다 아래(zIndex -1)에 깔아서, 커지는 실제 콘텐츠가
          덮어가며 형제들을 가리게 하고, 줌아웃일 땐 반대로 위(zIndex 10)에 덮어서 줄어들며 걷히게 한다.
          transform-origin은 항상 '0 0'으로 고정 — zoomStyle 쪽 객체에 넣으면 identity로 바뀔 때 origin
          값이 통째로 빠지면서 브라우저가 origin까지 같이 보간해버려(중앙으로 드리프트), 줌이 클릭 지점이
          아니라 화면 중앙에서 일어나는 것처럼 보이는 버그가 있었다. */}
      {ghost && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ transformOrigin: '0 0', zIndex: ghost.direction === 'out' ? 10 : -1, ...ghost.style }}
        >
          {ghost.sectors.map(sector => (
            <SectorBox
              key={sector.sectorName}
              sector={sector}
              depthOffset={ghost.depth}
              onSelectSector={noop}
              onOpenPopup={noop}
              onClosePopup={noop}
              stockPopupOnHover={false}
              onHeaderPressStart={noop}
              highlightedKey={null}
              ancestorPath=""
              marketValueDepthRange={marketValueDepthRange}
              weightedAvgDepthRange={weightedAvgDepthRange}
              simpleAvgDepthRange={simpleAvgDepthRange}
              upDownCountDepthRange={upDownCountDepthRange}
              canExclude={false}
              colorScale={colorScale}
              labelMinAreaPercent={labelMinAreaPercent}
              stockLabelMode={stockLabelMode}
              decimalPlaces={decimalPlaces}
              topPickSectorKeys={topPickSectorKeys}
              strongIndustryColor={strongIndustryColor}
            />
          ))}
        </div>
      )}
      {dim && <div className="pointer-events-none absolute inset-0 bg-black" style={{ zIndex: dim.zIndex, ...dim.style }} />}
      <div className="absolute inset-0" style={{ transformOrigin: '0 0', ...zoomStyle }}>
        {startHighlight && (
          <div
            className="pointer-events-none absolute inset-0 z-[5]"
            style={{ boxShadow: `inset 0 0 0 10px ${strongIndustryColor}`, ...startHighlight }}
          />
        )}
        {sectors.map(sector => (
          <SectorBox
            key={sector.sectorName}
            sector={sector}
            depthOffset={depth}
            onSelectSector={handleSelectSector}
            onOpenPopup={handleOpenPopup}
            onClosePopup={handleClosePopup}
            stockPopupOnHover={stockPopupOnHover}
            onHeaderPressStart={() => setSuppressSectorHoverBorder(true)}
            highlightedKey={highlightedKey}
            ancestorPath=""
            marketValueDepthRange={marketValueDepthRange}
            weightedAvgDepthRange={weightedAvgDepthRange}
            simpleAvgDepthRange={simpleAvgDepthRange}
            upDownCountDepthRange={upDownCountDepthRange}
            canExclude={canExclude}
            colorScale={colorScale}
            labelMinAreaPercent={labelMinAreaPercent}
            stockLabelMode={stockLabelMode}
            decimalPlaces={decimalPlaces}
            topPickSectorKeys={topPickSectorKeys}
            strongIndustryColor={strongIndustryColor}
          />
        ))}
      </div>
      <Popup popup={popup} onExcludeSector={onExcludeSector} onClose={() => setPopup(null)} />
    </div>
  )
}
