import { createContext } from 'react'

// 종목 차트의 차트만 전체 화면 — 경로 줄을 그리는 쪽(StockChartView)이 상태를 갖고, 버튼은 차트의 봉 단위 줄(StockCandleChart)에 둔다.
export const ChartFullscreenContext = createContext<{ isFullscreen: boolean; toggle: () => void } | null>(null)
