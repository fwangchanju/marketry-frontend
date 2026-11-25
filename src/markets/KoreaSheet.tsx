import { KoreaMineStock, KoreaReadOnlyStock } from '@/markets/KoreaStock'
import { useEffect, useMemo, useRef } from 'react'
import { customMenu } from '@/utils/marketMenu'
import { useLocation, useSearchParams } from 'react-router-dom'
import { mineSheetReturnPath } from '@/utils/mineSheetReturn'
import SectorTable from '@/components/SectorTable'
import MarketryPublishControls from '@/components/MarketryPublishControls'
import { MARKET_LABEL } from '@/utils/marketOptions'
import ReadOnlyTaxonomySheet from '@/components/ReadOnlyTaxonomySheet'
import { useTaxonomySelection, type TaxonomySelection } from '@/hooks/useTaxonomySelection'
import { useCustomSectors, useStockSectors } from '@/hooks/useHeatmapCustom'
import { useHeatmap, useStockCatalog } from '@/hooks/useHeatmap'
import { useSession, useIsLoggedIn } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { appAlert } from '@/utils/appDialogBus'
import { isAdminSession } from '@/utils/adminAccess'
import { STOCK_KOREA } from '@/utils/customRoutes'
import { isProtectedSectorName } from '@/utils/protectedSector'
import { buildSectorStats } from '@/utils/sectorOrder'

import SheetScreen from '@/components/SheetScreen'
import { useCreateSector, useRenameSector, useReparentSector } from '@/hooks/useHeatmapCustom'
import { useSectorDeleteFlow } from '@/hooks/useSectorDeleteFlow'
import { SECTOR_KOREA } from '@/utils/customRoutes'
import { getProtectedSectorHint } from '@/utils/protectedSector'

