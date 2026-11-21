import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import MobileTopBar from '@/components/MobileTopBar'
import MobileMapSheet, { type MobileMapMarket } from '@/components/MobileMapSheet'
import { useMobilePageSwipe } from '@/hooks/useMobilePageSwipe'

// 폰 지도 공통 화면: 상단 줄 · 툴바 줄 · 가운데 판(세로 가운데 정렬, 설정 창이 열려도 판은 움직이지 않는다) · 하단 설정 줄.
// 종목·업종·그래프 화면이 같은 틀을 쓴다. 툴바는 판 밖에 두고, 화면 폭에 맞춰 판 가로폭까지 키운다.
const TOOLBAR_BASE_HEIGHT = 28
const TOOLBAR_SIDE_GUTTER = 6
// 툴바 배지 크기는 시장의 배지 개수와 무관하게 한국 기준으로 고정한다. 좁은 화면에서만 넘치지 않게 줄인다.
const TOOLBAR_FIXED_SCALE = 0.863

export default function PhoneMapShell({ topBar, frameHeight, frame, toolbar, current, boxSize, onChangeBoxSize, onSwipe }: {
  topBar?: ReactNode
  onSwipe?: (direction: 'next' | 'previous') => void
  frameHeight: number
  frame: ReactNode
  toolbar?: ReactNode
  current: MobileMapMarket
  boxSize: number
  onChangeBoxSize: (value: number) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(TOOLBAR_FIXED_SCALE)

  const swipe = useMobilePageSwipe(
    Boolean(onSwipe),
    () => onSwipe?.('next'),
    () => onSwipe?.('previous')
  )

  // 배율은 고정하고, 툴바가 판 폭을 넘지 않을 때만 줄인다. 시장별 자연 폭 차이로 배지 크기가 달라지지 않는다.
  useLayoutEffect(() => {
    const fit = () => {
      const map = mapRef.current
      const content = contentRef.current
      if (!map || !content) return
      const natural = content.offsetWidth
      if (natural <= 0) return
      const available = map.clientWidth - TOOLBAR_SIDE_GUTTER * 2
      setScale(Math.min(TOOLBAR_FIXED_SCALE, available / natural))
    }
    fit()
    const observer = new ResizeObserver(fit)
    if (mapRef.current) observer.observe(mapRef.current)
    if (contentRef.current) observer.observe(contentRef.current)
    window.addEventListener('resize', fit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [toolbar])

  // 닫힌 설정 줄(24px)과 상단 줄(44px), 툴바 줄을 뺀 자리에서 툴바와 판을 한 묶음으로 가운데에 둔다.
  const rowHeight = TOOLBAR_BASE_HEIGHT * scale
  const frameTop = Math.max(0, (window.innerHeight - 44 - 25 - rowHeight - frameHeight) / 2)
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ui-background">
      {topBar ?? <MobileTopBar title="" />}
      <div className="relative flex min-h-0 w-full flex-1 flex-col items-stretch overflow-hidden bg-ui-background">
        <div ref={rowRef} className="relative z-[70] w-full shrink-0" style={{ height: `${rowHeight}px`, marginTop: `${frameTop}px` }}>
          <div className="origin-top-left" style={{ transform: `translateX(${TOOLBAR_SIDE_GUTTER}px) scale(${scale})` }}>
            <div ref={contentRef} className="w-max">{toolbar}</div>
          </div>
        </div>
        <div
          ref={mapRef}
          className="relative w-full shrink-0 overflow-hidden"
          style={{ height: `${frameHeight}px`, ...swipe.style }}
          {...swipe.handlers}
        >
          {frame}
        </div>
      </div>
      <MobileMapSheet current={current} boxSize={boxSize} onChangeBoxSize={onChangeBoxSize} />
    </div>
  )
}
