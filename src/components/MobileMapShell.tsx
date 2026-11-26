import { useLocation, useNavigate } from 'react-router-dom'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MobileToolbarContext } from '@/components/MobileToolbarContext'
import MobileTopBar from '@/components/MobileTopBar'
import MobileMapTopActions from '@/components/MobileMapTopActions'
import { useDisableScreenZoom, useMobilePageSwipe } from '@/hooks/useMobilePageSwipe'
import Popup, { type PopupState } from '@/components/Popup'
import { TOOLBAR_SIDE_GUTTER } from '@/utils/mobilePathBar'
import { adjacentMobileMarket, MOBILE_MARKET_BADGE, mobileMarketPath, type MobileMapMarket } from '@/utils/mobileMarketRoutes'
import MarketFlagIcon from '@/components/MarketFlagIcon'
import { holdCountrySwipeArrival } from '@/utils/mobileSwipeArrivalOverlay'

// MOBILE 지도 공통 화면: 상단 줄(가운데 페이지 이름, 오른쪽 박스 크기·사용 방법) · 가운데 판 · 맨 아래 툴바 줄.
// 종목·업종·그래프 화면이 같은 틀을 쓴다. 툴바는 판 밖에 두고, 화면 폭에 맞춰 판 가로폭까지 키운다.
// 하단 설정 줄은 없앴다(2026-11-27 사용자 결정) — 페이지·나라는 밀어서 바꾸고 박스 크기는 상단 줄로 옮겼다.
// 툴바 줄 높이. 배지는 MOBILE에서만 위아래로 조금 키운다(index.css의 [data-mobile-toolbar-slot] 규칙, 가로·글자는 PC와 같다).
const TOOLBAR_BASE_HEIGHT = 41
// 상단 줄 높이(MobileTopBar).
const TOP_BAR_HEIGHT = 52
// 화면 맨 아래 툴바 줄과 화면 끝 사이 여백 — 바닥에 붙인다(툴바 줄 안의 여백만 남김, 2026-11-27 사용자 결정). 아이폰 홈 막대 자리는 따로 더한다.
const TOOLBAR_BOTTOM_GAP = 0
// 툴바 슬롯을 한국 기준으로 고정했으므로 세 시장의 자연 폭은 모두 이 값이다. 화면을 읽지 않고 이 상수로 배율을 계산한다.
const TOOLBAR_REFERENCE_WIDTH = 438
// 툴바 배지 크기는 시장의 배지 개수와 무관하게 한국 기준으로 고정한다. 좁은 화면에서만 넘치지 않게 줄인다.
const TOOLBAR_FIXED_SCALE = 0.863