// 한국 SECTOR·STOCK의 데이터와 편집 동작을 공통 화면에 넘긴다. 누구든 로그인하면 자신의 분류를 고칠 수 있고,
// 비로그인도 MARKETRY·거래소 분류는 읽을 수 있다. 내 분류를 누르면 로그인 팝업이 뜬다.
export default function KoreaSheet() {
  const { pathname, search, hash } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  // /sector/korea는 섹터 화면이고, /stock/korea는 종목 화면이다.
  const mode = pathname === STOCK_KOREA || searchParams.get('mode') === 'stock' ? 'stock' : 'sector'
  // 분류 시트 — 내 분류(mine)만 편집할 수 있다. ?sheet=krx는 읽기 전용 KRX 시트, ?sheet=marketry는 올린
  // MARKETRY를 읽기 전용으로 보여준다(MARKETRY는 내 분류에서 올려서 바꾼다).
  // 예전 주소(?sheet=nxt)는 KRX 시트로 연다.
  const { data: session, isLoading: isSessionLoading } = useSession()
  const isAdmin = isAdminSession(session)
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
  // 내 분류는 로그인이 필요하다 — 비로그인에게는 MARKETRY로 보이고, 브라우저에 저장한 선택 자체는 보존한다(지도·그래프 페이지와 같다).
  const sheet = isGuestKnown && chosenSheet === 'MINE' ? 'MARKETRY' : chosenSheet
  const isReadOnlySheet = sheet !== 'MINE'
  // 비로그인이 내 분류를 누르면 로그인 안내만 띄우고, 보던 분류에 그대로 머문다.
  const handleSelectSheet = (next: TaxonomySelection) => {
    if (next === 'MINE' && isGuestKnown) {
      requireLogin(mineSheetReturnPath(pathname, search, hash))
      return
    }
    setSelectedTaxonomy(next)
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      params.delete('sheet')
      return params
    })
  }
  // 기존 시트 링크는 처음부터 적용하고 브라우저 공통 선택으로 옮겨 URL이 이후 선택을 덮지 않게 한다.
  useEffect(() => {
    if (!explicitSheet) return
    // 내 분류 주소는 로그인 여부가 확정된 뒤에 처리한다 — 비로그인이면 선택을 옮기지 않고 팝업만 띄운다.
    if (explicitSheet === 'MINE' && isSessionLoading) return
    if (explicitSheet === 'MINE' && isGuestKnown) requireLogin(mineSheetReturnPath(pathname, search, hash))
    else setSelectedTaxonomy(explicitSheet)
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      params.delete('sheet')
      return params
    }, { replace: true })
  }, [explicitSheet, sheetParam, isSessionLoading, isGuestKnown, pathname, search, hash, requireLogin, setSelectedTaxonomy, setSearchParams])
  const {
    data: sectors,
    isLoading: isSectorsLoading,
    isError: isSectorsError,
    refetch: refetchSectors,
  } = useCustomSectors({ enabled: isLoggedIn })
  const {
    data: stockSectors,
    isLoading: isStockSectorsLoading,
    isError: isStockSectorsError,
    refetch: refetchStockSectors,
  } = useStockSectors({ enabled: isLoggedIn })

  // 선택한 분류에 맞는 최종 갱신 시각을 가져오며 거래소 시트에서는 본문 데이터도 함께 쓴다.
  // 비로그인에게는 시트가 마켓트리·거래소뿐이라 지도 조회는 항상 열려 있다. 내 분류는 로그인과 세션 확인을 마친 뒤에만 받는다.
  const canReadSheet = isLoggedIn || sheet !== 'MINE'
  const {
    data: taxonomyMap,
    isLoading: isTaxonomyLoading,
    isError: isTaxonomyError,
    refetch: refetchTaxonomy,
  } = useHeatmap('ALL_STOCK', sheet, false, { enabled: canReadSheet, includeSuspended: true })

  // 업종별 시가총액 합·종목 수(필터 전 전체 종목 기준) — MARKETRY·거래소 업종 표와 같은 계산이다. 내 분류 업종 표의 숫자 칸·기본 순서와 업종 선택 목록의 "시가총액 순"에 쓴다.
  const sectorStats = useMemo(() => buildSectorStats(taxonomyMap?.items), [taxonomyMap])

  // 읽기 전용 시트의 시장·거래소 분류명은 회원 데이터가 아니라 공통 종목 정보에서 받는다.
  // 종목 표의 마켓·거래소 분류 열은 세 시트(MARKETRY·거래소·내 분류)가 모두 쓰므로, 종목 화면에서는 시트와 상관없이 불러온다.
  const {
    data: stockCatalog,
    isLoading: isStockCatalogLoading,
    isError: isStockCatalogError,
    refetch: refetchStockCatalog,
  } = useStockCatalog({ enabled: isReadOnlySheet || mode === 'stock' })
  const stockMarkets = useMemo(
    () => new Map((stockCatalog ?? []).map(item => [item.stockCode, item.market])),
    [stockCatalog],
  )
  const stockIndustries = useMemo(
    () => new Map((stockCatalog ?? []).map(item => [item.stockCode, item.industryName])),
    [stockCatalog],
  )

  const createSector = useCreateSector()
  const renameSector = useRenameSector()
  const reparentSector = useReparentSector()
  const { remove: removeSector } = useSectorDeleteFlow()
  // 내 분류에 회원이 직접 만든 대분류가 하나도 없는 처음 상태 — 미분류·신규 상장·거래 정지는 처음부터 주어지는 분류라 세지 않는다(그래서 예전의 "업종 0개" 조건은 늘 거짓이었다).
  // 시작 안내 팝업은 이 상태 동안 한 번 띄우고, 업종을 추가하라는 시선은 섹터 표 대분류 머리글의 + 버튼이 받는다(2026-11-16 설정창 '업종 추가' 항목을 없앴다).
  const hasOwnTopSector = (sectors ?? []).some(item => item.parentId === null && !isProtectedSectorName(item.name))
  const isEmptyMineData = !isReadOnlySheet && isLoggedIn && !isSectorsLoading && Boolean(sectors) && !hasOwnTopSector
  // 내 분류가 비어 있는 동안 업종·종목 두 화면을 오가도 안내창은 한 번만 띄운다.
  const emptyGuideShownRef = useRef(false)
  useEffect(() => {
    if (!isEmptyMineData) {
      emptyGuideShownRef.current = false
      return
    }
    if (emptyGuideShownRef.current) return
    emptyGuideShownRef.current = true
    void appAlert('먼저 섹터 페이지에서 업종을 추가해 주세요. 그리고 종목 페이지로 가서 종목을 분류해 보세요.', { title: '내 기준 시작하기' })
  }, [isEmptyMineData])

  // 세션 확인 중이거나(로그인 여부를 아직 모름) 로그인 사용자의 섹터 목록을 받아오는 동안은 본문 자리에 로딩 원만 보여준다 —
  // 비로그인용 안내와 실제 표가 뒤섞여 잠깐 보였다 사라지는 걸 막는다. 위쪽 바·툴바·설정창은 그대로 두어서(다른 페이지처럼)
  // 로딩이 길어져도 설정창이 사라졌다가 다시 생기지 않는다.
  const isPageLoading = isSessionLoading || (isLoggedIn && isSectorsLoading)

  const isStock = mode === 'stock'
  const isSheetLoading = isReadOnlySheet ? isTaxonomyLoading || (isStock && isStockCatalogLoading) : isStock && isStockSectorsLoading
  const isSheetError = isReadOnlySheet ? isTaxonomyError || (isStock && isStockCatalogError) : isSectorsError || (isStock && isStockSectorsError)
  const retrySheet = () => {
    if (isReadOnlySheet) { void refetchTaxonomy(); if (isStock) void refetchStockCatalog() }
    else { void refetchSectors(); if (isStock) void refetchStockSectors() }
  }
  return (
    <SheetScreen
      page={mode === 'stock' ? 'STOCK' : 'SECTOR'}
      label={MARKET_LABEL.ALL_STOCK}
      menu={customMenu(mode === 'stock' ? 'stock' : 'sector', 'KOREA', true, sheet === 'MINE')}
      taxonomy={sheet}
      // 내 분류의 업종 목록을 받지 못하면 표를 그리지 않는다 — 비어 있다고 오해하거나 분류 선택지 없이 반쪽 표에서 고치지 않게 한다.
      state={isPageLoading || isSheetLoading ? { status: 'loading' } : isSheetError ? { status: 'error', retry: retrySheet } : { status: 'ready' }}
      canEdit={!isReadOnlySheet}
      editItems={mode === 'stock' ? ['bulk', 'excel', 'reset'] : []}
      readOnlyNote={null}
      // MARKETRY 분류 업데이트·롤백(관리자 탭)은 종목 화면에만 둔다(2026-11-19 사용자 결정).
      publishControls={isAdmin && sheet === 'MINE' && mode === 'stock' ? <MarketryPublishControls /> : null}
      isCaptureReady={!isPageLoading && (mode !== 'stock' || !isStockSectorsLoading)}
      isMineEmpty={!isReadOnlySheet && isLoggedIn && !isSectorsLoading && !isSectorsError && !isStockSectorsLoading && !isStockSectorsError && (stockSectors?.items ?? []).every(item => item.sectorId == null)}
      mineSetupPath={SECTOR_KOREA}
      panel={{ onRequestLogin: () => requireLogin(pathname), snapshotTime: taxonomyMap?.taxonomyUpdatedAt, onSelectTaxonomy: next => handleSelectSheet(next === 'KRX' || next === 'NXT' ? 'KRX' : next) }}
    >
      {slots => mode === 'stock' ? (isReadOnlySheet
        ? <KoreaReadOnlyStock key={sheet} data={taxonomyMap} isExchange={sheet !== 'MARKETRY'} markets={stockMarkets} industries={stockIndustries} slots={slots} />
        : <KoreaMineStock items={stockSectors?.items ?? []} sectors={sectors ?? []} sectorStats={sectorStats} snapshotTime={stockSectors?.snapshotTime ?? null} slots={slots} />
      ) : isReadOnlySheet ? (
        <ReadOnlyTaxonomySheet data={taxonomyMap} source={sheet === 'MARKETRY' ? 'MARKETRY' : 'KRX'} toolbarContainer={slots.toolbar} />
      ) : (
        <SectorTable
          sectors={sectors ?? []}
          settingsActionsTarget={slots.history}
          toolbarContainer={slots.toolbar}
          onCountLabelChange={slots.setCountLabel}
          sectorStats={sectorStats}
          actions={{ create: createSector.mutate, rename: renameSector.mutate, reparent: reparentSector.mutate, remove: removeSector }}
          currency="원"
          maxDepth={3}
          protectedHint={getProtectedSectorHint}
        />
      )}
    </SheetScreen>
  )
}
