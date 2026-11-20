import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CandlestickSeries, ColorType, HistogramSeries, LineSeries, LineStyle, createChart, type Time } from 'lightweight-charts'
import { getJapanStockDailyCandles, getStockDailyCandles, getUsaStockDailyCandles, type StockDailyCandle } from '@/api/stockChart'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import MainAreaLoading from '@/components/MainAreaLoading'
import Spinner from '@/components/Spinner'

type Market = 'korea' | 'japan' | 'usa'
type Interval = 'day' | 'week' | 'month'

interface Props {
  stockCode: string
  stockName: string
  // 어느 시장의 일봉인지 — 한국은 키움 일봉, 일본·미국은 야후 일봉을 읽는다.
  market: Market
}

// 받아 오는 기간(일) — 서버가 허용하는 최대치(10년)라 보관된 일봉을 전부 받는다. 왼쪽으로 끌면 이전 기록이 나온다.
const CANDLE_DAYS = 3650
// 봉 단위마다 처음 보이는 봉 수 — 일봉 약 6개월, 주봉 약 2년, 월봉은 전체.
const VISIBLE_BARS: Record<Interval, number | null> = { day: 126, week: 104, month: null }
// 오른 봉·내린 봉 색(2026-11-20 사용자 결정: 증권사 앱 시안의 빨강·파랑). 차트에는 이 두 색 말고는 회색만 쓴다.
const UP_COLOR = '#f04452'
const DOWN_COLOR = '#3182f6'
// 이동평균선 — 가는 선이라 밝은 색으로 구분한다(노랑·주황·연보라·밝은 회색). 초록 계열과 봉 색(빨강·파랑)은 쓰지 않는다.
const MOVING_AVERAGES = [
  { days: 5, color: '#ffd54a' },
  { days: 20, color: '#ff9f43' },
  { days: 60, color: '#c084fc' },
  { days: 120, color: '#e5e7eb' },
] as const
// 장중 임시 봉의 몸통 — 같은 빨강·파랑을 옅게 칠해 확정된 봉과 구분한다(테두리·심지는 진한 색 그대로).
const PROVISIONAL_UP_BODY = 'rgba(240, 68, 82, 0.35)'
const PROVISIONAL_DOWN_BODY = 'rgba(49, 130, 246, 0.35)'
const VOLUME_COLOR = 'rgba(140, 146, 155, 0.45)'
const GRID_COLOR = '#1c1c1c'
const LINE_COLOR = '#2a2a2a'
const CROSSHAIR_COLOR = '#6b7280'
const AXIS_TEXT_COLOR = '#b0b8c1'
const VOLUME_PANE_HEIGHT = 110
// 아래 날짜 축의 높이(라이브러리 기본 글자 크기 기준) — 출처 배지 자리를 거래량 칸 위쪽에 맞출 때 쓴다.
const TIME_AXIS_HEIGHT = 28
// 마지막 봉과 오른쪽 가격축 사이에 비워 둘 봉 칸 수.
const RIGHT_OFFSET_BARS = 5
// 가격축 왼쪽 끝에서 축 숫자가 시작하는 거리(라이브러리 기본 눈금 길이+여백) — 직접 그리는 가격 배지 글자를 축 숫자 줄에 맞춘다.
const PRICE_TEXT_INSET = 9
// 직접 그리는 배지의 글자 좌우 여백과 높이.
const BADGE_PADDING_X = 6
const BADGE_HEIGHT = 22

type PriceBadge = { top: number; text: string; color: string }
const INTERVALS: { value: Interval; label: string }[] = [
  { value: 'day', label: '일봉' },
  { value: 'week', label: '주봉' },
  { value: 'month', label: '월봉' },
]

const DAILY_CANDLE_LOADERS = { korea: getStockDailyCandles, japan: getJapanStockDailyCandles, usa: getUsaStockDailyCandles }

// 가격 표시 — 한국은 원, 일본은 엔(정수), 미국은 달러(소수 둘째 자리).
function priceText(market: Market, value: number): string {
  if (market === 'usa') return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const rounded = Math.round(value).toLocaleString('ko-KR')
  return market === 'japan' ? `${rounded}엔` : `${rounded}원`
}

function axisPriceText(market: Market, value: number): string {
  return market === 'usa'
    ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(value).toLocaleString('ko-KR')
}

