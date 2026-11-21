import { cloneElement, isValidElement, useLayoutEffect, useState, type ReactNode } from 'react'
import MobileTopBar from '@/components/MobileTopBar'
import MobileMapSheet, { type MobileMapMarket } from '@/components/MobileMapSheet'
import { useMobilePageSwipe } from '@/hooks/useMobilePageSwipe'

// 폰 지도 공통 화면: 상단 줄 · 툴바 줄 · 가운데 판(세로 가운데 정렬, 설정 창이 열려도 판은 움직이지 않는다) · 하단 설정 줄.
// 종목·업종·그래프 화면이 같은 틀을 쓴다. 툴바는 판 밖에 두고, 화면 폭에 맞춰 판 가로폭까지 키운다.
const TOOLBAR_BASE_HEIGHT = 28
const TOOLBAR_SIDE_GUTTER = 6
// 툴바 슬롯을 한국 기준으로 고정했으므로 세 시장의 자연 폭은 모두 이 값이다. 화면을 읽지 않고 이 상수로 배율을 계산한다.
const TOOLBAR_REFERENCE_WIDTH = 438
// 툴바 배지 크기는 시장의 배지 개수와 무관하게 한국 기준으로 고정한다. 좁은 화면에서만 넘치지 않게 줄인다.
const TOOLBAR_FIXED_SCALE = 0.863

export default function PhoneMapShell({ topBar, frameHeight, frame, toolbar, pathNav, current, boxSize, onChangeBoxSize, onSwipe, nextPreview }: {
  topBar?: ReactNode
  onSwipe?: (direction: 'next' | 'previous') => void
  frameHeight: number
  frame: ReactNode
  toolbar?: ReactNode
  // 툴바 줄 아래에 붙는 업종 이동 경로. 넘기지 않으면 경로 줄 자리를 비운다.
  pathNav?: ReactNode
  current: MobileMapMarket
  boxSize: number
  onChangeBoxSize: (value: number) => void
  // 왼쪽으로 밀 때 따라오는 다음 화면 미리보기. 넘기지 않으면 예전처럼 현재 판만 움직인다.
  nextPreview?: ReactNode
}) {
  const [scale, setScale] = useState(TOOLBAR_FIXED_SCALE)

  const swipe = useMobilePageSwipe(
    Boolean(onSwipe),
    () => onSwipe?.('next'),
    () => onSwipe?.('previous')
  )

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

  // 상단 이동 버튼은 스와이프와 같은 전환을 재생한다. 이미 전환을 가진 화면(한국 업종·그룹)은 그대로 둔다.
  const topBarNode = isValidElement<{ onTitleClick?: () => void }>(topBar)
    ? onSwipe && !topBar.props.onTitleClick
      ? cloneElement(topBar, { onTitleClick: () => swipe.next() })
      : topBar
    : (topBar ?? <MobileTopBar title="" />)

  // 닫힌 설정 줄(24px)과 상단 줄(44px), 툴바 줄, 경로 줄(32px)을 뺀 자리에서 툴바와 판을 한 묶음으로 가운데에 둔다.
  const rowHeight = TOOLBAR_BASE_HEIGHT * scale
  const frameTop = Math.max(0, (window.innerHeight - 44 - 25 - rowHeight - (pathNav ? 32 : 0) - frameHeight) / 2)
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ui-background">
      {topBarNode}
      <div className="relative flex min-h-0 w-full flex-1 flex-col items-stretch overflow-hidden bg-ui-background">
        <div className="relative z-[70] w-full shrink-0" style={{ height: `${rowHeight}px`, marginTop: `${frameTop}px` }}>
          <div className="origin-top-left" style={{ transform: `translateX(${TOOLBAR_SIDE_GUTTER}px) scale(${scale})` }}>
            <div className="w-max">{toolbar}</div>
          </div>
        </div>
        {pathNav && <div className="relative z-10 w-full shrink-0">{pathNav}</div>}
        <div className="relative w-full shrink-0 overflow-hidden" style={{ height: `${frameHeight}px` }}>
          <div className="relative h-full w-full" style={swipe.style} {...swipe.handlers}>
            {frame}
            {nextPreview && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-full top-0 h-full w-full bg-ui-background"
              >
                {nextPreview}
              </div>
            )}
          </div>
        </div>
      </div>
      <MobileMapSheet current={current} boxSize={boxSize} onChangeBoxSize={onChangeBoxSize} />
    </div>
  )
}
