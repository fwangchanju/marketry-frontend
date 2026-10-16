import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { EmptyMessageAreaContext } from '@/utils/emptyMessageArea'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import AdminSectorTable from '@/components/AdminSectorTable'
import AdminStockTable from '@/components/AdminStockTable'
import Spinner from '@/components/Spinner'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel from '@/components/SettingsPanel'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import ToolbarModeText from '@/components/ToolbarModeText'
import ReadOnlyTaxonomySheet from '@/components/ReadOnlyTaxonomySheet'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useTaxonomySelection, type TaxonomySelection } from '@/hooks/useTaxonomySelection'
import { useCustomSectors, useStockSectors } from '@/hooks/useTreemapCustom'
import { useTreemap, useStockCatalog } from '@/hooks/useTreemap'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession, useIsLoggedIn } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { screenshotElementToClipboard, copyDataUrlToClipboard } from '@/utils/screenshotToClipboard'
import { screenshotElementToDownload, downloadDataUrl, screenshotFileName } from '@/utils/screenshotToDownload'
import TaxonomyBadge from '@/components/TaxonomyBadge'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

// 커스텀 섹터·종목 배정 관리 화면 — 예전 관리자 페이지를 대체한다. 이제는 admin 역할이 아니라 로그인 여부로
// 접근을 가른다(가입/로그인 전환 지시서 4) — 누구든
// 로그인하면 자신의 커스텀 섹터를 관리할 수 있다. 비로그인으로 직접 URL 진입/새로고침해도 로그인
// 팝업을 띄우고, 성공하면 이 경로로 돌아온다.
export default function CustomPage() {
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  // /custom/sector는 업종 화면이고, /custom/stock은 종목 화면이다.
  const mode = pathname === '/custom/stock' || searchParams.get('mode') === 'stock' ? 'stock' : 'sector'
  // 분류 시트 — 내 분류(mine)만 편집할 수 있다. ?sheet=krx는 읽기 전용 KRX 시트, ?sheet=marketry는 올린
  // MARKETRY를 읽기 전용으로 보여준다(MARKETRY는 내 분류에서 올려서 바꾼다).
  // 예전 주소(?sheet=nxt)는 KRX 시트에서 "NXT 종목만 보기"를 켠 상태로 연다.
  const { isLoading: isSessionLoading } = useSession()
  const isLoggedIn = useIsLoggedIn()
  const { requireLogin } = useLoginGate()
  // 로그인 여부가 확정된 비로그인 — 세션을 확인하는 동안은 아직 모르므로 내 분류 선택을 그대로 둔다.
  const isGuestKnown = !isSessionLoading && !isLoggedIn
  // 주소의 sheet 값은 대소문자를 가리지 않는다(예전 소문자 주소도 열린다).
  const sheetParam = searchParams.get('sheet')?.toUpperCase() ?? null
  const [selectedTaxonomy, setSelectedTaxonomy] = useTaxonomySelection()
  const explicitSheet =
    sheetParam === 'KRX' || sheetParam === 'NXT' ? 'KRX' : sheetParam === 'MARKETRY' || sheetParam === 'MINE' ? sheetParam : sheetParam === 'MYMAP' ? 'MINE' : null
  const chosenSheet = explicitSheet ?? selectedTaxonomy
  // 내 분류는 로그인이 필요하다 — 비로그인에게는 MARKETRY로 보이고, 브라우저에 저장한 선택 자체는 보존한다(지도·그룹 페이지와 같다).
  const sheet = isGuestKnown && chosenSheet === 'MINE' ? 'MARKETRY' : chosenSheet
  const isReadOnlySheet = sheet !== 'MINE'
  const [sectorSettingsActionsTarget, setSectorSettingsActionsTarget] = useState<HTMLDivElement | null>(null)
  // 종목 화면의 실행취소·다시실행 아이콘이 들어갈 설정창 안의 자리.
  const [stockHistoryTarget, setStockHistoryTarget] = useState<HTMLDivElement | null>(null)
  const [stockExcelTarget, setStockExcelTarget] = useState<HTMLDivElement | null>(null)
  const [stockBulkTarget, setStockBulkTarget] = useState<HTMLDivElement | null>(null)
  // 비로그인이 내 분류를 누르면 로그인 안내만 띄우고, 보던 분류에 그대로 머문다.
  const handleSelectSheet = (next: TaxonomySelection) => {
    if (next === 'MINE' && isGuestKnown) {
      requireLogin(pathname)
      return
    }
    setSelectedTaxonomy(next)
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      params.delete('sheet')
      return params
    })
  }
  // KRX 시트에서 NXT 거래 종목만 남기는 보기 옵션 — 새로고침해도 유지된다.
  const [isNxtOnlyView, setIsNxtOnlyView] = usePersistedState('customPage.krxNxtOnly', false)
  const nxtOnly = sheet === 'KRX' && (isNxtOnlyView || sheetParam === 'NXT')
  // 기존 시트 링크는 처음부터 적용하고 브라우저 공통 선택으로 옮겨 URL이 이후 선택을 덮지 않게 한다.
  useEffect(() => {
    if (!explicitSheet) return
    // 내 분류 주소는 로그인 여부가 확정된 뒤에 처리한다 — 비로그인이면 선택을 옮기지 않고 팝업만 띄운다.
    if (explicitSheet === 'MINE' && isSessionLoading) return
    if (explicitSheet === 'MINE' && isGuestKnown) requireLogin(pathname)
    else setSelectedTaxonomy(explicitSheet)
    if (sheetParam === 'NXT') setIsNxtOnlyView(true)
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      params.delete('sheet')
      return params
    }, { replace: true })
  }, [explicitSheet, sheetParam, isSessionLoading, isGuestKnown, pathname, requireLogin, setSelectedTaxonomy, setIsNxtOnlyView, setSearchParams])
  // AdminStockTable의 툴바(종목수/실행취소·다시실행/필터/엑셀 등)를 이 DOM 노드로 포털링해서 세
  // 번째 바 안에 그린다 — useRef 대신 useState인 이유는, ref 콜백이 커밋 단계에서 실행되므로
  // useState로 받아야 그 노드가 준비된 뒤 리렌더가 한 번 더 일어나 AdminStockTable에 null이 아닌
  // 실제 노드가 확실히 전달된다.
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null)
  // 표 위 검색창 옆에 두던 "27/27업종" 개수 — 표가 올려 보내면 설정창 머리글 오른쪽에 보여준다.
  const [countLabel, setCountLabel] = useState<string | undefined>()


  const {
    data: sectors,
    isLoading: isSectorsLoading,
    isError: isSectorsError,
    refetch: refetchSectors,
    isRefetching: isRefetchingSectors,
  } = useCustomSectors({ enabled: isLoggedIn })
  const {
    data: stockSectors,
    isLoading: isStockSectorsLoading,
    isError: isStockSectorsError,
    refetch: refetchStockSectors,
    isRefetching: isRefetchingStockSectors,
  } = useStockSectors({ enabled: isLoggedIn })

  // 선택한 분류에 맞는 최종 갱신 시각을 가져오며 거래소 시트에서는 본문 데이터도 함께 쓴다.
  // 비로그인에게는 시트가 마켓트리·거래소뿐이라 지도 조회는 항상 열려 있다. 내 분류는 로그인과 세션 확인을 마친 뒤에만 받는다.
  const canReadSheet = isLoggedIn || sheet !== 'MINE'
  const {
    data: taxonomyMap,
    isLoading: isTaxonomyLoading,
    isError: isTaxonomyError,
    refetch: refetchTaxonomy,
    isRefetching: isRefetchingTaxonomy,
  } = useTreemap('ALL_STOCK', sheet, false, { enabled: canReadSheet })

  // 읽기 전용 시트의 NXT 여부·시장·거래소 분류명은 회원 데이터가 아니라 공통 종목 정보에서 받는다.
  // 종목 표의 NXT 열은 세 시트(MARKETRY·거래소·내 분류)가 모두 쓰므로, 종목 화면에서는 시트와 상관없이 불러온다.
  const {
    data: stockCatalog,
    isLoading: isStockCatalogLoading,
    isError: isStockCatalogError,
    refetch: refetchStockCatalog,
  } = useStockCatalog({ enabled: isReadOnlySheet || mode === 'stock' })
  const nxtStockCodes = useMemo(
    () => new Set((stockCatalog ?? []).filter(item => item.nxtEnabled).map(item => item.stockCode)),
    [stockCatalog],
  )
  const stockMarkets = useMemo(
    () => new Map((stockCatalog ?? []).map(item => [item.stockCode, item.market])),
    [stockCatalog],
  )
  const stockIndustries = useMemo(
    () => new Map((stockCatalog ?? []).map(item => [item.stockCode, item.industryName])),
    [stockCatalog],
  )

  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsPanelSide()
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const screenshotRef = useRef<HTMLDivElement>(null)
  // 안내 문구를 본문 영역 전체의 한가운데에 그리기 위한 기준 요소(EmptyMessageAreaContext).
  const [emptyMessageArea, setEmptyMessageArea] = useState<HTMLDivElement | null>(null)

  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !screenshotRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (screenshotRef.current) await screenshotElementToClipboard(screenshotRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleDownload = async (previewSrc?: string | null) => {
    if (!previewSrc && !screenshotRef.current) return
    setDownloadStatus('downloading')
    try {
      if (previewSrc) downloadDataUrl(previewSrc, screenshotFileName('CUSTOM'))
      else if (screenshotRef.current) await screenshotElementToDownload(screenshotRef.current, screenshotFileName('CUSTOM'))
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? '다운로드 실패' : '다운로드'

  const actions = (
    <NavBarPageActions
      onRefresh={() => {
        void refetchTaxonomy()
        if (isReadOnlySheet) return
        void refetchSectors()
        if (mode === 'stock') void refetchStockSectors()
      }}
      isRefreshing={
        isRefetchingTaxonomy || (!isReadOnlySheet && (
          isRefetchingSectors || (mode === 'stock' && isRefetchingStockSectors)
        ))
      }
      onOpenShare={() => setIsShareOpen(true)}
      isScreenshotOpen={isShareOpen}
      onToggleSettings={() => setIsSettingsOpen(previous => !previous)}
      isSettingsOpen={isSettingsOpen}
      isNativeFullscreen={isNativeFullscreen}
      onToggleFullscreen={handleToggleNativeFullscreen}
      showRefresh={false}
    />
  )

  // 세션 확인 중이거나(로그인 여부를 아직 모름) 로그인 사용자의 섹터 목록을 받아오는 동안은 본문 자리에 로딩 원만 보여준다 —
  // 비로그인용 안내와 실제 표가 뒤섞여 잠깐 보였다 사라지는 걸 막는다. 위쪽 바·툴바·설정창은 그대로 두어서(다른 페이지처럼)
  // 로딩이 길어져도 설정창이 사라졌다가 다시 생기지 않는다.
  const isPageLoading = isSessionLoading || (isLoggedIn && isSectorsLoading)

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
      <NavBar />
      <NavSubBar actions={actions} />
      {/* 좌측 사이드바(종목/섹터 전환 + 버전관리 저장) 삭제 — 종목/섹터 전환은 NavSubBar의
          "커스텀" 탭 hover 목록으로 이동. 버전관리 저장(AdminVersionSaveSection)은 기능 검증과
          위치 재검토가 더 필요해서 일단 뺐다 — 다시 넣을 땐 이 컴포넌트를 재사용하면 된다. */}
      <div className="flex min-h-0 flex-1">
        {/* 공유 스크린샷(screenshotRef)는 [세 번째 바+본문] 열만 찍는다 — 설정 사이드바는 스크린샷에 넣지 않는다. */}
        <div ref={settingsRowRef} className="relative z-10 -mt-[10.5px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-black text-white">
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서 창을 좁혀도 사이드바(w-80)가 항상 같은
              폭을 유지하게 한다(지도/섹터/요약 페이지와 동일). */}
          <div
            ref={node => {
              screenshotRef.current = node
              setEmptyMessageArea(node)
            }}
            data-main-area
            className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-black text-white"
          >
            <div className="mt-[5.25px] mb-[5.25px] flex h-7 w-full shrink-0 items-center justify-between bg-black/70 pl-[7px] pr-[7px] text-sm font-bold text-white">
              <div className="flex h-full shrink-0 items-center gap-2">
                <ToolbarModeText page="CUSTOM" label={mode === 'stock' ? 'STOCK' : 'SECTOR'} />
              </div>
              {/* 검색창(과 필터 초기화) — 종목·업종 표가 모두 이 노드로 포털링해서 그린다. */}
              <div ref={setToolbarContainer} className="ml-1 flex h-full min-h-0 min-w-0 flex-1 items-center" />
              <div className={`${FONT_BAR_MODE_STATUS} ml-2 flex min-w-0 items-center justify-end text-gray-400`}>
                <TaxonomyBadge taxonomy={sheet} />
              </div>
            </div>
            <EmptyMessageAreaContext.Provider value={emptyMessageArea}>
            {/* 좌우 7px — 지도 페이지처럼 화면 왼쪽 끝·설정창과 본문 사이를 띄운다(위 바의 STOCK 드롭다운 시작점, 분류 배지와 설정창 사이 간격과 같다). */}
            <div className="flex min-h-0 flex-1 px-[7px]">
              <div
                className={`flex min-h-0 min-w-0 flex-1 flex-col ${mode === 'sector' ? 'overflow-y-auto' : ''}`}
              >
                {isPageLoading ? (
                  // 지도·그룹 페이지의 로딩 원과 같은 높이에 오도록 위 16px, 아래 47.5px(19.5px + 이 페이지에 없는 아래 줄 28px) 여백 안에서 가운데에 둔다.
                  <div className="flex min-h-0 flex-1 items-center justify-center pt-4 pb-[47.5px]">
                    <Spinner showElapsed />
                  </div>
                ) : !isReadOnlySheet && isSectorsError ? (
                  // 내 분류의 분류(업종) 목록을 받지 못하면 표를 그리지 않고 오류 원을 보여 준다 — 비어 있다고 오해하거나 분류 선택지 없이 반쪽 표에서 고치지 않게 한다.
                  <div className="flex min-h-0 flex-1 items-center justify-center pt-4 pb-[47.5px]">
                    <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => void refetchSectors()} />
                  </div>
                ) : isReadOnlySheet ? (
                  <ReadOnlyTaxonomySheet
                    mode={mode === 'stock' ? 'stock' : 'category'}
                    data={taxonomyMap}
                    isLoading={isTaxonomyLoading}
                    isError={isTaxonomyError || (mode === 'stock' && isStockCatalogError)}
                    onRetry={() => { void refetchTaxonomy(); if (mode === 'stock') void refetchStockCatalog() }}
                    source={sheet === 'MARKETRY' ? 'MARKETRY' : 'KRX'}
                    nxtOnly={nxtOnly}
                    onNxtOnlyChange={setIsNxtOnlyView}
                    nxtStockCodes={nxtStockCodes}
                    stockMarkets={stockMarkets}
                    stockIndustries={stockIndustries}
                    isNxtLoading={isStockCatalogLoading}
                    toolbarContainer={toolbarContainer}
                    onCountLabelChange={setCountLabel}
                  />
                ) : mode === 'stock' ? (
                  <AdminStockTable
                    items={stockSectors?.items ?? []}
                    sectors={sectors ?? []}
                    snapshotTime={stockSectors?.snapshotTime ?? null}
                    toolbarContainer={toolbarContainer}
                    historyContainer={stockHistoryTarget}
                    excelContainer={stockExcelTarget}
                    bulkContainer={stockBulkTarget}
                    onCountLabelChange={setCountLabel}
                    nxtStockCodes={nxtStockCodes}
                    isLoading={isStockSectorsLoading}
                    isError={isStockSectorsError}
                    onRetry={() => void refetchStockSectors()}
                  />
                ) : (
                  <AdminSectorTable
                    sectors={sectors ?? []}
                    settingsActionsTarget={sectorSettingsActionsTarget}
                    toolbarContainer={toolbarContainer}
                    onCountLabelChange={setCountLabel}
                  />
                )}
              </div>
            </div>
            </EmptyMessageAreaContext.Provider>
          </div>
          <div className={`flex shrink-0 pt-[7px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
            <SettingsPanel
              pageLabel="Custom"
              stockCountLabel={countLabel}
              // 저장·초기화는 기능 검토 전 임시 숨김. 재요청 시 새 버튼을 만들지 말고 이 옵션을 true로 바꿔 기존 버튼을 복원한다.
              showPreferenceActions={false}
              isOpen={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
              isOnLeft={isSettingsOnLeft}
              onToggleSide={toggleSettingsSide}
              onRequestLogin={() => requireLogin(pathname)}
              plainContent={!isReadOnlySheet ? (
                <>
                  {/* 종목 화면은 위에서부터 간편 업종 분류 → 변경 내역 → 일괄 변경 순서다(관리자 기능은 Admin 페이지로 옮겼다). */}
                  {mode === 'stock' && <div ref={setStockExcelTarget} className="h-[127px]" />}
                  <div ref={mode === 'sector' ? setSectorSettingsActionsTarget : setStockHistoryTarget} className={mode === 'stock' ? 'h-[127px]' : undefined} />
                  {mode === 'stock' && <div ref={setStockBulkTarget} />}
                </>
              ) : (
                // 마켓트리·거래소 화면은 읽기 전용이라 설정할 항목이 없다 — 그 사실만 알린다.
                <div className="text-sm">
                  <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-white">읽기 전용(쓰기 불가)</h2>
                </div>
              )}
              taxonomyAtBottom
              snapshotTime={taxonomyMap?.taxonomyUpdatedAt}
              taxonomy={sheet}
              onSelectTaxonomy={next => handleSelectSheet(next === 'KRX' || next === 'NXT' ? 'KRX' : next)}
            />
          </div>
        </div>
      </div>

      {isShareOpen && (
        <ScreenshotModal
          onClose={() => setIsShareOpen(false)}
          onCopy={handleCopy}
          onDownload={handleDownload}
          copyLabel={copyLabel}
          downloadLabel={downloadLabel}
          isCopying={copyStatus === 'copying'}
          isDownloading={downloadStatus === 'downloading'}
          screenshotTarget={screenshotRef.current}
        />
      )}
    </div>
  )
}