// 일봉을 주봉(월요일 기준)·월봉으로 묶는다. 봉의 날짜는 그 묶음의 첫 거래일이다.
function groupCandles(candles: StockDailyCandle[], interval: Interval): StockDailyCandle[] {
  if (interval === 'day') return candles
  const grouped: StockDailyCandle[] = []
  let currentKey = ''
  for (const candle of candles) {
    let key = candle.date.slice(0, 7)
    if (interval === 'week') {
      const date = new Date(`${candle.date}T00:00:00Z`)
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
      key = date.toISOString().slice(0, 10)
    }
    const last = grouped[grouped.length - 1]
    if (key !== currentKey || !last) {
      currentKey = key
      grouped.push({ ...candle })
    } else {
      last.high = Math.max(last.high, candle.high)
      last.low = Math.min(last.low, candle.low)
      last.close = candle.close
      last.volume += candle.volume
      if (candle.provisional) last.provisional = true
    }
  }
  return grouped
}

function movingAverage(candles: StockDailyCandle[], days: number) {
  const points: { time: Time; value: number }[] = []
  let sum = 0
  candles.forEach((candle, index) => {
    sum += candle.close
    if (index >= days) sum -= candles[index - days].close
    if (index >= days - 1) points.push({ time: candle.date as Time, value: sum / days })
  })
  return points
}

function changeRate(current: StockDailyCandle, previous: StockDailyCandle | undefined): number | null {
  return previous && previous.close !== 0 ? ((current.close - previous.close) / previous.close) * 100 : null
}

// 날짜 뒤에 요일을 괄호로 붙인다(예: 2026-08-12 (수)).
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const dateWithWeekday = (date: string) => `${date} (${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]})`

// 출처 배지를 누르면 TradingView 사이트에서 같은 종목 차트를 연다(2026-11-20 사용자 요청).
// 한국은 KRX:종목코드, 일본은 TSE:종목코드, 미국은 티커만 넘기면 TradingView가 거래소를 찾는다(야후 표기 BRK-B는 BRK.B로 바꾼다).
function tradingViewUrl(market: Market, stockCode: string): string {
  const symbol = market === 'korea' ? `KRX:${stockCode}` : market === 'japan' ? `TSE:${stockCode.replace(/\.T$/i, '')}` : stockCode.replace(/-/g, '.')
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`
}

// 차트 라이브러리가 넘기는 시각(문자열·날짜 객체·초)을 YYYY-MM-DD로 바꾼다.
function timeToDate(time: Time): string {
  if (typeof time === 'string') return time
  if (typeof time === 'number') return new Date(time * 1000).toISOString().slice(0, 10)
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`
}

const changeClass = (rate: number | null) => (rate === null || rate === 0 ? 'text-ui-white' : rate > 0 ? 'text-[#f04452]' : 'text-[#3182f6]')


