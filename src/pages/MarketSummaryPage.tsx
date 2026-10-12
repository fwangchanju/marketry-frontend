import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import { CaptureIcon } from '@/components/icons/MarketMapIcons'
import SettingsSidebar, { SettingsGroupDepthSection } from '@/components/SettingsSidebar'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import Spinner from '@/components/Spinner'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePageSetting } from '@/hooks/usePageSetting'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsSidebarSide } from '@/hooks/useSettingsSidebarSide'
import { captureElementToClipboard, copyDataUrlToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload, captureFileName, downloadDataUrl } from '@/utils/captureToDownload'
import { marketRoute } from '@/utils/marketRoute'
import { buildRankChart } from '@/utils/rankChart'
import { computeSectorAverage } from '@/utils/sectorAverage'
import { collectAtDepth } from '@/utils/sectorDepth'

// 홈 화면 시험 배치 — 대분류 업종만으로 그린 약식 등락률 지도와 그룹 등락률 그래프를 스마트폰 크기 틀(가로 360px)에 나란히 둔다.
// 모바일 사용자에게 캡처해서 보여 주기 좋은지 보고 계속 진행할지 정한다. 관심종목·요약 API는 쓰지 않는다.
type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MarketSummaryPage() {
  const navigate = useNavigate()
  // 틀마다 캡처 버튼이 있다 — 누른 틀 하나만(버튼은 빼고) 캡처하며, 공유창은 지도·그룹 페이지와 같은 것을 쓴다.
  // 시험용 — 지도와 그래프를 대분류가 아니라 중분류·소분류로도 그려 본다(1=대분류, 2=중분류, 3=소분류). 하위 단계가 없는 분류(거래소)는 대분류만 된다.
  const [homeDepth, setHomeDepth] = usePageSetting<number>('homePage.depth', 1)
  const allFramesRef = useRef<HTMLDivElement>(null)
  const frameRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [captureTarget, setCaptureTarget] = useState<HTMLElement | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { settingsModalProps, data, market, isLoading, isError, refetchMarketMap, colorScale, strongIndustryColor, excludedSectorIds, excludedMarketValueTiers } = useGlobalSettings()
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsSidebarSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()

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
    const chart = buildRankChart(items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate })))
    return { items, chart }
  }, [data, excludedSectorIds, excludedMarketValueTiers, effectiveDepth])
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
  const openSector = (sectorName: string) => navigate(`${marketRoute('/map', market)}?sector=${encodeURIComponent(sectorName)}`)

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
          <div className="relative mt-[5.25px] mb-[5.25px] flex h-7 w-full shrink-0 items-center justify-between bg-black/70 pl-[7px] pr-3 text-sm font-bold text-white">
            {/* 콘솔 줄: 드롭다운 → 스냅샷 날짜/시간 순으로 왼쪽에 배치 */}
          </div>
          {/* 스마트폰 화면 크기(가로 360px)의 틀 두 개 — 등락률 지도와 그룹 등락률 그래프를 캡처해서 모바일 사용자에게 보여 주기 좋게 나란히 둔다(시험 배치). */}
          <div className="flex min-h-0 flex-1 items-center justify-center gap-6 overflow-auto px-2 pb-4">
            {/* 세 틀을 한 장으로 캡처할 때의 대상 — 틀 사이 간격까지 이 칸에 담긴다. */}
            <div ref={allFramesRef} className="flex h-[min(100%,780px)] shrink-0 gap-6 bg-black">
            {[
              { title: '시장 요약 지도', body: <OverviewMap items={overview.items} colorScale={colorScale} onSelect={openSector} /> },
              {
                title: '그룹 등락률 (%)',
                body: (
                  <div className="flex min-h-0 w-full flex-1">
                    <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} onSelectSector={openSector} />
                  </div>
                ),
              },
              { title: '준비 중', body: <div className="flex flex-1 items-center justify-center text-sm text-gray-500">내용 미정</div> },
            ].map(frame => (
              <section key={frame.title} className="relative flex h-full w-[360px] shrink-0 flex-col border border-gray-700 bg-black p-2">
                {/* 캡처 대상은 이 안쪽 칸이다 — 오른쪽 위 캡처 버튼은 칸 밖에 두어 이미지에 찍히지 않는다. */}
                <div ref={element => { frameRefs.current[frame.title] = element }} className="flex min-h-0 flex-1 flex-col bg-black">
                  {/* 헤더 높이를 28px(캡처 버튼 높이)로 고정해서 버튼이 헤더 높이의 가운데에 오게 한다. 제목은 왼쪽에 붙이고, 강조색 바가 맨 앞에 온다. */}
                  <h2 className="m-0 mb-1 flex h-7 shrink-0 items-center justify-start pl-1 text-base font-bold text-white">
                    <span aria-hidden="true" className="mr-1.5 inline-block h-[1em] w-1 shrink-0 rounded-sm bg-[var(--brand)]" />
                    {frame.title}
                  </h2>
                  {isLoading ? (
                    <div className="flex flex-1 items-center justify-center">
                      <Spinner showElapsed />
                    </div>
                  ) : isError ? (
                    <div className="flex flex-1 items-center justify-center">
                      <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchMarketMap} />
                    </div>
                  ) : frame.body}
                </div>
                <button
                  type="button"
                  aria-label={`${frame.title} 캡처`}
                  onClick={() => setCaptureTarget(frameRefs.current[frame.title] ?? null)}
                  className={`absolute right-2 top-2 ${isCapturingAll ? 'invisible' : ''} flex h-7 w-7 items-center justify-center border-0 bg-transparent text-gray-400 outline-none hover:text-[var(--brand)] focus-visible:text-[var(--brand)]`}
                >
                  <CaptureIcon className="h-4 w-4" />
                </button>
              </section>
            ))}
            </div>
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
