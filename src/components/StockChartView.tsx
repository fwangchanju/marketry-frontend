import { useEffect } from 'react'
import StockChartPanel from '@/components/StockChartPanel'
import { ReturnArrowIcon } from '@/components/icons/AppIcons'

interface Props {
  // 지도 경로 줄 맨 앞과 같은 시장 이름(K-STOCK·S&P 500 등).
  marketLabel: string
  // 종목이 속한 분류(대분류부터) — 지도에서 어느 단계에 있든 전부 보여 준다. 비어 있으면 분류를 못 찾은 것이다.
  sectors: string[]
  // 분류 이름의 단계 이름(대분류·중분류 …) — 돌아가기 안내에 쓴다.
  levelLabels: readonly string[]
  stockName: string
  symbol: string
  timezone: string
  // 차트를 닫고 지도로 돌아간다.
  onClose: () => void
  // 차트를 닫고 그 분류(null = 전체)의 지도로 이동한다.
  onGoToSector: (sectorName: string | null) => void
}

// 지도 경로 줄의 이름 버튼과 같은 모양.
const BREADCRUMB_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-ui-white transition-colors hover:bg-ui-white/35'

// 지도를 그리는 영역 자리에 띄우는 종목 차트 — 위쪽 경로 줄(시장 › 대분류 › 중분류 … 를 지도 경로 줄 모양 그대로 + 맨 끝에 종목명)과 TradingView 차트.
// 이름을 누르면 차트를 닫고 그 분류의 지도로 이동하고, Esc나 뒤로가기는 지금 보던 지도로 돌아간다.
export default function StockChartView({ marketLabel, sectors, levelLabels, stockName, symbol, timezone, onClose, onGoToSector }: Props) {
  useEffect(() => {
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
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
      </nav>
      <StockChartPanel symbol={symbol} timezone={timezone} />
    </>
  )
}
