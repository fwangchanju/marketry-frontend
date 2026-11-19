import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MaximizeIcon, MinimizeIcon, ReturnArrowIcon } from '@/components/icons/AppIcons'

interface Props {
  // 지도 경로 줄 맨 앞과 같은 시장 이름(K-STOCK·S&P 500 등).
  marketLabel: string
  // 종목이 속한 분류(대분류부터) — 지도에서 어느 단계에 있든 전부 보여 준다. 비어 있으면 분류를 못 찾은 것이다.
  sectors: string[]
  // 분류 이름의 단계 이름(대분류·중분류 …) — 돌아가기 안내에 쓴다.
  levelLabels: readonly string[]
  stockName: string
  // 차트 본체(미국은 TradingView 위젯, 한국은 우리 일봉 차트).
  children: ReactNode
  // 차트를 닫고 지도로 돌아간다.
  onClose: () => void
  // 차트를 닫고 그 분류(null = 전체)의 지도로 이동한다.
  onGoToSector: (sectorName: string | null) => void
}

// 지도 경로 줄의 이름 버튼과 같은 모양.
const BREADCRUMB_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-ui-white transition-colors hover:bg-ui-white/35'

// 지도를 그리는 영역 자리에 띄우는 종목 차트 — 위쪽 경로 줄(시장 › 대분류 › 중분류 … 를 지도 경로 줄 모양 그대로 + 맨 끝에 종목명)과 TradingView 차트.
// 이름을 누르면 차트를 닫고 그 분류의 지도로 이동하고, Esc나 뒤로가기는 지금 보던 지도로 돌아간다.
export default function StockChartView({ marketLabel, sectors, levelLabels, stockName, children, onClose, onGoToSector }: Props) {
  // 차트만 전체화면으로 본다(경로 줄·툴바 없이). 화면 전체 전체화면(오른쪽 위 아이콘)과는 별개다.
  const chartRef = useRef<HTMLDivElement>(null)
  const [isChartFullscreen, setIsChartFullscreen] = useState(false)
  useEffect(() => {
    const syncFullscreen = () => setIsChartFullscreen(document.fullscreenElement === chartRef.current)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])
  const toggleChartFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void chartRef.current?.requestFullscreen()
  }
  useEffect(() => {
    // 전체화면 중에는 Esc가 전체화면부터 끝내야 하므로 차트를 닫지 않는다.
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && document.fullscreenElement === null) onClose() }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])
  return (
    <>
      <nav aria-label="종목 차트 경로" className="flex h-7 w-full shrink-0 items-center truncate bg-ui-background/70 text-lg leading-none font-bold">
        <button type="button" data-hint="전체로 돌아가기" onClick={() => onGoToSector(null)} style={{ fontFamily: 'inherit' }} className={BREADCRUMB_LINK_CLASS}>
          {marketLabel}
          <ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
        </button>
        {sectors.map((name, index) => (
          <button key={index} type="button" data-hint={`${levelLabels[index]}로 돌아가기`} onClick={() => onGoToSector(name)} style={{ fontFamily: 'inherit' }} className={BREADCRUMB_LINK_CLASS}>
            {name}
            <ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
          </button>
        ))}
        <span aria-current="page" className="px-2 text-[var(--accent)]">{stockName}</span>
        <button type="button" aria-label="차트 전체 화면" data-hint="차트 전체 화면" onClick={toggleChartFullscreen} className="ml-auto flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ui-text outline-none hover:text-[var(--accent)]">
          <MaximizeIcon strokeWidth={1.6} className="h-5 w-5" />
        </button>
      </nav>
      <div ref={chartRef} className="relative flex min-h-0 flex-1 flex-col bg-ui-background">
        {children}
        {isChartFullscreen && (
          <button type="button" aria-label="전체 화면 끄기" data-hint="전체 화면 끄기 (Esc)" onClick={toggleChartFullscreen} className="absolute right-2 top-2 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 bg-ui-background/70 p-0 text-[var(--accent)] outline-none hover:bg-ui-control">
            <MinimizeIcon strokeWidth={1.6} className="h-5 w-5" />
          </button>
        )}
      </div>
    </>
  )
}
