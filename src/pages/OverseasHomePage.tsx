import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import ToolbarModeText from '@/components/ToolbarModeText'
import Toolbar from '@/components/Toolbar'
import { useJapanQuotes } from '@/hooks/useJapanQuotes'
import { useUsaQuotes, useUsaStocks } from '@/hooks/useUsaQuotes'
import { buildRankChart } from '@/utils/rankChart'
import { buildJapanTree, type JapanCategory, type JapanClassification } from '@/utils/japanMap'
import { JAPAN_MAP_FIXED } from '@/utils/japanMapSettings'
import { USA_MAP_FIXED } from '@/utils/usaMapSettings'
import { toSnapshotDateLabel } from '@/utils/format'
import { collectAtDepth } from '@/utils/sectorDepth'
import { summarizeSector } from '@/utils/sectorAverage'
import japanStocks from '@/data/japanStocks.json'

// 홈의 일본·미국 구성. 업종 지도와 그룹 등락률을 지도 화면과 같은 트리·계산으로 만든다(최신 시세 기준).
// 날짜 달력과 설정 패널은 아직 없다.
export default function OverseasHomePage({ market }: { market: 'JAPAN' | 'USA' }) {
  const isJapan = market === 'JAPAN'
  const base = isJapan ? 'japan' : 'usa'
  const categories = useQuery({ queryKey: [base, 'categories'], queryFn: async () => (await client.get<JapanCategory[]>(`/${base}/categories`)).data })
  const classifications = useQuery({ queryKey: [base, 'classifications'], queryFn: async () => (await client.get<Record<string, JapanClassification>>(`/${base}/classifications`)).data })
  const japanNames = useQuery({ queryKey: ['japan', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/japan/stock-names')).data, enabled: isJapan })
  const usaNames = useQuery({ queryKey: ['usa', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/usa/stock-names')).data, enabled: !isJapan })
  const usaStocks = useUsaStocks()
  const japanQuotes = useJapanQuotes(null, isJapan)
  const usaQuotes = useUsaQuotes(null, !isJapan)
  const quotes = isJapan ? japanQuotes : usaQuotes
  const colorScale = isJapan ? JAPAN_MAP_FIXED.colorScale : USA_MAP_FIXED.colorScale

  const { tree, snapshotTime } = useMemo(() => {
    const snap = quotes.data?.snapshotTime ?? null
    if (!categories.data || !classifications.data || !quotes.data || !snap) return { tree: [], snapshotTime: null }
    if (isJapan) {
      if (!japanNames.data) return { tree: [], snapshotTime: null }
      return { tree: buildJapanTree(japanStocks, categories.data, classifications.data, japanNames.data, quotes.data.quotes, snap), snapshotTime: snap }
    }
    if (!usaStocks.data || !usaNames.data) return { tree: [], snapshotTime: null }
    const names = Object.fromEntries(usaStocks.data.map(stock => [stock.symbol, usaNames.data?.[stock.symbol] ?? stock.symbol]))
    const treeStocks = usaStocks.data.map(stock => ({ code: stock.symbol, name: stock.name }))
    return { tree: buildJapanTree(treeStocks, categories.data, classifications.data, names, quotes.data.quotes, snap), snapshotTime: snap }
  }, [categories.data, classifications.data, quotes.data, isJapan, japanNames.data, usaNames.data, usaStocks.data])

  // 업종 지도 항목과 그룹 등락률 막대 — 지도 화면과 같이 한 단계(대분류)만 쓴다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    for (const { node, pathKey } of collectAtDepth(tree, 1, new Set<number>(), new Set<string>(), true, '')) {
      const summary = summarizeSector(node, new Set<string>())
      if (!summary) continue
      items.push({ key: pathKey, name: node.sectorName, marketValue: summary.marketValue, changeRate: summary.weightedAvg, simpleAvg: summary.simpleAvg, advancers: summary.advancers, decliners: summary.decliners, unchanged: summary.unchanged })
    }
    const chart = buildRankChart(items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate, isReference: false })))
    return { items, chart }
  }, [tree])

  const label = isJapan ? 'NIKKEI225' : 'S&P500'
  const menu = [
    { label: 'K-STOCK', to: '/home', active: false },
    { label: 'NIKKEI225', to: '/home/japan', active: isJapan, special: true },
    { label: 'S&P500', to: '/home/usa', active: !isJapan, special: true },
  ]
  const isLoading = categories.isLoading || classifications.isLoading || quotes.isLoading
  const hasData = tree.length > 0

  return (
    <div className="flex h-screen min-h-0 flex-col bg-ui-background">
      <NavBar />
      <NavSubBar />
      <Toolbar>
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <ToolbarModeText page="HOME" label={label} showChevron menu={menu} />
          <span className="px-2 text-ui-white">{toSnapshotDateLabel(snapshotTime)}</span>
        </div>
      </Toolbar>
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-[4px] p-[4px]">
        <section className="flex min-h-0 flex-col rounded-md border border-ui-border bg-ui-panel p-2">
          <h2 className="mb-2 text-sm font-bold text-ui-white">업종 지도</h2>
          <div className="relative flex min-h-0 flex-1 flex-col">
            {hasData ? <OverviewMap items={overview.items} colorScale={colorScale} large decimalPlaces={1} onSelect={() => {}} /> : <p className="text-ui-muted">{isLoading ? '불러오는 중' : '데이터가 없습니다.'}</p>}
          </div>
        </section>
        <section className="flex min-h-0 flex-col rounded-md border border-ui-border bg-ui-panel p-2">
          <h2 className="mb-2 text-sm font-bold text-ui-white">그룹 등락률 (%)</h2>
          <div className="relative min-h-0 flex-1">
            {hasData ? <RankBars chart={overview.chart} highlightColor={isJapan ? JAPAN_MAP_FIXED.strongIndustryColor : USA_MAP_FIXED.strongIndustryColor} colorScale={colorScale} decimalPlaces={1} /> : null}
          </div>
        </section>
      </div>
      <DisclaimerFooter />
    </div>
  )
}
