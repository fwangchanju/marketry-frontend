import { useMemo } from 'react'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData } from '@/hooks/useOverseasClassificationData'
import { overseasSettingKey } from '@/utils/overseasSettingKey'
import { useOverseasSectorExclusion } from '@/hooks/useOverseasSectorExclusion'
import { countVisibleItems } from '@/utils/overseasSectorExclusion'
import { useOverseasTierRange } from '@/hooks/useOverseasTierRange'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import UsaDatePicker from '@/components/UsaDatePicker'
import UsaSessionChip from '@/components/UsaSessionChip'
import type { RankColumnItem } from '@/components/RankColumns'
import { SettingsAverageModeSection, SettingsBeforeMinutesSection, SettingsGraphDepthSection } from '@/components/SettingsPanel'
import type { OverseasGraphSource } from '@/hooks/overseasGraphSource'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { useUsaGraphPreferences } from '@/hooks/useUsaGraphPreferences'
import { useUsaIndexCloses } from '@/hooks/useUsaIndexCloses'
import { useUsaPeriodQuotes, useUsaQuotes, useUsaSnapshotTimes, useUsaStocks } from '@/hooks/useUsaQuotes'
import type { HeatmapSectorNode } from '@/types/api'
import { indexChangeRate, shiftDate } from '@/utils/indexChange'
import { buildJapanTree } from '@/utils/japanMap'
import { overseasMarketInfo } from '@/utils/markets'
import { buildRankChart } from '@/utils/rankChart'
import { computeSectorAverage } from '@/utils/sectorAverage'
import { collectAtDepth } from '@/utils/sectorDepth'
import { USA_GRAPH_DRAFT_KEY_MAP } from '@/utils/usaGraphSettings'
import { USA_MAP_FIXED, USA_MAP_SETTING_PREFIX, USA_SETTINGS_TAB_STORAGE } from '@/utils/usaMapSettings'
import { USA_SESSION, usaRefreshHelp } from '@/utils/usaMarketSession'

const ignoreToggle = () => {}
const INDEX_LOOKBACK_DAYS = 14
// 잠긴 "비교 시점" 슬라이더가 가리키는 칸(일본 그래프의 기본값과 같다).
const USA_BEFORE_MINUTES_PLACEHOLDER = 15