// 지도 자리에 그리는 종목 차트 — 위 한 줄에 현재가·오늘 시세·일봉·주봉·월봉 버튼, 가운데 봉과 이동평균선, 아래 칸에 거래량.
// 마우스를 올린 날의 값은 떠 있는 상자로 보인다. TradingView Lightweight Charts(오픈소스)에 우리 일봉 데이터를 넣어 그린다.
export default function StockCandleChart({ stockCode, stockName, market }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [interval, setInterval] = useState<Interval>('day')
  // 마우스를 올린 봉의 순서. 없으면 가장 최근 봉 값을 보인다.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  // 날짜 배지 자리 — 커서의 가로 위치와 차트 크기.
  const [hoverAt, setHoverAt] = useState<{ x: number; width: number; height: number } | null>(null)
  // 오른쪽 가격축 위에 직접 그리는 배지 — 커서 가격(위·아래 칸)과 현재가. top은 차트 영역 위에서부터의 거리, left는 축 글자 시작 자리.
  const [priceBadges, setPriceBadges] = useState<{ textLeft: number; cursor: PriceBadge | null; last: PriceBadge | null }>({ textLeft: 0, cursor: null, last: null })
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['stock-daily-candles', market, stockCode, CANDLE_DAYS],
    queryFn: ({ signal }) => DAILY_CANDLE_LOADERS[market](stockCode, CANDLE_DAYS, signal),
    staleTime: 60_000,
  })
  const bars = useMemo(() => groupCandles(data ?? [], interval), [data, interval])

  useEffect(() => {
    const container = containerRef.current
    if (!container || bars.length === 0) return
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'rgba(0, 0, 0, 0)' },
        textColor: AXIS_TEXT_COLOR,
        // 축·날짜 배지 글자를 사이트 글꼴로 그린다. 기본 글꼴(윈도우에서는 Trebuchet 등)은 한글 요일이 섞이면 글자가 배지 아래로 처진다.
        fontFamily: getComputedStyle(document.body).fontFamily,
        panes: { separatorColor: LINE_COLOR },
        // 라이브러리 기본 로고는 끄고, 아래에서 같은 출처 링크를 둥근 배지로 직접 그린다(출처 표시는 유지한다).
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: GRID_COLOR } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: RIGHT_OFFSET_BARS },
      crosshair: {
        mode: 0,
        // 커서 십자선은 현재가 선과 같은 점선으로 그린다(기본 큰 점선은 너무 눈에 띈다, 2026-11-20 사용자 결정).
        // 아래 날짜 배지는 라이브러리 것 대신 직접 그린다(글자와 배지 가운데를 정확히 맞추려고, 2026-11-20 사용자 요청).
        vertLine: { color: CROSSHAIR_COLOR, style: LineStyle.Dashed, labelVisible: false },
        // 오른쪽 가격 배지(커서 가격·현재가)도 직접 그린다 — 라이브러리 배지는 글자 왼쪽 여백이 더 넓다(2026-11-20 사용자 요청).
        horzLine: { color: CROSSHAIR_COLOR, style: LineStyle.Dashed, labelVisible: false },
      },
      // 커서 아래 날짜 표시는 정보 줄과 같은 모양(2026-10-20 (화))으로 쓴다.
      // 가격 표시는 시리즈마다 따로 정한다(전체에 걸면 거래량 칸까지 소수점이 붙는다).
      localization: { locale: 'ko-KR', timeFormatter: (time: Time) => dateWithWeekday(timeToDate(time)) },
    })
    const priceFormat = { type: 'custom' as const, minMove: market === 'usa' ? 0.01 : 1, formatter: (price: number) => axisPriceText(market, price) }
    const candles = chart.addSeries(CandlestickSeries, {
      priceFormat,
      lastValueVisible: false,
      upColor: UP_COLOR, downColor: DOWN_COLOR, borderUpColor: UP_COLOR, borderDownColor: DOWN_COLOR, wickUpColor: UP_COLOR, wickDownColor: DOWN_COLOR,
    })
    // 장중 임시 봉(오늘, 5분 시세로 만든 값)은 몸통을 옅게 칠해 확정된 봉과 구분한다(2026-11-20 사용자 결정).
    candles.setData(bars.map(({ date, open, high, low, close, provisional }) => ({
      time: date as Time, open, high, low, close, ...(provisional ? { color: close >= open ? PROVISIONAL_UP_BODY : PROVISIONAL_DOWN_BODY } : {}),
    })))
    for (const average of MOVING_AVERAGES) {
      const line = chart.addSeries(LineSeries, { priceFormat, color: average.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
      line.setData(movingAverage(bars, average.days))
    }
    // 거래량은 봉과 겹치지 않게 아래 칸(두 번째 판)에 회색 막대로 그린다.
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: 'custom', minMove: 1, formatter: (amount: number) => Math.round(amount).toLocaleString('ko-KR') }, color: VOLUME_COLOR, priceLineVisible: false, lastValueVisible: false }, 1)
    // 임시 봉은 거래량이 없어서 막대를 비워 둔다(주봉·월봉은 확정된 날의 거래량 합을 그대로 보인다).
    volume.setData(bars.map(({ date, volume: amount, provisional }) => (provisional && amount === 0 ? { time: date as Time } : { time: date as Time, value: amount })))
    chart.panes()[1]?.setHeight(VOLUME_PANE_HEIGHT)
    const visible = VISIBLE_BARS[interval]
    if (visible !== null && bars.length > visible) chart.timeScale().setVisibleLogicalRange({ from: bars.length - visible, to: bars.length + RIGHT_OFFSET_BARS })
    else chart.timeScale().fitContent()
    const indexByDate = new Map(bars.map((bar, index) => [bar.date, index]))
    const volumeFormat = (amount: number) => Math.round(amount).toLocaleString('ko-KR')
    const lastBar = bars[bars.length - 1]
    let cursorBadge: PriceBadge | null = null
    // 현재가 배지 자리는 화면을 끌거나 크기가 바뀌면 달라지므로 그때마다 다시 잰다.
    const placeBadges = () => {
      const lastY = candles.priceToCoordinate(lastBar.close)
      setPriceBadges({
        textLeft: container.clientWidth - chart.priceScale('right').width() + PRICE_TEXT_INSET,
        cursor: cursorBadge,
        last: lastY === null ? null : { top: lastY, text: axisPriceText(market, lastBar.close), color: lastBar.close >= lastBar.open ? UP_COLOR : DOWN_COLOR },
      })
    }
    let frame = 0
    const schedulePlace = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(placeBadges)
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(schedulePlace)
    const resizeObserver = new ResizeObserver(schedulePlace)
    resizeObserver.observe(container)
    schedulePlace()
    chart.subscribeCrosshairMove(param => {
      // 커서 가격 배지 — 위 칸이면 가격, 아래 칸이면 거래량. 아래 칸 좌표는 위 칸 높이와 칸 사이 선(1px)만큼 내려서 그린다.
      cursorBadge = null
      if (param.point && param.paneIndex !== undefined) {
        const isVolume = param.paneIndex === 1
        const value = (isVolume ? volume : candles).coordinateToPrice(param.point.y)
        if (value !== null) {
          const top = isVolume ? chart.paneSize(0).height + 1 + param.point.y : param.point.y
          cursorBadge = { top, text: isVolume ? volumeFormat(value) : axisPriceText(market, value), color: '#3a3a3a' }
        }
      }
      placeBadges()
      const index = typeof param.time === 'string' ? indexByDate.get(param.time) : undefined
      setHoverIndex(index === undefined || !param.point ? null : index)
      setHoverAt(index === undefined || !param.point ? null : { x: param.point.x, width: container.clientWidth, height: container.clientHeight })
    })
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      setHoverIndex(null)
      setHoverAt(null)
      setPriceBadges({ textLeft: 0, cursor: null, last: null })
      chart.remove()
    }
  }, [bars, interval, market])

  if (isLoading) return <MainAreaLoading><Spinner showElapsed /></MainAreaLoading>
  if (isError) return <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void refetch() }} /></MainAreaLoading>
  if (!data || data.length === 0) return <div className="relative flex-1"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" /></div>

  const latest = data[data.length - 1]
  const latestRate = changeRate(latest, data[data.length - 2])
  const latestDiff = data.length > 1 ? latest.close - data[data.length - 2].close : 0

  const shownIndex = hoverIndex !== null && hoverIndex < bars.length ? hoverIndex : bars.length - 1
  const shownBar = bars[shownIndex]
  const shownRate = shownBar ? changeRate(shownBar, bars[shownIndex - 1]) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col tabular-nums" data-capture-ignore>
      {/* 차트를 넓게 보도록 종목명·현재가·등락률과 버튼을 한 줄에 모은다(2026-11-20 사용자 결정). */}
      {/* 첫 줄: 종목명·현재가·등락률, 둘째 줄: 일봉·주봉·월봉과 그 오른쪽에 이동평균선 표시(2026-11-20 사용자 결정). */}
      <div className="flex shrink-0 flex-col gap-1.5 px-3 pb-2 pt-1.5 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex shrink-0 items-baseline gap-1.5 text-base">
            <span className="mr-1 font-bold text-ui-white">{stockName}</span>
            <span className={`font-bold ${changeClass(latestRate)}`}>{priceText(market, latest.close)}</span>
            {latestRate !== null && (
              <span className={`font-semibold ${changeClass(latestRate)}`}>
                {latestRate > 0 ? '▲' : latestRate < 0 ? '▼' : ''}{priceText(market, Math.abs(latestDiff)).replace(/[원엔]$/, '')} ({latestRate > 0 ? '+' : ''}{latestRate.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div role="group" aria-label="봉 단위" className="flex shrink-0 gap-1">
            {INTERVALS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={interval === option.value}
                onClick={() => setInterval(option.value)}
                className={`cursor-pointer rounded-md border-0 px-2.5 py-1 text-xs font-semibold ${interval === option.value ? 'bg-[#e5e7eb] text-[#0a0a0a]' : 'bg-ui-panel text-ui-text hover:bg-ui-control'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div aria-label="이동평균선" className="flex shrink-0 gap-2">
            {MOVING_AVERAGES.map(average => (
              <span key={average.days} className="inline-flex items-center gap-1" style={{ color: average.color }}><i aria-hidden="true" className="inline-block h-0.5 w-3" style={{ backgroundColor: average.color }} />{average.days}</span>
            ))}
          </div>
        </div>
        {/* 셋째 줄: 마우스를 올린 날(없으면 가장 최근 날)의 값. 차트를 가리지 않게 상자 대신 줄로 보인다(2026-11-20 사용자 결정). */}
        {shownBar && (
          <div className="flex h-4 items-center gap-3 overflow-hidden whitespace-nowrap">
            <span className="font-semibold text-ui-white">{dateWithWeekday(shownBar.date)}</span>
            {[
              ['시가', priceText(market, shownBar.open)],
              ['고가', priceText(market, shownBar.high)],
              ['저가', priceText(market, shownBar.low)],
            ].map(([label, value]) => (
              <span key={label}><span className="mr-1 text-ui-muted">{label}</span><span className="text-ui-text">{value}</span></span>
            ))}
            <span><span className="mr-1 text-ui-muted">종가</span><span className={changeClass(shownRate)}>{priceText(market, shownBar.close)}</span></span>
            {shownRate !== null && <span className={changeClass(shownRate)}>{shownRate > 0 ? '+' : ''}{shownRate.toFixed(2)}%</span>}
            <span><span className="mr-1 text-ui-muted">거래량</span><span className="text-ui-text">{shownBar.provisional && shownBar.volume === 0 ? '-' : shownBar.volume.toLocaleString('ko-KR')}</span>{shownBar.provisional && <span className="ml-1 text-ui-muted">(장중 임시)</span>}</span>
          </div>
        )}
      </div>
      <div className="relative min-h-0 flex-1 border-t border-[#2a2a2a]">
        <div ref={containerRef} className="absolute inset-0" />
        {[priceBadges.last, priceBadges.cursor].map((badge, order) => badge && (
          <div
            key={order === 0 ? 'last' : 'cursor'}
            aria-hidden="true"
            className="pointer-events-none absolute z-10 flex items-center whitespace-nowrap text-xs leading-none text-ui-white"
            style={{ left: priceBadges.textLeft - BADGE_PADDING_X, top: badge.top - BADGE_HEIGHT / 2, height: BADGE_HEIGHT, paddingLeft: BADGE_PADDING_X, paddingRight: BADGE_PADDING_X, backgroundColor: badge.color }}
          >
            {badge.text}
          </div>
        ))}
        {hoverAt && shownBar && hoverIndex !== null && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 flex h-[22px] -translate-x-1/2 items-center justify-center whitespace-nowrap bg-[#3a3a3a] px-1.5 text-xs leading-none text-ui-white"
            style={{
              left: Math.min(Math.max(hoverAt.x, 70), hoverAt.width - 70),
              top: hoverAt.height - TIME_AXIS_HEIGHT + 3,
            }}
          >
            {dateWithWeekday(shownBar.date)}
          </div>
        )}
        {/* TradingView 출처 표시 — 차트 라이브러리 사용 조건이라 지우지 않는다. 기본 로고 대신 둥근 배지로 보이고, 누르면 TradingView에서 이 종목 차트를 연다(2026-11-20 사용자 결정). */}
        <a
          href={tradingViewUrl(market, stockCode)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="TradingView에서 이 종목 차트 열기"
          data-hint="TradingView에서 이 종목 차트 열기"
          // 거래량 칸의 왼쪽 위에 둔다(아래 시간축 높이 + 거래량 칸 높이 기준, 2026-11-20 사용자 결정).
          style={{ bottom: TIME_AXIS_HEIGHT + VOLUME_PANE_HEIGHT - 40 }}
          className="absolute left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[#3a3a3a] bg-[#141414] text-ui-white hover:border-[#5a5a5a]"
        >
          <svg aria-hidden="true" width="24" height="13" viewBox="0 0 35 19" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M14 2H2v6h6v9h6V2Zm12 15h-7l6-15h7l-6 15Zm-7-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          </svg>
        </a>
      </div>
    </div>
  )
}
