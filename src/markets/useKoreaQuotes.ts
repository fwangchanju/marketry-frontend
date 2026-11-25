import { useEffect, useMemo, useState } from 'react'
import type { TaxonomySource } from '@/utils/taxonomyNames'
import { useNxtOnlyWindow } from '@/hooks/useNxtOnlyWindow'
import { useAfterHoursControlsVisible } from '@/hooks/useTradingSession'
import { isAfterHoursSelectable as isAfterHoursSelectableAt } from '@/utils/tradingWindow'
import type { ChangeRateChoice, ChangeRateMode } from '@/api/heatmap'
import { useTransientSetting } from '@/hooks/useTransientSetting'
import { useHeatmap, usePriceAdjustments, useSnapshotDays, usePreviousTradingDay } from '@/hooks/useHeatmap'
import { useSnapshotSelection } from '@/hooks/useSnapshotSelection'
import { useSnapshotTimeOnOrBefore } from '@/hooks/useSnapshotDayLookup'
import { withStableSectorIds } from '@/utils/guestSectorIds'
import type { MarketQuery, HeatmapResponse, HeatmapSectorNode } from '@/types/api'
import { buildRangeChangeRateTree } from '@/utils/rangeChangeRate'

const NO_RANGE_ADJUSTMENTS: Readonly<Record<string, number>> = {}

function withPriceLabels(nodes: HeatmapSectorNode[], labels: { base: string; end: string }): HeatmapSectorNode[] {
  return nodes.map(node => ({
    ...node,
    items: node.items.map(item => ({ ...item, rangeLabels: labels })),
    children: withPriceLabels(node.children, labels),
  }))
}

