import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import Spinner from '@/components/Spinner'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePageSetting } from '@/hooks/usePageSetting'
import type { TreemapItem } from '@/types/api'
import type { FilteredTreemapSectorNode } from '@/hooks/useFilteredTreemap'
import { collectAllItems } from '@/hooks/useFilteredTreemap'
import { isLightColor, resolveTreemapColor } from '@/utils/treemapColorScale'
import { toCount, toDateTimeLabel, toJoEok, toPctSigned } from '@/utils/format'
import type { MarketQuery } from '@/types/api'
import { marketRoute } from '@/utils/marketRoute'

const MARKETS: { value: MarketQuery; label: string }[] = [
  { value: 'ALL_STOCK', label: '전체' },
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
]
const FIRST_STOCKS_SHOWN = 10
const STOCKS_PER_MORE = 10

type MobileSectorItem = OverviewMapItem & {
  node: FilteredTreemapSectorNode | null
  stocks: TreemapItem[]
  isDirectStocks?: boolean
}

function toMobileSectorItem(node: FilteredTreemapSectorNode, path: string): MobileSectorItem | null {
  const stocks = collectAllItems(node)
  const marketValue = stocks.reduce((sum, stock) => sum + stock.totalMarketValue, 0)
  if (marketValue <= 0 || stocks.length === 0) return null
  const changeRate = stocks.reduce((sum, stock) => sum + stock.changeRate * stock.totalMarketValue, 0) / marketValue
  const advancers = stocks.filter(stock => stock.changeRate > 0).length
  const decliners = stocks.filter(stock => stock.changeRate < 0).length
  return {
    key: path,
    name: node.sectorName,
    marketValue,
    changeRate,
    advancers,
    decliners,
    unchanged: stocks.length - advancers - decliners,
    node,
    stocks,
  }
}

function toDirectStocksItem(stocks: TreemapItem[], parentPath: string): MobileSectorItem | null {
  if (!stocks.length) return null
  const marketValue = stocks.reduce((sum, stock) => sum + stock.totalMarketValue, 0)
  if (marketValue <= 0) return null
  return {
    key: `${parentPath}>direct-stocks`,
    name: '직접 종목',
    marketValue,
    changeRate: stocks.reduce((sum, stock) => sum + stock.changeRate * stock.totalMarketValue, 0) / marketValue,
    advancers: stocks.filter(stock => stock.changeRate > 0).length,
    decliners: stocks.filter(stock => stock.changeRate < 0).length,
    unchanged: stocks.filter(stock => stock.changeRate === 0).length,
    node: null,
    stocks,
    isDirectStocks: true,
  }
}

