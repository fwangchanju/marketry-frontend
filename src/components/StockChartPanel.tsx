import { useEffect, useRef } from 'react'

interface Props {
  // TradingView 이름("KRX:005930" 형식).
  symbol: string
  // 차트 시간대(예: Asia/Seoul).
  timezone: string
}

// 지도 영역 자리에 그리는 TradingView 무료 Advanced Chart 위젯. 위젯은 자기 서버의 지연 시세를 직접 보여 주므로
// 이 사이트의 시세 데이터와 섞이지 않는다. 종목이 바뀌면 위젯을 새로 만든다.
const WIDGET_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'

export default function StockChartPanel({ symbol, timezone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const isLight = document.documentElement.dataset.theme === 'light'
    // 위젯 배경을 메인 영역과 같은 색으로 맞춘다. 토큰을 못 읽으면 위젯 기본 배경을 쓴다.
    const background = getComputedStyle(document.documentElement).getPropertyValue('--ui-background').trim()
    const widget = document.createElement('div')
    widget.className = 'tradingview-widget-container__widget'
    widget.style.height = '100%'
    widget.style.width = '100%'
    const script = document.createElement('script')
    script.src = WIDGET_SRC
    script.async = true
    script.type = 'text/javascript'
    script.text = JSON.stringify({
      autosize: true,
      symbol,
      interval: 'D',
      timezone,
      theme: isLight ? 'light' : 'dark',
      style: '1',
      locale: 'kr',
      allow_symbol_change: false,
      hide_top_toolbar: false,
      save_image: false,
      support_host: 'https://www.tradingview.com',
      ...(background ? { backgroundColor: background } : {}),
    })
    container.replaceChildren(widget, script)
    // 위젯은 뜨자마자 키보드 포커스를 가져가서 Esc(차트 닫기)가 페이지에 닿지 않는다. 처음 한 번만 포커스를 페이지로 돌려놓는다.
    // 사용자가 차트 안을 직접 누른 뒤에는 건드리지 않는다.
    let released = false
    const releaseFocus = () => {
      if (released) return
      const active = document.activeElement
      if (active instanceof HTMLIFrameElement && container.contains(active)) {
        released = true
        active.blur()
      }
    }
    const timers = [400, 1200, 2500, 4500].map(ms => window.setTimeout(releaseFocus, ms))
    return () => {
      timers.forEach(window.clearTimeout)
      container.replaceChildren()
    }
  }, [symbol, timezone])

  return <div ref={containerRef} className="tradingview-widget-container min-h-0 flex-1" data-capture-ignore />
}
