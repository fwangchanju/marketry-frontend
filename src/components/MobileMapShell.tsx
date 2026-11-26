import { useLocation, useNavigate } from 'react-router-dom'
import { cloneElement, isValidElement, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MobileToolbarContext } from '@/components/MobileToolbarContext'
import MobileTopBar from '@/components/MobileTopBar'
import MobileMapSheet, { type MobileMapMarket } from '@/components/MobileMapSheet'
import { useDisableScreenZoom, useMobilePageSwipe } from '@/hooks/useMobilePageSwipe'
import Popup, { type PopupState } from '@/components/Popup'
import { TOOLBAR_SIDE_GUTTER } from '@/utils/mobilePathBar'
import { adjacentMobileMarket, mobileMarketPath } from '@/utils/mobileMarketRoutes'

// MOBILE 지도 공통 화면: 상단 줄 · 툴바 줄 · 가운데 판(세로 가운데 정렬, 설정 창이 열려도 판은 움직이지 않는다) · 하단 설정 줄.
// 종목·업종·그래프 화면이 같은 틀을 쓴다. 툴바는 판 밖에 두고, 화면 폭에 맞춰 판 가로폭까지 키운다.
const TOOLBAR_BASE_HEIGHT = 28
// 툴바 슬롯을 한국 기준으로 고정했으므로 세 시장의 자연 폭은 모두 이 값이다. 화면을 읽지 않고 이 상수로 배율을 계산한다.
const TOOLBAR_REFERENCE_WIDTH = 438
// 툴바 배지 크기는 시장의 배지 개수와 무관하게 한국 기준으로 고정한다. 좁은 화면에서만 넘치지 않게 줄인다.
const TOOLBAR_FIXED_SCALE = 0.863

