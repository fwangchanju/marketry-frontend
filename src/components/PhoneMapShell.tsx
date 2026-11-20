import type { ReactNode } from 'react'
import MobileTopBar from '@/components/MobileTopBar'
import MobileMapSheet, { type MobileMapMarket } from '@/components/MobileMapSheet'

// 폰 지도 공통 화면: 상단 줄 · 가운데 판(세로 가운데 정렬, 설정 창이 열려도 판은 움직이지 않는다) · 하단 설정 줄.
// 종목·업종·그래프 화면이 같은 틀을 쓴다. 판 안의 내용과 툴바 원본(toolbar)은 각 화면이 넘긴다.
export default function PhoneMapShell({ topBar, frameHeight, frame, toolbar, current, boxSize, onChangeBoxSize }: {
  topBar?: ReactNode
  frameHeight: number
  frame: ReactNode
  toolbar?: ReactNode
  current: MobileMapMarket
  boxSize: number
  onChangeBoxSize: (value: number) => void
}) {
  // 닫힌 설정 줄(24px)과 상단 줄(44px)을 뺀 자리에서 판을 가운데에 둔다.
  const frameTop = Math.max(0, (window.innerHeight - 44 - 25 - frameHeight) / 2)
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ui-background">
      {topBar ?? <MobileTopBar title="" />}
      <div className="relative flex min-h-0 w-full flex-1 items-start overflow-hidden bg-ui-background">
        <div className="relative w-full shrink-0 overflow-hidden" style={{ height: `${frameHeight}px`, marginTop: `${frameTop}px` }}>
          {frame}
        </div>
      </div>
      <MobileMapSheet current={current} boxSize={boxSize} onChangeBoxSize={onChangeBoxSize} />
      <div aria-hidden="true" className="pointer-events-none absolute left-0 right-0 top-0 h-0 overflow-hidden opacity-0">{toolbar}</div>
    </div>
  )
}
