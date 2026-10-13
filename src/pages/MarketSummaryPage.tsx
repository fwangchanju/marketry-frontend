import { Fragment, useMemo, useRef, useState } from 'react'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import { CaptureIcon } from '@/components/icons/MarketMapIcons'
import SettingsSidebar, { SettingsGroupDepthSection } from '@/components/SettingsSidebar'
import DepthBadge from '@/components/DepthBadge'
import MarketIndexLine from '@/components/MarketIndexLine'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import Spinner from '@/components/Spinner'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import ChangeRateBar from '@/components/ChangeRateBar'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { useMarketNotices } from '@/hooks/useMarketNotices'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsSidebarSide } from '@/hooks/useSettingsSidebarSide'
import { captureElementToClipboard, copyDataUrlToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload, captureFileName, downloadDataUrl } from '@/utils/captureToDownload'
import { toCount, toJoEokDecimal, toMarketMapSnapshotDateLabel, toMarketMapSnapshotTimeOnlyLabel } from '@/utils/format'
import { buildRankChart } from '@/utils/rankChart'
import { collectItems, computeSectorAverage } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredMarketMapTree'
import { collectAtDepth } from '@/utils/sectorDepth'

// 홈 화면 시험 배치 — 대분류 업종만으로 그린 약식 등락률 지도와 그룹 등락률 그래프를 스마트폰 크기 틀(가로 360px)에 나란히 둔다.
// 모바일 사용자에게 캡처해서 보여 주기 좋은지 보고 계속 진행할지 정한다. 관심종목·요약 API는 쓰지 않는다.
type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

// 안내 틀에 항상 한 칸씩 두는 안내 종류 — 신규(신규 상장)를 먼저, 정지(거래정지로 지도에서 빠지기 시작한 종목)를 그 아래에 둔다.
const NOTICE_TYPES = [
  { type: 'NEW_LISTING', label: '신규 상장', badgeClass: 'bg-cyan-700', countLabel: '3개월 내 상장', countKey: 'recentNewListingCount', valueKey: 'recentNewListingMarketValue' },
  { type: 'TRADING_SUSPENSION', label: '거래 정지', badgeClass: 'bg-cyan-900', countLabel: '현재 정지 종목', countKey: 'currentSuspensionCount', valueKey: 'currentSuspensionMarketValue' },
] as const