function MobileStockList({ stocks, colorScale, decimalPlaces }: { stocks: TreemapItem[]; colorScale: ReturnType<typeof useGlobalSettings>['colorScale']; decimalPlaces: number }) {
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
    <section aria-label="종목 목록" className="mt-5">
      <label htmlFor="mobile-stock-search" className="mb-2 block text-sm font-semibold text-ui-white">종목 찾기</label>
      <input
        id="mobile-stock-search"
        type="search"
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder="종목명 또는 종목코드"
        className="h-11 w-full border border-ui-border bg-ui-panel px-3 text-base text-ui-white placeholder:text-ui-muted focus:border-brand focus:outline-none"
      />
      <p className="mt-3 text-sm text-ui-muted">시가총액 순 · {toCount(sortedStocks.length)}종목</p>
      <ul className="mt-2 divide-y divide-ui-border border-y border-ui-border">
        {visibleStocks.map(stock => {
          const color = resolveTreemapColor(stock.changeRate, colorScale)
          const textColor = isLightColor(color) ? 'var(--ui-surface)' : 'var(--ui-white)'
          return (
            <li key={stock.stockCode} className="flex min-h-16 items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ui-white">{stock.alias ?? stock.stockName}</p>
                <p className="mt-0.5 text-xs text-ui-muted">{stock.stockCode} · 시가총액 {toJoEok(stock.totalMarketValue / 100_000_000)}</p>
              </div>
              <span className="shrink-0 px-2 py-1 text-sm font-bold tabular-nums" style={{ backgroundColor: color, color: textColor }}>
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

export default function MobileMarketSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const {
    market,
    taxonomy,
    data,
    isLoading,
    isError,
    refetchTreemap,
    filteredRootNodes,
    colorScale,
    decimalPlaces,
  } = useGlobalSettings({ allowChangeRateMode: true })
  const [majorSelection, setMajorSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [midSelection, setMidSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [stockSelection, setStockSelection] = useState<{ market: MarketQuery; stocks: TreemapItem[]; categoryName: string } | null>(null)
  const [groupDepth, setGroupDepth] = usePageSetting<number>('groupPage.depth', 2)
  const selectableDepth = taxonomy === 'KRX' || taxonomy === 'NXT' ? 1 : 3
  const effectiveGroupDepth = Math.min(groupDepth, selectableDepth)
  const majorName = majorSelection?.market === market ? majorSelection.name : null
  const midName = midSelection?.market === market ? midSelection.name : null
  const selectedStocks = stockSelection?.market === market ? stockSelection.stocks : null
  const stockCategoryName = stockSelection?.market === market ? stockSelection.categoryName : null
  const setMajorName = (name: string | null) => setMajorSelection(name ? { market, name } : null)
  const setMidName = (name: string | null) => setMidSelection(name ? { market, name } : null)
  const setSelectedStocks = (stocks: TreemapItem[] | null, categoryName = '') => setStockSelection(stocks ? { market, stocks, categoryName } : null)
  const major = majorName ? filteredRootNodes.find(node => node.sectorName === majorName) ?? null : null
  const mid = major && midName ? major.children.find(node => node.sectorName === midName) ?? null : null

  const marketItems = useMemo(() => {
    const parent = mid ?? major
    if (parent && (mid || effectiveGroupDepth >= 2)) {
      const children = parent.children
        .map(node => toMobileSectorItem(node, `${major?.sectorName}>${parent.sectorName}>${node.sectorName}`))
        .filter((item): item is MobileSectorItem => item !== null)
      const directItems = toDirectStocksItem(parent.items, parent.sectorName)
      return directItems ? [...children, directItems] : children
    }
    return filteredRootNodes
      .map(node => toMobileSectorItem(node, node.sectorName))
      .filter((item): item is MobileSectorItem => item !== null)
  }, [effectiveGroupDepth, filteredRootNodes, major, mid])

  const mapItems: OverviewMapItem[] = marketItems.map(({ key, name, marketValue, changeRate, simpleAvg, advancers, decliners, unchanged }) => ({
    key, name, marketValue, changeRate, simpleAvg, advancers, decliners, unchanged,
  }))
  const levelLabel = mid ? '소분류' : major ? '중분류' : '대분류'
  const heading = selectedStocks ? '종목 목록' : mid ? `${mid.sectorName} 소분류` : major ? `${major.sectorName} 중분류` : '국내 주식 요약 지도'

  const selectSector = (name: string) => {
    const selected = marketItems.find(item => item.name === name)
    if (!selected) return
    if (selected.isDirectStocks) {
      setSelectedStocks(selected.stocks, selected.name)
      return
    }
    if (!major && effectiveGroupDepth >= 2 && selected.node?.children.length) {
      setMajorName(selected.node.sectorName)
      setMidName(null)
      setSelectedStocks(null)
      return
    }
    if (major && !mid && effectiveGroupDepth >= 3 && selected.node?.children.length) {
      setMidName(selected.node.sectorName)
      setSelectedStocks(null)
      return
    }
    if (major && !mid && effectiveGroupDepth === 2) setMidName(selected.node?.sectorName ?? selected.name)
    setSelectedStocks(selected.stocks, selected.name)
  }

  const selectMarket = (nextMarket: MarketQuery) => {
    setMajorName(null)
    setMidName(null)
    setSelectedStocks(null)
    if (pathname.startsWith('/map/')) {
      navigate(marketRoute('/map', nextMarket), { replace: true })
    } else {
      const next = new URLSearchParams(searchParams)
      next.set('market', nextMarket)
      setSearchParams(next, { replace: true })
    }
  }

  return (
    <main className="min-h-screen bg-ui-background px-4 pb-10 pt-5 text-ui-white sm:px-6">
      <div className="mx-auto w-full max-w-xl">
        <header className="border-b border-ui-border pb-4">
          <p className="text-xs font-bold tracking-wide text-brand">MARKETRY</p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">국내 주식 시장 지도</h1>
          <p className="mt-2 text-sm leading-relaxed text-ui-text">요약지도에서 업종을 선택해 중분류와 종목 흐름을 차례로 살펴보세요.</p>
        </header>

        <nav aria-label="시장 선택" className="mt-4 grid grid-cols-3 gap-2">
          {MARKETS.map(option => (
            <button
              key={option.value}
              type="button"
              aria-pressed={market === option.value}
              onClick={() => selectMarket(option.value)}
              className={`min-h-11 border px-2 text-sm font-semibold ${market === option.value ? 'border-brand bg-brand-surface text-ui-white' : 'border-ui-border bg-ui-panel text-ui-text'}`}
            >
              {option.label}
            </button>
          ))}
        </nav>

        <div className="mt-5 flex min-h-10 items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-bold">{heading}</h2>
          {data?.snapshotTime && <time className="shrink-0 text-xs tabular-nums text-ui-muted">{toDateTimeLabel(data.snapshotTime)}</time>}
        </div>

        {(major || selectedStocks) && (
          <nav aria-label="업종 이동 경로" className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <button type="button" onClick={() => { setMajorName(null); setMidName(null); setSelectedStocks(null) }} className="min-h-9 px-2 font-semibold text-brand underline underline-offset-4">전체 업종</button>
            {major && <>
              <span aria-hidden="true" className="text-ui-muted">›</span>
              <button type="button" onClick={() => { setMidName(null); setSelectedStocks(null) }} className={`min-h-9 px-2 ${!mid && selectedStocks ? 'font-semibold text-brand underline underline-offset-4' : 'text-ui-white'}`}>{major.sectorName}</button>
            </>}
            {mid && <>
              <span aria-hidden="true" className="text-ui-muted">›</span>
              <button type="button" onClick={() => { if (effectiveGroupDepth === 2) setMidName(null); setSelectedStocks(null) }} className={`min-h-9 px-2 ${selectedStocks ? 'font-semibold text-brand underline underline-offset-4' : 'text-ui-white'}`}>{mid.sectorName}</button>
            </>}
            {stockCategoryName && stockCategoryName !== mid?.sectorName && <>
              <span aria-hidden="true" className="text-ui-muted">›</span>
              <span className="px-2 text-ui-white">{stockCategoryName}</span>
            </>}
            {selectedStocks && <>
              <span aria-hidden="true" className="text-ui-muted">›</span>
              <span className="px-2 text-ui-white">종목</span>
            </>}
          </nav>
        )}

        {selectableDepth > 1 && !major && !selectedStocks && (
          <section aria-label="업종 분류 단계 선택" className="mt-4">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-ui-white">업종 분류 단계</h3>
              <p className="text-xs text-ui-muted">선택한 단계까지 탐색</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['대분류', '중분류', '소분류'].map((label, index) => {
                const value = index + 1
                const disabled = value > selectableDepth
                const selected = effectiveGroupDepth === value
                return (
                  <button key={label} type="button" aria-pressed={selected} disabled={disabled} onClick={() => setGroupDepth(value)} className={`min-h-10 border px-1 text-sm font-semibold ${selected ? 'border-brand bg-brand-surface text-ui-white' : 'border-ui-border bg-ui-panel text-ui-text'} disabled:opacity-35`}>
                    {label}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center"><Spinner showElapsed /></div>
        ) : isError ? (
          <div className="mt-5 border border-ui-border bg-ui-panel p-5 text-center">
            <p className="text-sm text-ui-text">시장 지도를 불러오지 못했습니다.</p>
            <button type="button" onClick={refetchTreemap} className="mt-3 min-h-11 px-4 font-semibold text-brand underline underline-offset-4">다시 불러오기</button>
          </div>
        ) : selectedStocks ? (
          <MobileStockList key={`${selectedStocks[0]?.stockCode ?? ''}:${selectedStocks.length}`} stocks={selectedStocks} colorScale={colorScale} decimalPlaces={decimalPlaces} />
        ) : marketItems.length === 0 ? (
          <p className="mt-6 border border-ui-border bg-ui-panel p-5 text-center text-sm text-ui-muted">표시할 업종이 없습니다.</p>
        ) : (
          <>
            <p className="mt-1 text-xs text-ui-muted">{levelLabel}별 시가총액 비중과 등락률</p>
            <div className="mt-3 flex h-[min(48vh,400px)] min-h-[280px] flex-col border border-ui-border bg-ui-surface p-1">
              <OverviewMap items={mapItems} colorScale={colorScale} onSelect={selectSector} />
            </div>
            <ul aria-label={`${levelLabel} 목록`} className="mt-4 divide-y divide-ui-border border-y border-ui-border">
              {marketItems.map(item => {
                const color = resolveTreemapColor(item.changeRate, colorScale)
                const textColor = isLightColor(color) ? 'var(--ui-surface)' : 'var(--ui-white)'
                return (
                  <li key={item.key}>
                    <button type="button" onClick={() => selectSector(item.name)} className="flex min-h-14 w-full items-center gap-3 bg-ui-background py-2 text-left hover:bg-ui-panel">
                      <span aria-hidden="true" className="h-3 w-3 shrink-0" style={{ backgroundColor: color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ui-white">{item.name}</span>
                        <span className="mt-0.5 block text-xs text-ui-muted">시가총액 {toJoEok(item.marketValue / 100_000_000)}</span>
                      </span>
                      <span className="shrink-0 px-2 py-1 text-sm font-bold tabular-nums" style={{ backgroundColor: color, color: textColor }}>{toPctSigned(item.changeRate, decimalPlaces)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <footer className="mt-8 border-t border-ui-border pt-4 text-xs leading-relaxed text-ui-muted">
          모바일에서는 업종 요약과 종목 목록을 제공합니다. 전체 종목 지도는 PC 화면에서 확인할 수 있습니다.
          <span className="mt-1 block">시세 데이터는 지연되거나 오류가 있을 수 있으며 투자 참고용으로 제공됩니다.</span>
        </footer>
      </div>
    </main>
  )
}
