import { useMemo } from 'react'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData } from '@/hooks/useOverseasClassificationData'
import { overseasSettingKey } from '@/utils/overseasSettingKey'
import { useOverseasSectorExclusion } from '@/hooks/useOverseasSectorExclusion'
import { countVisibleItems } from '@/utils/overseasSectorExclusion'
import { useOverseasTierRange } from '@/hooks/useOverseasTierRange'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import JapanDatePicker from '@/components/JapanDatePicker'
import JapanSessionChip from '@/components/JapanSessionChip'
import type { RankColumnItem } from '@/components/RankColumns'
import { SettingsAverageModeSection, SettingsBeforeMinutesSection, SettingsGroupDepthSection } from '@/components/SettingsPanel'
import stocks from '@/data/japanStocks.json'
import type { OverseasGraphSource } from '@/hooks/overseasGraphSource'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { useJapanGraphPreferences } from '@/hooks/useJapanGraphPreferences'
import { useJapanIndexCloses } from '@/hooks/useJapanIndexCloses'
import { useJapanIndexQuotes } from '@/hooks/useJapanIndexQuotes'
import { useJapanPeriodQuotes, useJapanQuotes, useJapanSnapshotTimes } from '@/hooks/useJapanQuotes'
import type { HeatmapSectorNode } from '@/types/api'
import { graphIndexValue, indexChangeRate, indexRange, intradayRateAt, shiftDate } from '@/utils/indexChange'
import { JAPAN_GRAPH_DRAFT_KEY_MAP } from '@/utils/japanGraphSettings'
import { buildJapanTree } from '@/utils/japanMap'
import { JAPAN_MAP_FIXED, JAPAN_MAP_SETTING_PREFIX, JAPAN_REFRESH_HELP, JAPAN_SETTINGS_TAB_STORAGE } from '@/utils/japanMapSettings'
import { japanSessionAt } from '@/utils/japanMarketSession'
import { overseasMarketInfo } from '@/utils/markets'
import { buildRankChart } from '@/utils/rankChart'
import { computeSectorAverage } from '@/utils/sectorAverage'
import { collectAtDepth } from '@/utils/sectorDepth'

// 휴장이 이어져도 시작일 앞 거래일의 종가가 들어오도록 시작일 앞 며칠을 더 받는다(황금연휴 등).
const INDEX_LOOKBACK_DAYS = 14
const NIKKEI_LABEL = '닛케이'

