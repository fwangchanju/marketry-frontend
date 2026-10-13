import { useMemo, useRef, useState } from 'react'
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
import { usePageSetting } from '@/hooks/usePageSetting'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsSidebarSide } from '@/hooks/useSettingsSidebarSide'
import { captureElementToClipboard, copyDataUrlToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload, captureFileName, downloadDataUrl } from '@/utils/captureToDownload'
import { toMarketMapSnapshotDateLabel, toMarketMapSnapshotTimeOnlyLabel } from '@/utils/format'
import { buildRankChart } from '@/utils/rankChart'
import { computeSectorAverage } from '@/utils/sectorAverage'
import { collectAtDepth } from '@/utils/sectorDepth'

// 홈 화면 시험 배치 — 대분류 업종만으로 그린 약식 등락률 지도와 그룹 등락률 그래프를 스마트폰 크기 틀(가로 360px)에 나란히 둔다.
// 모바일 사용자에게 캡처해서 보여 주기 좋은지 보고 계속 진행할지 정한다. 관심종목·요약 API는 쓰지 않는다.
type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketSummaryPage() {
  // 시장 요약 틀의 캡처 버튼(또는 상단 영역 캡처 버튼)으로 지도·그룹 막대를 한 장으로 캡처하며, 공유창은 지도·그룹 페이지와 같은 것을 쓴다.
  // 시험용 — 지도와 그래프를 대분류가 아니라 중분류·소분류로도 그려 본다(1=대분류, 2=중분류, 3=소분류). 하위 단계가 없는 분류(거래소)는 대분류만 된다.
  const [homeDepth, setHomeDepth] = usePageSetting<number>('homePage.depth', 1)
  // 합친 시장 요약 틀(지도 + 그룹 막대) — 캡처 대상이다. 안내 틀은 캡처하지 않는다.
  const summaryFrameRef = useRef<HTMLDivElement>(null)
  const [captureTarget, setCaptureTarget] = useState<HTMLElement | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { settingsModalProps, data, isLoading, isError, refetchMarketMap, pinnedSnapshotTime, rangeStartTime, changeRateMode, colorScale, strongIndustryColor, excludedSectorIds, excludedMarketValueTiers } = useGlobalSettings()
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsSidebarSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()

  // 지도 위 한 줄에 넣을 코스피·코스닥 지수 등락률 — 지도 조회(ALL STOCK)에는 지수가 없어 요약 조회에서 받는다.
  const { data: marketSummary } = useMarketSummary()
  // 요약 조회의 지수는 항상 최근 값이다 — 지도가 지난 시각이나 기간을 보고 있거나 시간외 별도 등락률이면 맞지 않으므로 보여 주지 않는다(그룹 페이지도 일간 등락률일 때만 넣는다).
  const isLatestDailyView = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily'
  const indexOf = (market: 'KOSPI' | 'KOSDAQ') => {
    const item = isLatestDailyView ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === market) : undefined
    return { indexValue: item?.indexValue ?? null, changeRate: item?.changeRate ?? null }
  }

  const selectableDepth = settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT' ? 1 : 3
  const effectiveDepth = Math.min(homeDepth, selectableDepth)
  // 고른 단계의 업종만 모아 지도 박스와 그래프 막대로 쓴다 — 지도 페이지와 같은 제외 기준을 따른다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    for (const { node, pathKey } of collectAtDepth(data?.items ?? [], effectiveDepth, excludedSectorIds, excludedMarketValueTiers)) {
      const average = computeSectorAverage(node, excludedMarketValueTiers)
      if (average.weightedAvg === null) continue
      items.push({ key: pathKey, name: node.sectorName, marketValue: node.totalMarketValue, changeRate: average.weightedAvg })
    }
    const entries = items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate, isReference: false }))
    // 그룹 페이지처럼 코스피·코스닥 지수 등락률을 강조 색 참조 막대로 값 순서 자리에 끼운다.
    for (const [market, label] of [['KOSPI', '코스피'], ['KOSDAQ', '코스닥']] as const) {
      const changeRate = isLatestDailyView ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === market)?.changeRate : undefined
      if (changeRate !== undefined) entries.push({ key: `market-index:${market}`, sectorName: label, value: changeRate, isReference: true })
    }
    const chart = buildRankChart(entries)
    return { items, chart }
  }, [data, excludedSectorIds, excludedMarketValueTiers, effectiveDepth, marketSummary, isLatestDailyView])
  // 세 틀을 한 장으로 캡처하는 중에는 틀마다 있는 캡처 버튼을 감춰서 이미지에 찍히지 않게 한다.
  const isCapturingSummary = captureTarget !== null && captureTarget === summaryFrameRef.current
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
  const indexLine = <MarketIndexLine indexes={[{ label: '코스피', ...indexOf('KOSPI') }, { label: '코스닥', ...indexOf('KOSDAQ') }]} />
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
            onOpenShare={() => setCaptureTarget(summaryFrameRef.current)}
            isCaptureOpen={isCapturingSummary}
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
          {/* 틀 두 개 — 지도와 그룹 등락률 막대를 한 틀(시장 요약)에 합쳐 한 장으로 캡처하고, 오른쪽에 안내 틀을 둔다. */}
          {/* 로딩·오류 원은 지도·그룹 페이지와 같은 높이에 오도록 위 16px·아래 19.5px 여백 안에서 가운데에 둔다(틀이 보일 때는 아래 16px만). */}
          <div className={`flex min-h-0 flex-1 items-center justify-center gap-6 overflow-auto px-2 ${isLoading || isError ? 'pt-4 pb-[19.5px]' : 'pb-4'}`}>
            {/* 불러오는 중이나 오류일 때는 틀을 모두 감추고 지도·그룹·커스텀 페이지처럼 메인 영역 가운데에 원 하나만 둔다. */}
            {isLoading ? (
              <Spinner showElapsed />
            ) : isError ? (
              <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchMarketMap} />
            ) : (
            <div className="flex h-[min(100%,780px)] shrink-0 gap-6 bg-black">
              {/* 시장 요약 틀 — 지도와 그룹 등락률 막대를 한 틀에 담아 한 장으로 캡처한다.
                  캡처 대상은 안쪽 칸이다(테두리와 안쪽 여백까지 찍혀 지도·배지가 이미지 가장자리에 붙어 잘려 보이지 않는다).
                  제목 옆 캡처 버튼은 칸 밖에 두어 이미지에 찍히지 않는다. */}
              <section className="relative flex h-full w-[728px] shrink-0 flex-col bg-black">
                <div ref={summaryFrameRef} className="flex min-h-0 flex-1 flex-col border border-gray-700 bg-black p-2">
                  {/* 헤더 높이를 28px(캡처 버튼 높이)로 고정해서 버튼이 헤더 높이의 가운데에 오게 한다. 제목은 왼쪽에 붙이고, 강조색 바가 맨 앞에 온다. */}
                  <h2 className="m-0 mb-1 flex h-7 shrink-0 items-center justify-start pl-1 text-base font-bold text-white">
                    <span aria-hidden="true" className="mr-1.5 inline-block h-[1em] w-1 shrink-0 rounded-sm bg-[var(--brand)]" />
                    시장 요약
                    {snapshotClock}
                  </h2>
                  <div className="flex min-h-0 flex-1 gap-4">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <p className="m-0 mb-1 shrink-0 pl-1 text-[13px] font-semibold text-gray-400">시장 요약 지도</p>
                      {indexLine}
                      <OverviewMap items={overview.items} colorScale={colorScale} />
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                      <p className="m-0 mb-1 shrink-0 pl-1 text-[13px] font-semibold text-gray-400">그룹 등락률 (%)</p>
                      <DepthBadge depth={effectiveDepth} />
                      <div className="flex min-h-0 w-full flex-1">
                        <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} />
                      </div>
                    </div>
                  </div>
                </div>
                {/* 캡처 버튼을 제목 바로 오른쪽에 둔다 — 제목과 같은 글자를 보이지 않게 깔아 그 끝에 버튼이 오게 하므로 제목 길이를 재지 않아도 된다. */}
                <div className={`pointer-events-none absolute left-[9px] top-[9px] flex h-7 items-center pl-1 text-base font-bold ${isCapturingSummary ? 'invisible' : ''}`}>
                  <span aria-hidden="true" className="invisible mr-1.5 inline-block w-1 shrink-0" />
                  <span aria-hidden="true" className="invisible">시장 요약</span>
                  <button
                    type="button"
                    aria-label="시장 요약 캡처"
                    onClick={() => setCaptureTarget(summaryFrameRef.current)}
                    className="pointer-events-auto ml-1 flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-400 outline-none hover:text-[var(--brand)] focus-visible:text-[var(--brand)]"
                  >
                    <CaptureIcon className="h-4 w-4" />
                  </button>
                </div>
              </section>
              {/* 안내 틀 — 거래정지·신규 상장 같은 특수한 종목이 생기면 안내를 띄울 자리다. 내용은 아직 없다. */}
              <section className="relative flex h-full w-[360px] shrink-0 flex-col bg-black">
                <div className="flex min-h-0 flex-1 flex-col border border-gray-700 bg-black p-2">
                  <h2 className="m-0 mb-1 flex h-7 shrink-0 items-center justify-start pl-1 text-base font-bold text-white">
                    <span aria-hidden="true" className="mr-1.5 inline-block h-[1em] w-1 shrink-0 rounded-sm bg-[var(--brand)]" />
                    안내
                  </h2>
                </div>
              </section>
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
            plainContent={<SettingsGroupDepthSection depth={homeDepth} onChange={setHomeDepth} selectableDepth={selectableDepth} />}
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