export default function MarketSummaryPage() {
  // 틀마다 캡처 버튼이 있다 — 누른 틀 하나만(버튼은 빼고) 캡처하며, 공유창은 지도·그룹 페이지와 같은 것을 쓴다.
  // 시험용 — 지도와 그래프를 대분류가 아니라 중분류·소분류로도 그려 본다(1=대분류, 2=중분류, 3=소분류). 하위 단계가 없는 분류(거래소)는 대분류만 된다.
  const allFramesRef = useRef<HTMLDivElement>(null)
  const frameRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [captureTarget, setCaptureTarget] = useState<HTMLElement | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { settingsModalProps, data, isLoading, isError, refetchMarketMap, pinnedSnapshotTime, rangeStartTime, changeRateMode, colorScale, strongIndustryColor, excludedSectorIds, excludedMarketValueTiers } = useGlobalSettings()
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsSidebarSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()

  // 지도 위 한 줄에 넣을 코스피·코스닥 지수 등락률 — 지도 조회(ALL STOCK)에는 지수가 없어 요약 조회에서 받는다.
  const { data: marketSummary } = useMarketSummary()
  // 안내는 지도와 따로 불러온다 — 실패하거나 느려도 홈 화면을 막지 않고, 못 받으면 틀만 비워 둔다.
  const { data: notices } = useMarketNotices()
  // 요약 조회의 지수는 항상 최근 값이다 — 지도가 지난 시각이나 기간을 보고 있거나 시간외 별도 등락률이면 맞지 않으므로 보여 주지 않는다(그룹 페이지도 일간 등락률일 때만 넣는다).
  const isLatestDailyView = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily'
  const indexOf = (market: 'KOSPI' | 'KOSDAQ') => {
    const item = isLatestDailyView ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === market) : undefined
    return { indexValue: item?.indexValue ?? null, changeRate: item?.changeRate ?? null }
  }

  // 홈은 업종 분류 단계를 대분류로 잠가 둔다 — 단계를 내리면 상위 업종에 직접 붙은 종목이 막대에서 빠져 종목 수·평균이 달라지기 때문이다(docs/history.md).
  const effectiveDepth = 1
  // 고른 단계의 업종만 모아 지도 박스와 그래프 막대로 쓴다 — 지도 페이지와 같은 제외 기준을 따른다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    // 그래프에 든 업종의 종목 중 오른 종목·내린 종목·보합 종목 수 — 평균과 같은 기준(제외한 시가총액 구간 빼고 하위 업종 전체)으로 센다.
    let advancers = 0
    let decliners = 0
    let unchanged = 0
    for (const { node, pathKey } of collectAtDepth(data?.items ?? [], effectiveDepth, excludedSectorIds, excludedMarketValueTiers)) {
      const average = computeSectorAverage(node, excludedMarketValueTiers)
      if (average.weightedAvg === null) continue
      items.push({ key: pathKey, name: node.sectorName, marketValue: node.totalMarketValue, changeRate: average.weightedAvg })
      for (const item of collectItems(node)) {
        if (excludedMarketValueTiers.has(item.marketValueTier)) continue
        if (item.changeRate > 0) advancers += 1
        else if (item.changeRate < 0) decliners += 1
        else unchanged += 1
      }
    }
    const entries = items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate, isReference: false }))
    // 그룹 페이지처럼 코스피·코스닥 지수 등락률을 강조 색 참조 막대로 값 순서 자리에 끼운다.
    for (const [market, label] of [['KOSPI', '코스피'], ['KOSDAQ', '코스닥']] as const) {
      const changeRate = isLatestDailyView ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === market)?.changeRate : undefined
      if (changeRate !== undefined) entries.push({ key: `market-index:${market}`, sectorName: label, value: changeRate, isReference: true })
    }
    const chart = buildRankChart(entries)
    return { items, chart, advancers, decliners, unchanged }
  }, [data, excludedSectorIds, excludedMarketValueTiers, effectiveDepth, marketSummary, isLatestDailyView])
  // 설정창 위쪽 "nn/nn종목" — 그룹 페이지와 같은 기준이다. 분모는 지금 시장의 모든 종목, 분자는 제외한 업종(하위 업종까지)·시가총액 구간을 뺀 종목이다.
  const stockCountLabel = useMemo(() => {
    const nodes = data?.items ?? []
    const total = nodes.reduce((sum, node) => sum + collectItems(node).length, 0)
    const included = filterTreeByExclusions(nodes, excludedSectorIds, excludedMarketValueTiers).reduce(
      (sum, node) => sum + collectAllItems(node).length,
      0,
    )
    return `${toCount(included)}/${toCount(total)}종목`
  }, [data, excludedSectorIds, excludedMarketValueTiers])
  // 세 틀을 한 장으로 캡처하는 중에는 틀마다 있는 캡처 버튼을 감춰서 이미지에 찍히지 않게 한다.
  const isCapturingAll = captureTarget !== null && captureTarget === allFramesRef.current
  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureTarget) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (captureTarget) await captureElementToClipboard(captureTarget)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleDownload = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureTarget) return
    setDownloadStatus('downloading')
    try {
      if (previewSrc) downloadDataUrl(previewSrc, captureFileName('HOME'))
      else if (captureTarget) await captureElementToDownload(captureTarget, captureFileName('HOME'))
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? '다운로드 실패' : '다운로드'
  // 세 틀의 제목 줄 오른쪽 끝에 같은 기준 날짜·시각을 보여 준다 — 데이터를 받은 뒤에만 보인다.
  // 시장 요약 지도와 준비 중 박스 위쪽에 코스피·코스닥 지수 배지를 둔다(그룹 등락률 박스는 지금 보여 주는 업종 분류 단계만 알려 주는 배지).
  const indexLine = <MarketIndexLine indexes={[{ label: '코스피', ...indexOf('KOSPI') }, { label: '코스닥', badgeClass: 'bg-cyan-900', ...indexOf('KOSDAQ') }]} />
  const snapshotClock = data?.snapshotTime ? (
    <span className="ml-auto pr-1 text-[14px] font-medium tabular-nums text-gray-400">
      {toMarketMapSnapshotDateLabel(data.snapshotTime)} {toMarketMapSnapshotTimeOnlyLabel(data.snapshotTime)}
    </span>
  ) : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => {}}
            isRefreshing={false}
            showRefresh={false}
            onToggleSettings={() => setIsSettingsOpen(previous => !previous)}
            isSettingsOpen={isSettingsOpen}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            onOpenShare={() => setCaptureTarget(allFramesRef.current)}
            isCaptureOpen={isCapturingAll}
          />
        }
      />
      {/* 지도/그룹/커스텀 페이지와 같은 본문 틀 — 나중에 내용을 채울 때 이 구조를 그대로 쓴다.
          바깥 박스가 -mt-[10.5px]로 NavSubBar의 짙은 회색 하단에 맞춰 올라가 있으므로, 안쪽 콘솔 줄은
          mt/mb 5.25px로 위치를 맞추고(이 박스 안에 있어야 overflow에 잘리지 않는다), 설정창
          (SettingsSidebar)은 이 박스의 맨 오른쪽 자식으로 넣으면 같은 높이에 붙는다. */}
      <div ref={settingsRowRef} className="relative z-10 -mt-[10.5px] flex min-h-0 flex-1 overflow-hidden bg-black text-white">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* 툴바 — 지도·그룹 페이지와 같은 틀. 왼쪽에 제목 배지, 오른쪽 끝에 분류 배지를 둔다. 로딩 중에도 제자리에 둔다. */}
          <Toolbar>
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <ToolbarModeText page="HOME" label="ALL STOCK" />
            </div>
            <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-gray-400`}>
              <TaxonomyBadge taxonomy={settingsModalProps.taxonomy} />
            </div>
          </Toolbar>
          {/* 스마트폰 화면 크기(가로 360px)의 틀 두 개 — 등락률 지도와 그룹 등락률 그래프를 캡처해서 모바일 사용자에게 보여 주기 좋게 나란히 둔다(시험 배치). */}
          {/* 로딩·오류 원은 지도·그룹 페이지와 같은 높이에 오도록 위 16px·아래 19.5px 여백 안에서 가운데에 둔다(틀이 보일 때는 아래 16px만). */}
          <div className={`flex min-h-0 flex-1 items-center justify-center gap-6 overflow-auto px-2 ${isLoading || isError ? 'pt-4 pb-[19.5px]' : 'pb-4'}`}>
            {/* 불러오는 중이나 오류일 때는 틀을 모두 감추고 지도·그룹·커스텀 페이지처럼 메인 영역 가운데에 원 하나만 둔다. */}
            {isLoading ? (
              <Spinner showElapsed />
            ) : isError ? (
              <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchMarketMap} />
            ) : (
            /* 세 틀을 한 장으로 캡처할 때의 대상 — 틀 사이 간격까지 이 칸에 담긴다. */
            <div ref={allFramesRef} className="flex h-[min(100%,780px)] shrink-0 gap-6 bg-black">
            {[
              {
                title: '시장 요약',
                body: (
                  <div className="flex min-h-0 w-full flex-1 flex-col">
                    {indexLine}
                    <OverviewMap items={overview.items} colorScale={colorScale} />
                  </div>
                ),
              },
              {
                title: '그룹 등락률 (%)',
                body: (
                  <div className="flex min-h-0 w-full flex-1 flex-col">
                    <DepthBadge depth={effectiveDepth} advancers={overview.advancers} decliners={overview.decliners} unchanged={overview.unchanged} />
                    <div className="flex min-h-0 w-full flex-1">
                      <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} />
                    </div>
                  </div>
                ),
              },
              {
                // 거래정지로 지도에서 빠지기 시작한 종목, 신규 상장 종목을 그날 하루만 종류별 칸(신규 상장·거래 정지)에 보여 준다. 없는 종류는 배지 옆에 "없음"을 적는다.
                title: '안내',
                body: (
                  // 두 칸 격자다: [배지 칸(네 배지 중 가장 긴 쪽 너비)] [회색 칸(남는 폭)]. 신규 상장·3개월 내 상장·거래 정지·현재 정지 종목 네 줄을 세로 한 열로 쌓고,
                  // 배지 칸이 네 줄에 공유돼 짧은 배지는 오른쪽만 늘어나 모두 같은 너비가 된다(글자는 왼쪽). 짝이 되는 두 배지(신규 상장·3개월 내 상장, 거래 정지·현재 정지 종목)는 같은 색이라 한눈에 짝이 보인다. 색은 분류 배지(코스피·대분류)의 청록(cyan-700)과 그보다 짙은 청록(cyan-900) 두 가지다 — 빨강·파랑은 오름·내림 뜻이 있어 쓰지 않는다.
                  <div className="grid min-h-0 w-full flex-1 grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1.5fr)] content-start gap-x-1 gap-y-1 overflow-y-auto text-[13px] font-medium leading-none tabular-nums">
                    {NOTICE_TYPES.map(({ type, label, badgeClass, countLabel, countKey, valueKey }) => {
                      const items = (notices?.items ?? []).filter(item => item.type === type)
                      const rowClass = 'flex h-6 items-center'
                      return (
                        <Fragment key={type}>
                          {/* 종류 배지(신규 상장·거래 정지)는 한 칸(8px) 들여 쓴다 — 현황 배지(3개월 내 상장·현재 정지 종목)는 오른쪽에 같은 8px 여백을 둬서 네 배지의 너비가 모두 같고, 종류 배지만 오른쪽으로 8px 밀려 있다. */}
                          <span className={`${rowClass} pl-2`}>
                            <span className={`w-full whitespace-nowrap rounded-sm px-1 py-[3px] text-white ${badgeClass}`}>{label}</span>
                          </span>
                          {/* 그날 안내 종목은 종류 배지 바로 오른쪽 회색 칸에 한 줄로 적는다 — 없으면 "없음", 둘 이상이면 이름을 " · "(공백·가운뎃점·공백)로 이어 쓰고 칸보다 길면 …로 줄인다. */}
                          <span className={`${rowClass} col-span-3`}>
                            <span className="flex h-[22px] min-w-0 flex-1 items-center rounded-sm bg-zinc-800 px-1 text-gray-300">
                              <span className="min-w-0 truncate">{items.length === 0 ? '없음' : items.map(item => item.stockName).join(' · ')}</span>
                            </span>
                          </span>
                          {/* 날짜와 무관한 현황 이름표(신규 상장은 "3개월 내 상장", 거래 정지는 "현재 정지 종목")는 짝이 되는 종류 배지와 같은 색 배지, 오른쪽 회색 칸에 건수를 적는다. 아직 못 받았으면 글자만 비워 둔다. */}
                          <span className={`${rowClass} pr-2`}>
                            <span className={`w-full whitespace-nowrap rounded-sm px-1 py-[3px] text-white ${badgeClass}`}>{countLabel}</span>
                          </span>
                          <span className={rowClass}>
                            <span className="flex h-[22px] min-w-0 flex-1 items-center justify-center rounded-sm bg-zinc-800 px-1 text-gray-300">{notices?.[countKey] ?? ''}</span>
                          </span>
                          {/* 같은 줄 오른쪽에 그 종목들의 현시점 시가총액 합을 "시가총액 합" 배지(같은 줄 배지와 같은 색)와 회색 칸으로 둔다. 표기는 Custom 페이지와 같은 n,nnn.n조/억이다. */}
                          <span className={`${rowClass} whitespace-nowrap`}>
                            <span className={`rounded-sm px-1 py-[3px] text-white ${badgeClass}`}>시가총액 합</span>
                          </span>
                          <span className={rowClass}>
                            <span className="flex h-[22px] min-w-0 flex-1 items-center justify-end rounded-sm bg-zinc-800 px-1 text-gray-300">
                              {notices?.[valueKey] != null ? toJoEokDecimal(notices[valueKey] / 100_000_000) : ''}
                            </span>
                          </span>
                        </Fragment>
                      )
                    })}
                  </div>
                ),
              },
            ].map(frame => (
              <section key={frame.title} className="relative flex h-full w-[360px] shrink-0 flex-col bg-black">
                {/* 캡처 대상은 이 안쪽 칸이다 — 테두리와 안쪽 여백까지 이 칸에 두어 이미지에도 같이 찍힌다(지도·배지가 이미지 가장자리에 붙어 잘려 보이지 않게).
                    오른쪽 위 캡처 버튼은 칸 밖에 두어 이미지에 찍히지 않는다. */}
                <div ref={element => { frameRefs.current[frame.title] = element }} className="flex min-h-0 flex-1 flex-col border border-gray-700 bg-black p-2">
                  {/* 헤더 높이를 28px(캡처 버튼 높이)로 고정해서 버튼이 헤더 높이의 가운데에 오게 한다. 제목은 왼쪽에 붙이고, 강조색 바가 맨 앞에 온다. */}
                  <h2 className="m-0 mb-1 flex h-7 shrink-0 items-center justify-start pl-1 text-base font-bold text-white">
                    <span aria-hidden="true" className="mr-1.5 inline-block h-[1em] w-1 shrink-0 rounded-sm bg-[var(--brand)]" />
                    {frame.title}
                    {frame.title !== '안내' && snapshotClock}
                  </h2>
                  {frame.body}
                </div>
                {/* 캡처 버튼을 제목 바로 오른쪽에 둔다 — 제목과 같은 글자를 보이지 않게 깔아 그 끝에 버튼이 오게 하므로 제목 길이를 재지 않아도 된다.
                    칸 밖에 있어서 캡처 이미지에는 찍히지 않는다. 안내 틀은 캡처하지 않으므로 버튼이 없다. */}
                {frame.title !== '안내' && (
                  <div className={`pointer-events-none absolute left-[9px] top-[9px] flex h-7 items-center pl-1 text-base font-bold ${isCapturingAll ? 'invisible' : ''}`}>
                    <span aria-hidden="true" className="invisible mr-1.5 inline-block w-1 shrink-0" />
                    <span aria-hidden="true" className="invisible">{frame.title}</span>
                    <button
                      type="button"
                      aria-label={`${frame.title} 캡처`}
                      onClick={() => setCaptureTarget(frameRefs.current[frame.title] ?? null)}
                      className="pointer-events-auto ml-1 flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-400 outline-none hover:text-[var(--brand)] focus-visible:text-[var(--brand)]"
                    >
                      <CaptureIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </section>
            ))}
            </div>
            )}
          </div>
          {/* 아래 줄 — 지도·그룹 페이지와 같은 높이(28px)로 왼쪽에 면책조항, 오른쪽 끝에 등락률 색상 범례를 둔다. 로딩 중에도 제자리에 둔다. */}
          <div className="flex h-7 shrink-0 items-end justify-between gap-3 px-[7px]">
            <div className="flex h-7 min-w-0 items-end">
              <DisclaimerNotice />
            </div>
            <ChangeRateBar swatches={settingsModalProps.legendSwatches} />
          </div>
        </div>
        {/* 설정창 틀만 먼저 둔다 — 항목은 홈 화면 내용이 정해지면 채운다. */}
        <div className={`flex shrink-0 pt-[7px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
          <SettingsSidebar
            pageLabel="Home"
            {...settingsModalProps}
            isOpen={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
            isOnLeft={isSettingsOnLeft}
            onToggleSide={toggleSettingsSide}
            plainContent={<SettingsGroupDepthSection depth={1} onChange={() => {}} selectableDepth={1} lockedMessage={<>홈은 대분류로<br />고정되어 있습니다.</>} />}
            stockCountLabel={stockCountLabel}
            taxonomyAtBottom
            snapshotTime={data?.taxonomyUpdatedAt}
          />
        </div>
      </div>
      {captureTarget && (
        <MarketMapShareModal
          onClose={() => setCaptureTarget(null)}
          onCopy={handleCopy}
          onDownload={handleDownload}
          copyLabel={copyLabel}
          downloadLabel={downloadLabel}
          isCopying={copyStatus === 'copying'}
          isDownloading={downloadStatus === 'downloading'}
          captureTarget={captureTarget}
        />
      )}
    </div>
  )
}
