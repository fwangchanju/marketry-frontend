import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CandlestickSeries, ColorType, HistogramSeries, createChart } from 'lightweight-charts'
import { getJapanStockDailyCandles, getStockDailyCandles, getUsaStockDailyCandles } from '@/api/stockChart'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import MainAreaLoading from '@/components/MainAreaLoading'
import Spinner from '@/components/Spinner'

interface Props {
  stockCode: string
  // 어느 시장의 일봉인지 — 한국은 키움 일봉, 일본·미국은 야후 일봉을 읽는다.
  market: 'korea' | 'japan' | 'usa'
  // 오른 날·내린 날의 봉 색 — 지도 박스와 같은 등락률 색상 설정에서 가져온다.
  upColor: string
  downColor: string
}

// 받아 오는 기간(일) — 서버가 허용하는 최대치(10년)라 보관된 일봉을 전부 받는다. 처음에는 최근 VISIBLE_BARS개만 보이고, 왼쪽으로 끌면 이전 기록이 나온다.
const CANDLE_DAYS = 3650
const VISIBLE_BARS = 120
// 격자선은 봉보다 눈에 띄지 않게 옅게 깐다.
const GRID_ALPHA = 0.35
// 거래량 막대는 차트 아래쪽 20%만 쓴다.
const VOLUME_TOP_MARGIN = 0.85
// 거래량 막대는 봉보다 눈에 띄지 않게 반투명으로 깐다.
const VOLUME_ALPHA = 0.45

const DAILY_CANDLE_LOADERS = { korea: getStockDailyCandles, japan: getJapanStockDailyCandles, usa: getUsaStockDailyCandles }

// 차트 라이브러리는 color-mix() 같은 최신 색 표기를 읽지 못해서, 어떤 색이든 canvas로 한 칸 칠해 rgb 값으로 바꿔 넘긴다.
function toRgb(color: string, fallback: string): string {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!context) return fallback
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
  return alpha === 0 ? fallback : `rgb(${red}, ${green}, ${blue})`
}

function withAlpha(rgb: string, alpha: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
}

// 지도 자리에 그리는 종목 일봉 차트 — TradingView Lightweight Charts(오픈소스)에 우리 일봉 데이터를 넣어 그린다.
export default function StockCandleChart({ stockCode, market, upColor, downColor }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stock-daily-candles', market, stockCode, CANDLE_DAYS],
    queryFn: ({ signal }) => DAILY_CANDLE_LOADERS[market](stockCode, CANDLE_DAYS, signal),
    staleTime: 60_000,
  })
  const hasCandles = (data?.length ?? 0) > 0

  useEffect(() => {
    const container = containerRef.current
    if (!container || !data || data.length === 0) return
    const styles = getComputedStyle(document.documentElement)
    const background = toRgb(styles.getPropertyValue('--ui-background').trim(), 'rgb(10, 10, 10)')
    const textColor = toRgb(styles.getPropertyValue('--ui-white').trim() || styles.getPropertyValue('--ui-text').trim(), 'rgb(235, 235, 235)')
    const gridColor = withAlpha(toRgb(styles.getPropertyValue('--ui-control').trim(), 'rgb(42, 42, 42)'), GRID_ALPHA)
    const up = toRgb(upColor, 'rgb(220, 60, 60)')
    const down = toRgb(downColor, 'rgb(60, 110, 220)')
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: background }, textColor },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor: gridColor },
      timeScale: { borderColor: gridColor },
      localization: { locale: 'ko-KR', priceFormatter: (price: number) => Math.round(price).toLocaleString('ko-KR') },
    })
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down,
    })
    candles.setData(data.map(({ date, open, high, low, close }) => ({ time: date, open, high, low, close })))
    // 거래량은 같은 차트의 아래쪽에 봉과 같은 색으로 깐다.
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' })
    volume.priceScale().applyOptions({ scaleMargins: { top: VOLUME_TOP_MARGIN, bottom: 0 } })
    volume.setData(data.map(({ date, open, close, volume: amount }) => ({ time: date, value: amount, color: withAlpha(close >= open ? up : down, VOLUME_ALPHA) })))
    if (data.length > VISIBLE_BARS) chart.timeScale().setVisibleLogicalRange({ from: data.length - VISIBLE_BARS, to: data.length })
    else chart.timeScale().fitContent()
    return () => chart.remove()
  }, [data, upColor, downColor])

  if (isLoading) return <MainAreaLoading><Spinner showElapsed /></MainAreaLoading>
  if (isError) return <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void refetch() }} /></MainAreaLoading>
  if (!hasCandles) return <div className="relative flex-1"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" /></div>
  return <div ref={containerRef} className="min-h-0 flex-1" data-capture-ignore />
}