// 미국 S&P500 그래프의 데이터·설정 — 공통 그래프 화면(OverseasGraphView)이 받는 모양으로 돌려준다.
// 미국은 하루 한 번 저장된 종가로 그리므로 "N분 전 대비"(비교 시점)가 없고 평균 방식 설정은 고정이다.
export function useUsaGraphSource(): OverseasGraphSource {
  // 내 기준 모드(관리자)는 MARKETRY에 올리기 전 사본 분류로 그린다.
  const { sheet } = useOverseasSheet()
  const { categories, classifications } = useOverseasClassificationData('USA', sheet)
  const stocks = useUsaStocks()
  const snapshotTimes = useUsaSnapshotTimes()
  const { selectedTime, rangeStart, isResolving: isPeriodResolving, select, selectRange } = useCrossMarketPeriod('USA', snapshotTimes.data)
  const quotes = useUsaQuotes(selectedTime)
  const koreanNames = useQuery({ queryKey: ['usa', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/usa/stock-names')).data })
  const periodQuotes = useUsaPeriodQuotes(rangeStart, selectedTime)
  // 기준가가 없어 기간에서 뺀 종목 — 제외 종목 배지에 이름과 함께 보인다.
  const rangeExcludedStocks = periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: koreanNames.data?.[stock.stockCode] ?? stock.stockCode }))
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const liveQuotes = useUsaQuotes()
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const treeStocks = useMemo(() => (stocks.data ?? []).map(stock => ({ code: stock.symbol, name: stock.name })), [stocks.data])
  const names = useMemo(() => Object.fromEntries((stocks.data ?? []).map(stock => [stock.symbol, stock.symbol])), [stocks.data])
  // 지수 막대는 하루 보기면 그 거래일의 종가 변동, 기간 보기면 시작일 전 거래일 종가부터 종료일 종가까지의 변동이다.
  // 미국은 저장된 시세가 모두 종가라서 가장 최근 날도 막대를 만든다.
  const day = snapshotTime ? snapshotTime.slice(0, 10) : null
  const startDay = rangeStart ? rangeStart.slice(0, 10) : day
  const indexCloses = useUsaIndexCloses(startDay ? shiftDate(startDay, -INDEX_LOOKBACK_DAYS) : null, day)
  const indexRate = day && startDay && indexCloses.data ? indexChangeRate(indexCloses.data, startDay, day) : null
  const { preferences, update } = useUsaGraphPreferences()
  const tierRange = useOverseasTierRange(overseasSettingKey(USA_MAP_SETTING_PREFIX, sheet), '달러')
  const sectorExclusion = useOverseasSectorExclusion(overseasSettingKey(USA_MAP_SETTING_PREFIX, sheet))

  // 필터 전 업종 트리 — 막대 계산과 제외 업종 목록, 설정창의 종목 수가 함께 쓴다.
  const tree = useMemo<HeatmapSectorNode[]>(
    () => (categories.data && classifications.data && stocks.data && shownQuotes?.snapshotTime ? buildJapanTree(treeStocks, categories.data, classifications.data, names, shownQuotes.quotes, shownQuotes.snapshotTime) : []),
    [categories.data, classifications.data, stocks.data, shownQuotes, treeStocks, names],
  )
  const shownCount = useMemo(() => countVisibleItems(tree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers), [tree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers])
  const chart = useMemo(() => {
    const depth = preferences.groupDepth
    const entries: RankColumnItem[] = []
    for (const { node, pathKey } of collectAtDepth(tree, depth, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, depth < 2)) {
      const average = computeSectorAverage(node, tierRange.excludedMarketValueTiers)
      const value = preferences.avgChangeRateUseSimple ? average.simpleAvg : average.weightedAvg
      if (value !== null) entries.push({ key: pathKey, sectorName: node.sectorName, value })
    }
    if (indexRate !== null) entries.push({ key: 'market-index:SP500', sectorName: overseasMarketInfo('USA').badgeLabel, value: indexRate, isReference: true })
    return buildRankChart(entries)
  }, [tree, preferences.groupDepth, preferences.avgChangeRateUseSimple, indexRate, tierRange.excludedMarketValueTiers, sectorExclusion.excludedSectorIds])

  const refetchAll = () => Promise.all([quotes.refetch(), snapshotTimes.refetch(), categories.refetch(), classifications.refetch(), stocks.refetch(), ...(rangeStart ? [periodQuotes.refetch()] : [])])
  const isLoading = isPeriodResolving || categories.isLoading || classifications.isLoading || stocks.isLoading || quotes.isLoading || periodQuotes.isLoading || snapshotTimes.isLoading || indexCloses.isLoading
  const isError = categories.isError || classifications.isError || stocks.isError || quotes.isError || periodQuotes.isError
  return {
    market: 'USA',
    label: overseasMarketInfo('USA').badgeLabel,
    chart,
    titleText: preferences.avgChangeRateUseSimple ? '동일 가중 등락률' : '시총 가중 등락률',
    titleUnit: '%',
    depthNames: ['대분류', '중분류'],
    groupDepth: preferences.groupDepth,
    snapshotTime,
    liveSnapshotTime: liveQuotes.data?.snapshotTime ?? null,
    selectedTime,
    rangeStart,
    select,
    selectRange,
    rangeExcludedStocks,
    isLoading,
    isError,
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching || stocks.isFetching,
    refetchAll,
    DatePicker: UsaDatePicker,
    sessionChip: <UsaSessionChip session={USA_SESSION} />,
    refreshHelp: usaRefreshHelp(snapshotTime),
    fixed: USA_MAP_FIXED,
    draftKeyMap: sheet === 'MINE' ? USA_GRAPH_DRAFT_KEY_MAP : undefined,
    tabStorageName: USA_SETTINGS_TAB_STORAGE.graph,
    totalCount: stocks.data?.length ?? 0,
    shownCount,
    tierRange,
    sectorExclusion,
    exclusionTree: tree,
    currencyUnit: '달러',
    graphSettings: (
      <>
        <SettingsGraphDepthSection depth={preferences.groupDepth} onChange={groupDepth => update({ groupDepth })} selectableDepth={2} />
        <SettingsAverageModeSection avgChangeRateUseSimple={preferences.avgChangeRateUseSimple} onChange={avgChangeRateUseSimple => update({ avgChangeRateUseSimple })} enabled onToggle={ignoreToggle} toggleDisabled toggleDisabledHint={<>종가만 저장되는 시장이라<br />N분 전 대비로 바꿀 수 없습니다.</>} />
        {/* 일본 그래프와 같은 "비교 시점" 항목이지만, 미국은 하루 한 번 저장된 종가만 있어 쓸 수 없다 — 등락률 색상 고정 항목처럼 잠가 둔다. */}
        <SettingsBeforeMinutesSection beforeMinutes={USA_BEFORE_MINUTES_PLACEHOLDER} onChange={ignoreToggle} enabled={false} onToggle={ignoreToggle} lockedReason={<>종가만 저장되는 시장이라<br />N분 전 대비를 사용할 수 없습니다.</>} />
      </>
    ),
  }
}
