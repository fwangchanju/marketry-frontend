import { useMemo, useState } from 'react'
import type { HeatmapItem } from '@/types/api'
import type { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { isLightColor, resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { toCount, toJoEok, toPctSigned } from '@/utils/format'

// 모바일 종목 찾기 — 종목명·종목코드로 걸러 시가총액 순으로 보여 주는 검색 목록.
// 2026-10-29 지도 설정 줄이 지도를 가리지 않게 하려고 화면에서 뺐다(어디에도 연결돼 있지 않다). 다시 쓰려면 원하는 자리에서 불러 쓴다.
const FIRST_STOCKS_SHOWN = 10
const STOCKS_PER_MORE = 10

export default function MobileStockList({ stocks, colorScale, decimalPlaces }: { stocks: HeatmapItem[]; colorScale: ReturnType<typeof useGlobalSettings>['colorScale']; decimalPlaces: number }) {
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLocaleLowerCase('ko-KR')
  const [showMoreFor, setShowMoreFor] = useState({ query: '', count: FIRST_STOCKS_SHOWN })
  const limit = showMoreFor.query === normalizedSearch ? showMoreFor.count : FIRST_STOCKS_SHOWN
  const sortedStocks = useMemo(
    () => [...stocks]
      .filter(stock => !normalizedSearch || `${stock.stockName} ${stock.alias ?? ''} ${stock.stockCode}`.toLocaleLowerCase('ko-KR').includes(normalizedSearch))
      .sort((a, b) => b.totalMarketValue - a.totalMarketValue),
    [stocks, normalizedSearch],
  )
  const visibleStocks = sortedStocks.slice(0, limit)

  return (
    <section aria-label="종목 목록" className="pt-1">
      <label htmlFor="mobile-stock-search" className="sr-only">종목 찾기</label>
      <input
        id="mobile-stock-search"
        type="search"
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder="종목명 또는 종목코드"
        className="h-[36px] w-full rounded-[4px] border-0 bg-ui-control px-3 text-[13px] text-ui-white placeholder:text-ui-muted focus:outline-none"
      />
      <p className="mt-3 text-sm text-ui-muted">시가총액 순 · {toCount(sortedStocks.length)}종목</p>
      <ul className="mt-2 divide-y divide-ui-border border-y border-ui-border">
        {visibleStocks.map(stock => {
          const color = resolveHeatmapColor(stock.changeRate, colorScale)
          const textColor = isLightColor(color) ? 'var(--ui-surface)' : 'var(--ui-white)'
          return (
            <li key={stock.stockCode} className="flex min-h-16 items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ui-white">{stock.alias ?? stock.stockName}</p>
                <p className="mt-0.5 text-xs text-ui-muted">{stock.stockCode} · 시가총액 {toJoEok(stock.totalMarketValue / 100_000_000)}</p>
              </div>
              <span className="shrink-0 rounded-[4px] px-2 py-1 text-[13px] font-bold tabular-nums" style={{ backgroundColor: color, color: textColor }}>
                {toPctSigned(stock.changeRate, decimalPlaces)}
              </span>
            </li>
          )
        })}
      </ul>
      {sortedStocks.length === 0 && <p className="py-8 text-center text-sm text-ui-muted">일치하는 종목이 없습니다.</p>}
      {visibleStocks.length < sortedStocks.length && (
          <button type="button" onClick={() => setShowMoreFor(current => ({ query: normalizedSearch, count: (current.query === normalizedSearch ? current.count : FIRST_STOCKS_SHOWN) + STOCKS_PER_MORE }))} className="mt-3 min-h-11 w-full border border-ui-border bg-ui-panel text-sm font-semibold text-ui-white hover:bg-ui-control">
          종목 더 보기 ({toCount(sortedStocks.length - visibleStocks.length)}개 남음)
        </button>
      )}
    </section>
  )
}