// 기준 시각에서 N분 전 시각을 "YYYY-MM-DDTHH:mm"으로 만든다. 일본 시각을 한국 시각과 같게 저장해서 시간대 변환이 없다.
function minutesBefore(snapshotTime: string, minutes: number): string {
  const time = new Date(new Date(snapshotTime).getTime() - minutes * 60_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(time.getHours())}:${pad(time.getMinutes())}`
}

// 일본 그래프의 데이터·설정 — 공통 그래프 화면(OverseasGraphView)이 받는 모양으로 돌려준다.
// 일본은 5분마다 저장된 시세로 "N분 전 대비" 비교와 장중 지수(닛케이)를 쓴다.
export function useJapanGraphSource(): OverseasGraphSource {
  // 내 기준 모드(관리자)는 MARKETRY에 올리기 전 사본 분류로 그린다.
  const { sheet } = useOverseasSheet()
  const { categories, classifications } = useOverseasClassificationData('JAPAN', sheet)
  const names = useQuery({ queryKey: ['japan', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/japan/stock-names')).data })
  const snapshotTimes = useJapanSnapshotTimes()
  const { selectedTime, rangeStart, isResolving: isPeriodResolving, select, selectRange } = useCrossMarketPeriod('JAPAN', snapshotTimes.data)
  const quotes = useJapanQuotes(selectedTime)
  const liveQuotes = useJapanQuotes()
  const periodQuotes = useJapanPeriodQuotes(rangeStart, selectedTime)
  // 기준가가 없어 기간에서 뺀 종목 — 제외 종목 배지에 이름과 함께 보인다.
  const rangeExcludedStocks = periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: names.data?.[stock.stockCode] ?? stock.stockCode }))
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const snapshotTime = quotes.data?.snapshotTime ?? null
  // 종가 기준 지수 막대는 기간과 지난 날짜 보기에 쓴다. 오늘 화면은 종가가 아직 저장되지 않아 이 값이 없고, 장중 지수(아래)가 대신한다.
  const indexSpan = indexRange(rangeStart, snapshotTime, liveQuotes.data?.snapshotTime ?? null)
  const indexCloses = useJapanIndexCloses(indexSpan ? shiftDate(indexSpan.startDate, -INDEX_LOOKBACK_DAYS) : null, indexSpan?.endDate ?? null)
  const indexRate = indexSpan && indexCloses.data ? indexChangeRate(indexCloses.data, indexSpan.startDate, indexSpan.endDate) : null
  const { preferences, update } = useJapanGraphPreferences()
  // 시가총액 범위는 지도와 같은 저장 값을 쓴다(국내도 같은 분류의 지도·그래프가 값을 공유한다).
  const tierRange = useOverseasTierRange(overseasSettingKey(JAPAN_MAP_SETTING_PREFIX, sheet), '엔')
  const sectorExclusion = useOverseasSectorExclusion(overseasSettingKey(JAPAN_MAP_SETTING_PREFIX, sheet))
  const showDelta = rangeStart === null && preferences.graphMode === 'delta'
  const toggleGraph = () => update({ graphMode: showDelta ? 'current' : 'delta' })
  // N분 전 시세가 저장돼 있을 때만 비교한다. 없으면 비교 그래프는 데이터 없음으로 표시한다.
  const beforeTime = useMemo(() => {
    if (!showDelta || !snapshotTime) return null
    const target = minutesBefore(snapshotTime, preferences.beforeMinutes)
    return snapshotTimes.data?.find(time => time.slice(0, 16) === target) ?? null
  }, [showDelta, snapshotTime, snapshotTimes.data, preferences.beforeMinutes])
  // 시각이 없으면 조회를 끈다. 이때 data는 최신 시세 캐시일 수 있어 아래에서 쓰지 않는다.
  const beforeQuotes = useJapanQuotes(beforeTime, beforeTime !== null)
  // 장중 지수 — 하루 보기(기간이 아닌 보기)에서 지금 시각과 N분 전 시각의 닛케이 등락률을 쓴다. 기간 보기는 종가 기준 막대만 쓴다.
  const indexQuotesNow = useJapanIndexQuotes(rangeStart === null && snapshotTime ? snapshotTime.slice(0, 10) : null)
  const indexQuotesBefore = useJapanIndexQuotes(showDelta && beforeTime ? beforeTime.slice(0, 10) : null)
  const indexValue = graphIndexValue({
    showDelta,
    nowRate: rangeStart === null ? intradayRateAt(indexQuotesNow.data, snapshotTime) : null,
    beforeRate: intradayRateAt(indexQuotesBefore.data, beforeTime),
    dailyRate: indexRate,
  })

  const treeOf = (snapshot: typeof quotes.data): HeatmapSectorNode[] =>
    categories.data && classifications.data && names.data && snapshot?.snapshotTime
      ? buildJapanTree(stocks, categories.data, classifications.data, names.data, snapshot.quotes, snapshot.snapshotTime)
      : []
  const chart = useMemo(() => {
    const depth = preferences.groupDepth
    const valueOf = (node: HeatmapSectorNode) => {
      const average = computeSectorAverage(node, tierRange.excludedMarketValueTiers)
      return preferences.avgChangeRateUseSimple ? average.simpleAvg : average.weightedAvg
    }
    const entriesOf = (nodes: HeatmapSectorNode[]) => collectAtDepth(nodes, depth, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, depth < 3)
    const beforeByPath = new Map(entriesOf(beforeTime ? treeOf(beforeQuotes.data) : []).map(({ node, pathKey }) => [pathKey, node]))
    const entries: RankColumnItem[] = []
    for (const { node, pathKey } of entriesOf(treeOf(shownQuotes))) {
      const now = valueOf(node)
      if (now === null) continue
      if (!showDelta) {
        entries.push({ key: pathKey, sectorName: node.sectorName, value: now })
        continue
      }
      const beforeNode = beforeByPath.get(pathKey)
      const before = beforeNode ? valueOf(beforeNode) : null
      if (before !== null) entries.push({ key: pathKey, sectorName: node.sectorName, value: now - before })
    }
    if (indexValue !== null) entries.push({ key: 'market-index:NIKKEI225', sectorName: NIKKEI_LABEL, value: indexValue, isReference: true })
    return buildRankChart(entries)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- treeOf는 아래 값들로만 결과가 정해진다
  }, [categories.data, classifications.data, names.data, shownQuotes, beforeQuotes.data, beforeTime, showDelta, preferences.groupDepth, preferences.avgChangeRateUseSimple, indexValue, tierRange.excludedMarketValueTiers, sectorExclusion.excludedSectorIds])

  // 제외 업종 목록(이름·종목 수)을 만들 필터 전 트리와, 제외·시가총액 범위를 거친 뒤 남은 종목 수 — 설정창의 "n/m종목"에 쓴다.
  const exclusionTree = useMemo(() => treeOf(shownQuotes), [categories.data, classifications.data, names.data, shownQuotes]) // eslint-disable-line react-hooks/exhaustive-deps -- treeOf는 이 값들로만 결과가 정해진다
  const shownCount = useMemo(() => countVisibleItems(exclusionTree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers), [exclusionTree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers])

  const refetchAll = () => Promise.all([quotes.refetch(), snapshotTimes.refetch(), categories.refetch(), classifications.refetch(), names.refetch(), ...(rangeStart ? [periodQuotes.refetch()] : [])])
  const isLoading = isPeriodResolving || categories.isLoading || classifications.isLoading || names.isLoading || quotes.isLoading || periodQuotes.isLoading || snapshotTimes.isLoading || beforeQuotes.isLoading || indexCloses.isLoading || indexQuotesNow.isLoading || indexQuotesBefore.isLoading
  const isError = categories.isError || classifications.isError || names.isError || quotes.isError || periodQuotes.isError || beforeQuotes.isError
  const session = japanSessionAt(snapshotTime ?? new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T'))
  return {
    market: 'JAPAN',
    label: overseasMarketInfo('JAPAN').badgeLabel,
    chart,
    titleText: showDelta ? `${preferences.beforeMinutes}분 전 대비` : preferences.avgChangeRateUseSimple ? '동일 가중 등락률' : '시총 가중 등락률',
    titleUnit: showDelta ? '%p' : '%',
    depthNames: ['대분류', '중분류', '소분류'],
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
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching || names.isFetching,
    refetchAll,
    DatePicker: JapanDatePicker,
    sessionChip: <JapanSessionChip session={session} />,
    refreshHelp: JAPAN_REFRESH_HELP,
    fixed: JAPAN_MAP_FIXED,
    draftKeyMap: sheet === 'MINE' ? JAPAN_GRAPH_DRAFT_KEY_MAP : undefined,
    tabStorageName: JAPAN_SETTINGS_TAB_STORAGE.graph,
    totalCount: stocks.length,
    shownCount,
    tierRange,
    sectorExclusion,
    exclusionTree,
    currencyUnit: '엔',
    graphSettings: (
      <>
        <SettingsGroupDepthSection depth={preferences.groupDepth} onChange={groupDepth => update({ groupDepth })} selectableDepth={3} />
        <SettingsAverageModeSection avgChangeRateUseSimple={preferences.avgChangeRateUseSimple} onChange={avgChangeRateUseSimple => update({ avgChangeRateUseSimple })} enabled={!showDelta} onToggle={toggleGraph} />
        <SettingsBeforeMinutesSection beforeMinutes={preferences.beforeMinutes} onChange={beforeMinutes => update({ beforeMinutes })} enabled={showDelta} onToggle={toggleGraph} />
      </>
    ),
  }
}
