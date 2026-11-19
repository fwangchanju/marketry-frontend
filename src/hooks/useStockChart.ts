import { useCallback, useEffect, useRef, useState } from 'react'

// 종목 차트를 여는 방식 — 우클릭(팝업의 차트 아이콘), 클릭, 더블 클릭. 설정창 실험 탭의 "종목 차트"에서 고른다.
export type StockChartTrigger = 'rightClick' | 'click' | 'doubleClick'

export interface ChartStock {
  code: string
  name: string
  // 종목이 속한 분류(대분류부터) — 차트 위 경로 줄에 지도 경로 줄처럼 보여 준다.
  sectorPath: string[]
}

// 지도 자리에 종목 차트를 띄우고 닫는 상태 — 브라우저 기록 한 칸을 차트에 쓴다. 차트를 열면 기록을 한 칸 쌓고,
// 브라우저·마우스 뒤로가기를 누르면 이전 페이지가 아니라 차트에서 지도로 돌아온다. 버튼·Esc로 닫을 때는 그 칸을 같이 되돌린다.
// 업종 단계 기록(useMapDrilldownHistory)처럼 현재 기록의 state를 이어받아 칸을 쌓으므로 두 기록이 서로 어긋나지 않는다.
export function useStockChart() {
  const [chartStock, setChartStock] = useState<ChartStock | null>(null)
  // 닫힌 뒤에 이어서 할 일(예: 경로 이름을 눌러 그 단계의 지도로 가기).
  const afterCloseRef = useRef<(() => void) | null>(null)

  const openChart = useCallback((stock: ChartStock) => {
    if (!window.history.state?.stockChart) window.history.pushState({ ...(window.history.state ?? {}), stockChart: true }, '')
    setChartStock(stock)
  }, [])

  // 차트 칸이 맨 위에 있으면 뒤로 가서 칸을 없앤다(아래 popstate가 차트를 닫는다). 칸이 없으면 바로 닫는다.
  // afterClose는 지도가 다시 그려진 뒤에 실행한다(지도가 없는 동안에는 업종 줌아웃을 시작할 수 없다).
  const closeChart = useCallback((afterClose?: () => void) => {
    afterCloseRef.current = afterClose ?? null
    if (window.history.state?.stockChart) window.history.back()
    else {
      setChartStock(null)
      runAfterClose()
    }
    function runAfterClose() {
      const next = afterCloseRef.current
      afterCloseRef.current = null
      if (next) window.setTimeout(next, 0)
    }
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      if (window.history.state?.stockChart) return
      setChartStock(null)
      const next = afterCloseRef.current
      afterCloseRef.current = null
      if (next) window.setTimeout(next, 0)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return { chartStock, openChart, closeChart }
}