export default function MobileMapShell({ pageTitle, boxSizeDisabled = false, frameHeight, frame, toolbar, current, boxSize, onChangeBoxSize, onSwipe, onBeforeSwipeNavigate, nextPreview, previousPreview, zoomMode, infoPopup, onCloseInfoPopup, navigationKey }: {
  // 상단 줄 가운데에 보이는 지금 페이지 이름(누르기 기능 없음).
  pageTitle: string
  // 그룹 등락률처럼 박스가 없는 페이지는 박스 크기 아이콘을 흐리게 막는다.
  boxSizeDisabled?: boolean
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
    {
      element: swipeFrame,
      // 아래로 밀기는 쓰지 않는다 — 브라우저 새로고침을 쓴다(2026-11-27 사용자 결정, 직접 만든 새로고침 판은 뺌).
      allowPrevious: false,
      onSwipe: direction => {
        // 위로 밀기는 국가 변경이다. 한국 → 일본 → 미국 → 한국으로 돌아가므로 한 방향으로 세 나라를 모두 간다.
        const target = adjacentMobileMarket(current, direction)
        // 밀려 나간 판 자리를 새 나라 화면이 다 그려질 때까지 빈 판으로 덮는다. 종목 지도는 지도 배치가 잡힐 때까지 기다린다.
        const pane = swipeFrame?.querySelector<HTMLElement>(`[data-country-pane="${direction}"]`) ?? null
        holdCountrySwipeArrival(swipeFrame?.parentElement ?? null, target, location.pathname.startsWith('/map/'), pane)
        navigate(mobileMarketPath(target, location.pathname), { state: { mobileBoxSize: boxSize } })
      },
    }
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

  // 툴바 줄은 화면 맨 아래에 붙이고(엄지 쪽, 2026-11-27 사용자 결정), 판은 상단 줄과 툴바 줄 사이 남는 자리의 가운데에 둔다.
  // 경로 줄은 페이지 내용 안에 있어 따로 빼지 않는다.
  const rowHeight = TOOLBAR_BASE_HEIGHT * scale
  const frameTop = Math.max(0, (window.innerHeight - TOP_BAR_HEIGHT - rowHeight - TOOLBAR_BOTTOM_GAP - frameHeight) / 2)
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ui-background">
      <MobileTopBar title={pageTitle} right={<MobileMapTopActions boxSize={boxSize} onChangeBoxSize={onChangeBoxSize} boxSizeDisabled={boxSizeDisabled} />} />
      <div className="relative flex min-h-0 w-full flex-1 flex-col items-stretch overflow-hidden bg-ui-background">
        {/* 화면 높이가 모자라면(주소창이 큰 폰 브라우저) 툴바 줄이 밀려 나가지 않도록 판 쪽이 줄어들어 아래가 잘린다. */}
        <div className="relative min-h-0 w-full shrink overflow-hidden" style={{ height: `${frameHeight}px`, marginTop: `${frameTop}px` }}>
          <div ref={setSwipeFrame} data-mobile-shell-frame={current} className="relative h-full w-full" style={swipe.style} {...swipe.handlers}>
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
            {/* 위아래로 미는 동안 따라오는 다음·이전 나라 판 — 국기와 시장 이름만 보인다(2026-11-27 사용자 결정). 위로 밀면 아래 판, 아래로 밀면 위 판. */}
            {swipe.verticalOffset !== 0 && (
              <>
                <CountryPane direction="next" market={adjacentMobileMarket(current, 'next')} visible={Math.min(Math.max(-swipe.verticalOffset, 0), frameHeight)} height={frameHeight} transition={swipe.style?.transition} />
              </>
            )}
          </div>
        </div>
        <div data-mobile-toolbar-slot className="relative z-[70] w-full shrink-0" style={{ height: `${rowHeight}px`, marginTop: 'auto', marginBottom: `calc(${TOOLBAR_BOTTOM_GAP}px + env(safe-area-inset-bottom))` }}>
          <div className="origin-top-left" style={{ transform: `translateX(${TOOLBAR_SIDE_GUTTER}px) scale(${scale})` }}>
            <MobileToolbarContext.Provider value={{ isMobile: true, scale }}>
              <div className="w-max">{toolbar}</div>
            </MobileToolbarContext.Provider>
          </div>
        </div>
      </div>
      {infoPopup && <Popup popup={infoPopup} onExcludeSector={() => {}} onClose={onCloseInfoPopup ?? (() => {})} mobileEnlarged />}
    </div>
  )
}

// 국기와 시장 이름 묶음은 판에서 화면에 드러난 부분의 가운데에 둔다. 조금만 밀어도 둘이 같이 보이고, 다 올라오면 판 한가운데에 온다.
// 손을 뗀 뒤 판이 미끄러지는 동안에는 판과 같은 전환으로 따라 움직인다.
const COUNTRY_BADGE_HALF_HEIGHT = 50

function CountryPane({ direction, market, visible, height, transition }: { direction: 'next' | 'previous'; market: MobileMapMarket; visible: number; height: number; transition?: string }) {
  const badge = MOBILE_MARKET_BADGE[market]
  const center = Math.max(visible / 2, Math.min(COUNTRY_BADGE_HALF_HEIGHT, visible - COUNTRY_BADGE_HALF_HEIGHT))
  const top = direction === 'next' ? center : height - center
  return (
    <div
      aria-hidden="true"
      data-country-pane={direction}
      className={`pointer-events-none absolute left-0 h-full w-full bg-ui-background ${direction === 'next' ? 'top-full' : 'bottom-full'}`}
    >
      <div
        className="absolute left-0 flex w-full -translate-y-1/2 flex-col items-center gap-5"
        style={{ top: `${top}px`, transition: transition?.replace('transform', 'top') }}
      >
        <MarketFlagIcon flag={badge.flag} className="!h-[40px]" />
        <span className="text-[22px] font-bold leading-none text-ui-muted">{badge.label}</span>
      </div>
    </div>
  )
}