// 한국의 시세·날짜·등락률 기준(누적·종가·별도)·기간. 시세 출처를 바꿔도 이 값의 모양은 그대로다.
export function useKoreaQuotes({ market, source, isLoggedIn, isMarketry, isWaitingForSession, needsTree, allowChangeRateMode, readOnly }: {
  market: MarketQuery
  source: TaxonomySource
  isLoggedIn: boolean
  isMarketry: boolean
  isWaitingForSession: boolean
  needsTree: boolean
  allowChangeRateMode: boolean
  readOnly: boolean
}) {
  // NXT 종목만 보기 — 어느 분류(거래소/MARKETRY)이든 오늘의 시간표가 정한 필터 구간에만
  // 분류는 그대로 두고 NXT 거래 종목만 남기고, 그 밖의 시간에는 전체 종목을 보여준다. 사용자가 직접 켜고 끄지 않는다.
  const nxtOnlyWindow = useNxtOnlyWindow()
  // 등락률 기준은 애프터 마켓 시작부터 다음 프리 마켓 개장 전까지 선택한다.
  // 표시 시간대가 아니거나 시간외 스냅샷이 아직 없으면 저장한 선택과 무관하게 누적으로 보인다.
  const [afterHoursStart, setAfterHoursStart] = useState<string | null>(null)
  const isAfterHoursControlsVisible = useAfterHoursControlsVisible(afterHoursStart)
  const [storedChangeRateChoice, setStoredChangeRateChoice] = useTransientSetting<ChangeRateChoice>('heatmap.changeRateMode', 'daily')
  // 렌더러(텔레그램 발송)가 ?capture=mobile&basis=close|afterHours 로 열면 저장된 선택과 표시 시간대에 상관없이 그 기준으로 그린다(15:30~15:40은 종가, 15:40 이후는 별도).
  // 렌더러는 저장된 선택이 없는 새 브라우저라 주소로 정해 주지 않으면 늘 누적으로 보인다.
  const captureBasis = useMemo<ChangeRateChoice | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const basis = params.get('basis')
    return params.get('capture') === 'mobile' && (basis === 'close' || basis === 'afterHours') ? basis : null
  }, [])
  const requestedChoice: ChangeRateChoice = allowChangeRateMode && captureBasis !== null
    ? captureBasis
    : allowChangeRateMode && isAfterHoursControlsVisible ? storedChangeRateChoice : 'daily'
  const requestedBasis: ChangeRateMode = requestedChoice === 'afterHours' ? 'afterHours' : 'daily'
  // 달력에서 지난 날짜를 골랐을 때의 종가 스냅샷 시각 — 없으면 실시간(최신). 시장(코스피·코스닥·전체)을 바꿔도 선택은 풀리지 않는다.
  // 고른 시장의 시각을 그대로 기억해 두고, 다른 시장으로 바뀌면 그 시장의 종가 지도 목록에서 같은 날짜의 시각을 다시 찾는다.
  // 선택은 지도·그룹이 함께 쓰는 저장소에 둔다(그룹에서 업종을 눌러 지도로 가도 풀리지 않게).
  const { pinned: pinnedSelection, range: rangeSelection, liveSnapshotTime, setSelection, setLiveSnapshotTime } = useSnapshotSelection()
  // 기간 등락률 — 달력에서 시작일~종료일을 골랐을 때의 시작일 종가 스냅샷 시각. 종료일은 위 pinnedSelection이 그대로 맡는다(종료일 종가 지도).
  // 날짜 하나를 고르거나 실시간으로 돌아가면 풀린다.
  const onChangePinnedSnapshotTime = (snapshotTime: string | null) => {
    setSelection(snapshotTime === null ? null : { market, snapshotTime }, null)
  }
  const onSelectRange = (startSnapshotTime: string, endSnapshotTime: string) => {
    setSelection({ market, snapshotTime: endSnapshotTime }, { market, snapshotTime: startSnapshotTime })
  }
  // 고른 시장이 아닌 시장을 보는 중이면 그 시장의 같은 날짜 시각을 목록에서 찾는다. 목록을 받기 전이거나 그 날짜가 없으면 고른 시각을 그대로 쓴다.
  // 다른 시장(일본·미국)에서 고른 날짜는 이 시장의 같은 날짜, 없으면 이전 거래일 종가로 옮긴다. 목록을 받기 전에는 정해지지 않은 것으로 본다.
  const pinnedNeedsLookup = pinnedSelection !== null && pinnedSelection.market !== market
  const pinnedLookedUp = useSnapshotTimeOnOrBefore(market, pinnedNeedsLookup ? pinnedSelection.snapshotTime.slice(0, 10) : null, pinnedNeedsLookup)
  const pinnedSnapshotTime = pinnedSelection === null
    ? undefined
    : (pinnedNeedsLookup ? pinnedLookedUp : pinnedSelection.snapshotTime)
  const rangeNeedsLookup = rangeSelection !== null && rangeSelection.market !== market
  const rangeLookedUp = useSnapshotTimeOnOrBefore(market, rangeNeedsLookup ? rangeSelection.snapshotTime.slice(0, 10) : null, rangeNeedsLookup)
  const rangeStartTime = rangeSelection === null || pinnedSnapshotTime === undefined
    ? undefined
    : (rangeNeedsLookup ? rangeLookedUp : rangeSelection.snapshotTime)
  // NXT는 별도 거래소/설정 프로필이 아니라 특정 시간대에만 적용하는 종목 필터다.
  // NXT 종목만 보기는 실시간 지도에만 쓴다 — 그 시간대(15:40~16:00 등)에도 종가·지난 날짜·기간은 그날의 전종목을 보여 준다.
  // (종가는 오늘 정규장이 어떻게 끝났는지 보는 것이라 NXT 거래 종목만이 아니다.) 종목 수 분모도 받아 온 종목 수라 같이 전종목이 된다.
  const nxtOnly = nxtOnlyWindow !== null && pinnedSnapshotTime === undefined && requestedChoice !== 'close'
  // 이 계산의 'NXT'는 시간대 필터 상태를 기존 UI에 전달하기 위한 내부값이다. 프로필 분리·저장 키에 사용하지 않는다.
  // 달력이 "오늘(실시간)"을 알아보려면 지난 날짜를 보는 동안에도 최신 스냅샷 시각을 기억해야 한다.

  // 종가 선택 — 지금 보는 날짜(실시간 스냅샷의 날짜)의 정규장 종가 스냅샷 시각을 달력과 같은 목록에서 찾아 그 지도를 받는다.
  // 실시간 날짜는 한 번이라도 실시간 지도를 받아야 알 수 있어서, 처음 한 번은 실시간 지도를 받고 그 뒤에 종가로 옮겨 간다.
  const wantsClose = requestedChoice === 'close' && pinnedSnapshotTime === undefined
  const liveDate = liveSnapshotTime?.slice(0, 10)
  const { data: closeDays, isSuccess: isCloseDaysSuccess, isError: isCloseDaysError, refetch: refetchCloseDays } = useSnapshotDays(
    market,
    liveDate?.slice(0, 7) ?? '',
    // 서버 오류가 계속되면 기본 재시도(3회, 30초 넘게)가 "불러오는 중"을 너무 오래 잡으므로 재시도하지 않고, 다시 시도는 종가 버튼으로 받는다.
    { enabled: wantsClose && liveDate !== undefined, retry: false },
  )
  const closeSnapshotTime = wantsClose ? closeDays?.find(day => day.date === liveDate)?.snapshotTime : undefined
  const isCloseActive = closeSnapshotTime !== undefined
  // 종가 지도가 없는 날(휴장 등)이거나 종가 시각 목록을 받지 못했으면(오류) 종가 선택을 누적으로 보여 준다. 실시간 지도를 보면서 종가라고 표시하지 않는다.
  const isCloseUnavailable = wantsClose && (isCloseDaysSuccess || isCloseDaysError) && !isCloseActive

  const {
    data: snapshotData,
    isLoading: isSnapshotLoading,
    isError: isSnapshotError,
    isSuccess: isSnapshotSuccess,
    isRefetching: isRefetchingHeatmap,
    refetch: refetchSnapshot,
  } = useHeatmap(market, source, nxtOnly, {
    enabled: needsTree && !isWaitingForSession,
    basis: requestedBasis,
    snapshotTime: pinnedSnapshotTime ?? closeSnapshotTime,
  })
  // 기간 등락률 — 시작일 종가 지도를 따로 받아, 종료일 지도(snapshotData)의 종목마다 시작일 하루 전 종가 대비 등락률로 바꾼다.
  const isRangeActive = rangeStartTime !== undefined
  // 기준은 시작일 1거래일 전의 종가다 — 그 거래일의 종가 지도에서 종가를 가져온다. 앞선 거래일을 못 찾으면(맨 처음 날짜) 시작일 지도의 전일종가로 대신한다.
  const rangePreviousDay = usePreviousTradingDay(market, rangeStartTime?.slice(0, 10) ?? null, { enabled: isRangeActive })
  const rangeBaseSnapshotTime = rangePreviousDay === undefined ? undefined : (rangePreviousDay?.snapshotTime ?? rangeStartTime)
  const rangeBaseKind = rangePreviousDay ? 'close' : 'previousClose'
  const {
    data: rangeStartData,
    isLoading: isRangeStartLoading,
    isError: isRangeStartError,
    refetch: refetchRangeStart,
  } = useHeatmap(market, source, nxtOnly, {
    enabled: needsTree && !isWaitingForSession && isRangeActive && rangeBaseSnapshotTime !== undefined,
    snapshotTime: rangeBaseSnapshotTime,
  })
  // 종료일 가격의 이름 — 종료일의 종가 지도 시각 목록에 있으면 종가, 없으면(장중 실시간 지도) 현재가. 종목 팝업에 보인다.
  const { data: rangeEndMonthDays } = useSnapshotDays(market, pinnedSnapshotTime?.slice(0, 7) ?? '', { enabled: isRangeActive, retry: 1 })
  const rangeEndPriceLabel = rangeEndMonthDays?.some(day => day.snapshotTime === pinnedSnapshotTime) === false ? '현재가' : '종가'
  // 기준일 다음 날부터 종료일까지의 분할·병합·감자 비율. 기준일 지도가 전일 종가를 쓰는 경우는 시작일 자체의 변경이 이미 반영돼 있다.
  const rangeAdjustmentFrom = rangeBaseSnapshotTime?.slice(0, 10) ?? null
  const rangeAdjustments = usePriceAdjustments(rangeAdjustmentFrom, pinnedSnapshotTime?.slice(0, 10) ?? null, { enabled: isRangeActive })
  // 비율을 못 받으면 하루치처럼 숨기지 않고 보정 없이 그린다. 분할이 없는 대부분의 종목은 값이 같다.
  const rangeAdjustmentData = rangeAdjustments.data ?? (rangeAdjustments.isError ? NO_RANGE_ADJUSTMENTS : undefined)
  const rangeResult = useMemo(
    () => (snapshotData && rangeStartData && rangeAdjustmentData ? buildRangeChangeRateTree(snapshotData.items, rangeStartData.items, rangeBaseKind, rangeEndPriceLabel, rangeAdjustmentData) : null),
    [snapshotData, rangeStartData, rangeBaseKind, rangeEndPriceLabel, rangeAdjustmentData],
  )
  // 기간 등락률을 보는 동안 두 지도가 다 오기 전에는 값이 없다 — 종료일 지도 그대로의(하루치) 등락률을 기간 값처럼 보여 주지 않는다.
  const data: HeatmapResponse | undefined = useMemo(
    () => {
      if (isRangeActive) return rangeResult && snapshotData ? { ...snapshotData, items: rangeResult.items } : undefined
      // 종가를 보는 동안에는 지도가 정규장 종가라서, 종목 팝업의 가격 줄 이름을 "현재가" 대신 "당일종가"로 보여 준다.
      if (isCloseActive && snapshotData) return { ...snapshotData, items: withPriceLabels(snapshotData.items, { base: '전일종가', end: '당일종가' }) }
      // 별도(시간외)는 정규장 종가가 기준가라서, 서버가 전일종가 자리에 그 종가를 담아 보낸다.
      if (requestedBasis === 'afterHours' && snapshotData && isAfterHoursSelectableAt(snapshotData.snapshotTime, snapshotData.afterHoursStart)) {
        return { ...snapshotData, items: withPriceLabels(snapshotData.items, { base: '당일종가', end: '현재가' }) }
      }
      return snapshotData
    },
    [isRangeActive, rangeResult, snapshotData, isCloseActive, requestedBasis],
  )
  const rangeExcludedStocks = rangeResult?.excludedStocks ?? []
  const isHeatmapLoading = isSnapshotLoading || (isRangeActive && (rangePreviousDay === undefined || isRangeStartLoading))
  const isError = isSnapshotError || (isRangeActive && isRangeStartError)
  const isHeatmapSuccess = isSnapshotSuccess && (!isRangeActive || rangeResult !== null)
  const refetchHeatmap = async () => {
    await Promise.all([
      refetchSnapshot(),
      ...(isRangeActive ? [refetchRangeStart()] : []),
    ])
  }
  const dataSnapshotTime = data?.snapshotTime
  // 종가 시각 목록을 기다리는 동안은 지도가 그대로라 아무 변화가 없어 보이므로, 이때부터 "불러오는 중" 화면을 띄운다.
  const isCloseWaiting = wantsClose && !isCloseActive && !isCloseUnavailable
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 응답이 없는 동안(다른 날짜·시장을 불러오는 중)에는 마지막으로 받은 값을 유지하는 상태라 응답에서 바로 계산할 수 없다. 이 줄은 색상 코드를 훅으로 옮기기 전에도 같았고, 옮긴 뒤 린트가 이 훅을 끝까지 검사하게 되어 드러났다.
    if (data) setAfterHoursStart(data.afterHoursStart ?? null)
  }, [data])
  useEffect(() => {
    if (!readOnly && pinnedSnapshotTime === undefined && !isCloseActive && dataSnapshotTime) setLiveSnapshotTime(dataSnapshotTime)
  }, [pinnedSnapshotTime, isCloseActive, dataSnapshotTime, setLiveSnapshotTime, readOnly])
  // 종가를 보는 동안에는 받은 지도가 정규장 종가라서, 별도가 열렸는지는 실시간 스냅샷으로 따진다.
  const isAfterHoursSelectable = isAfterHoursControlsVisible && isAfterHoursSelectableAt(isCloseActive ? liveSnapshotTime : data?.snapshotTime, data?.afterHoursStart)
  const changeRateMode: ChangeRateMode = isAfterHoursSelectable ? requestedBasis : 'daily'
  const changeRateChoice: ChangeRateChoice = requestedChoice === 'close' && !isCloseUnavailable ? 'close' : changeRateMode
  const rawRootNodes = data?.items
  // 비로그인의 거래소 분류는 업종 id가 모두 0이라, 제외 기능이 동작하도록 이름 기반 고유 id를 붙인다.
  // MARKETRY는 비로그인도 진짜 업종 id를 받으므로 그대로 쓴다.
  const rootNodes = useMemo(
    () => (isLoggedIn || isMarketry ? (rawRootNodes ?? []) : withStableSectorIds(rawRootNodes ?? [])),
    [isLoggedIn, isMarketry, rawRootNodes],
  )
  return {
    nxtOnly, nxtOnlyWindow, isAfterHoursControlsVisible, isAfterHoursSelectable, changeRateMode, changeRateChoice, setStoredChangeRateChoice, isCloseDaysError, refetchCloseDays,
    pinnedSnapshotTime, rangeStartTime, liveSnapshotTime, onChangePinnedSnapshotTime, onSelectRange, rangeExcludedStocks,
    data, rootNodes, isHeatmapLoading, isCloseWaiting, isError, isHeatmapSuccess, refetchHeatmap, isRefetchingHeatmap,
  }
}
