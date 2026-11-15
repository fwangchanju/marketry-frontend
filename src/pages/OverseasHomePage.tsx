import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import ToolbarModeText from '@/components/ToolbarModeText'
import JapanSessionChip from '@/components/JapanSessionChip'
import UsaSessionChip from '@/components/UsaSessionChip'
import { CalendarIcon, ClockIcon } from '@/components/icons/AppIcons'
import { japanSessionAt, type JapanSession } from '@/utils/japanMarketSession'
import { USA_SESSION } from '@/utils/usaMarketSession'
import Toolbar from '@/components/Toolbar'
import ChangeRateBar from '@/components/ChangeRateBar'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { FRAME_BADGE_CLASS } from '@/components/FrameBadge'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { resolveLegendSwatches } from '@/utils/heatmapColorScale'
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

// 날짜·시간 칩 — 한국 홈의 날짜 칩과 같은 글자(14px, 보통 굵기)·간격(4px)·여백(6px)이다.
const HOME_CHIP_CLASS = 'toolbar-badge flex h-6 shrink-0 items-center gap-1 whitespace-nowrap bg-[var(--ui-panel)] px-1.5 text-[14px] font-medium tabular-nums tracking-normal text-ui-white'

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
  const strongIndustryColor = isJapan ? JAPAN_MAP_FIXED.strongIndustryColor : USA_MAP_FIXED.strongIndustryColor

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

  const snapshotClock = snapshotTime ? snapshotTime.slice(11, 16) : null
  const session = snapshotTime ? (isJapan ? japanSessionAt(snapshotTime) : USA_SESSION) : null
  return (
    <div className="flex h-screen min-h-0 flex-col bg-ui-background">
      <NavBar />
      <NavSubBar />
      <div className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 gap-[4px] overflow-hidden bg-ui-background">
        <div className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
          <Toolbar>
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <ToolbarModeText page="HOME" label={label} showChevron menu={menu} />
              <span className={HOME_CHIP_CLASS}>
                <CalendarIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />
                {toSnapshotDateLabel(snapshotTime)}
              </span>
              {snapshotClock && (
                <span className={HOME_CHIP_CLASS}>
                  <ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />
                  {snapshotClock}
                </span>
              )}
              {session && (isJapan ? <JapanSessionChip session={session as JapanSession} /> : <UsaSessionChip session={USA_SESSION} />)}
            </div>
            <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}>
              <TaxonomyBadge taxonomy="MARKETRY" strongIndustryColor={strongIndustryColor} />
            </div>
          </Toolbar>
          <div className="flex min-h-0 flex-1">
            {[
              { title: '업종 지도', node: (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {hasData ? <OverviewMap items={overview.items} colorScale={colorScale} large decimalPlaces={1} onSelect={() => {}} /> : <p className="text-ui-muted">{isLoading ? '불러오는 중' : '데이터가 없습니다.'}</p>}
                </div>
              ) },
              { title: '그룹 등락률 (%)', node: (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {hasData ? <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} decimalPlaces={1} /> : null}
                </div>
              ) },
            ].map((frame, index) => (
              <section key={frame.title} className="relative flex h-full min-w-[320px] flex-1 basis-0 flex-col bg-ui-background">
                <div className={`flex min-h-0 flex-1 flex-col bg-ui-background ${index === 0 ? 'pl-0 pr-1' : 'pl-1 pr-0'}`}>
                  <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-ui-border bg-ui-background px-[7px] py-[7px]">
                    <div className="relative z-[6] flex h-6 min-h-6 shrink-0 items-center">
                      <span className={FRAME_BADGE_CLASS}>{frame.title}</span>
                    </div>
                    <div className="mt-0.5 flex min-h-0 flex-1 flex-col">{frame.node}</div>
                  </div>
                </div>
              </section>
            ))}
          </div>
          <DisclaimerFooter rightContent={<ChangeRateBar swatches={resolveLegendSwatches(colorScale)} />} />
        </div>
      </div>
    </div>
  )
}