export default function MobileMapShell({ topBar, frameHeight, frame, toolbar, current, boxSize, onChangeBoxSize, onSwipe, onBeforeSwipeNavigate, nextPreview, previousPreview, zoomMode, infoPopup, onCloseInfoPopup, navigationKey }: {
  topBar?: ReactNode
  onSwipe?: (direction: 'next' | 'previous') => void
  // 화면 위치(시장·업종 경로·보기 모드)가 바뀌면 팝업을 여기서 닫는다. 스와이프와 상단 이동은 셸이 시작 시점을 직접 안다. 페이지마다 닫기 호출을 넣지 않는다.
  navigationKey?: string
  // 주소가 바뀌기 직전에 해당 방향의 미리보기 판을 덮개로 남길지 정한다(종목 지도 도착 번쩍임 방지).
  onBeforeSwipeNavigate?: (direction: 'next' | 'previous') => void
  frameHeight: number
  frame: ReactNode
  toolbar?: ReactNode
  current: MobileMapMarket
  boxSize: number
  onChangeBoxSize: (value: number) => void
  // 왼쪽으로 밀 때 오른쪽에서 따라오는 다음 화면 미리보기, 오른쪽으로 밀 때 왼쪽에서 따라오는 이전 화면 미리보기.
  // 넘기지 않으면 그 방향은 현재 판만 움직인다.
  // 함수로 넘기면 미는 동안에만 그린다(종목 전체를 그리는 무거운 미리보기용).
  nextPreview?: ReactNode | (() => ReactNode)
  previousPreview?: ReactNode | (() => ReactNode)
  // 종목 지도는 화면 확대를 받지만 업종 지도·그룹 등락률은 막는다. 문서와 안쪽 판 설정을 여기서 함께 정한다.
  // 기본값을 두지 않아 새 화면이 정책을 빠뜨리면 컴파일에서 막힌다.
  zoomMode: 'pinch' | 'blocked'
  // 업종 지도 MOBILE 팝업 — 공통 훅이 만든 상태를 받아 여기서 한 번만 렌더한다.
  infoPopup?: PopupState | null
  onCloseInfoPopup?: () => void
}) {
  const [scale, setScale] = useState(TOOLBAR_FIXED_SCALE)
  const zoomBlocked = zoomMode === 'blocked'
  useDisableScreenZoom(zoomBlocked)

  // 하위 업종 진입처럼 주소가 그대로인 이동도 여기서 팝업을 닫는다. 그리기 전에 닫아 이전 팝업이 비치지 않는다.
  const lastNavigationKeyRef = useRef(navigationKey)
  useLayoutEffect(() => {
    if (lastNavigationKeyRef.current === navigationKey) return
    lastNavigationKeyRef.current = navigationKey
    onCloseInfoPopup?.()
  }, [navigationKey, onCloseInfoPopup])

  // 위아래 밀기는 나라 이동이다(위로 밀면 한국 → 일본 → 미국 → 한국). 보던 페이지 종류와 박스 크기는 그대로 가져간다.
  const navigate = useNavigate()
  const location = useLocation()
  const [swipeFrame, setSwipeFrame] = useState<HTMLDivElement | null>(null)
  const swipe = useMobilePageSwipe(
    Boolean(onSwipe),
    () => onSwipe?.('next'),
    () => onSwipe?.('previous'),
    onBeforeSwipeNavigate,
    !zoomBlocked,
    // 팝업은 판과 함께 움직이지 않으므로 넘어간 뒤가 아니라 밀기 시작할 때 닫는다.
    onCloseInfoPopup,
    { element: swipeFrame, onSwipe: direction => navigate(mobileMarketPath(adjacentMobileMarket(current, direction), location.pathname), { state: { mobileBoxSize: boxSize } }) }
  )
  const renderPreview = (preview: ReactNode | (() => ReactNode)) => typeof preview === 'function' ? (swipe.active ? preview() : null) : preview

  // 화면을 읽지 않고 창 폭과 기준 폭으로만 배율을 정한다. 로딩 중 툴바 내용이 바뀌어도 재측정·재배치가 없다.
  useLayoutEffect(() => {
    const fit = () => {
      const available = window.innerWidth - TOOLBAR_SIDE_GUTTER * 2
      setScale(Math.min(TOOLBAR_FIXED_SCALE, available / TOOLBAR_REFERENCE_WIDTH))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  // 상단 이동 버튼은 스와이프와 같은 전환을 재생한다.
  const topBarNode = isValidElement<{ onTitleClick?: () => void }>(topBar)
    ? onSwipe && !topBar.props.onTitleClick
      ? cloneElement(topBar, { onTitleClick: () => swipe.next() })
      : topBar
    : (topBar ?? <MobileTopBar title="" />)

  // 닫힌 설정 줄(24px)과 상단 줄(44px), 툴바 줄을 뺀 자리에서 툴바와 판을 한 묶음으로 가운데에 둔다.
  // 경로 줄은 페이지 내용 안에 있어 따로 빼지 않고, 열린 설정 줄(40px)이 차지할 자리만 절반 미리 빼 둔다.
  const rowHeight = TOOLBAR_BASE_HEIGHT * scale
  const frameTop = Math.max(0, (window.innerHeight - 44 - 25 - rowHeight - 40 - frameHeight) / 2)
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ui-background">
      {topBarNode}
      <div className="relative flex min-h-0 w-full flex-1 flex-col items-stretch overflow-hidden bg-ui-background">
        <div data-mobile-toolbar-slot className="relative z-[70] w-full shrink-0" style={{ height: `${rowHeight}px`, marginTop: `${frameTop}px` }}>
          <div className="origin-top-left" style={{ transform: `translateX(${TOOLBAR_SIDE_GUTTER}px) scale(${scale})` }}>
            <MobileToolbarContext.Provider value={{ isMobile: true, scale }}>
              <div className="w-max">{toolbar}</div>
            </MobileToolbarContext.Provider>
          </div>
        </div>
        <div className="relative w-full shrink-0 overflow-hidden" style={{ height: `${frameHeight}px` }}>
          <div ref={setSwipeFrame} className="relative h-full w-full" style={swipe.style} {...swipe.handlers}>
            {frame}
            {nextPreview && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-0 h-full w-full bg-ui-background"
              >
                {renderPreview(nextPreview)}
              </div>
            )}
            {previousPreview && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-full top-0 h-full w-full bg-ui-background"
              >
                {renderPreview(previousPreview)}
              </div>
            )}
          </div>
        </div>
      </div>
      <MobileMapSheet current={current} boxSize={boxSize} onChangeBoxSize={onChangeBoxSize} />
      {infoPopup && <Popup popup={infoPopup} onExcludeSector={() => {}} onClose={onCloseInfoPopup ?? (() => {})} mobileEnlarged />}
    </div>
  )
}
