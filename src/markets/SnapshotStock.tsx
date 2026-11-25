import StockTable, { type StockColumn, type StockRow, type StockTableEditor } from '@/components/StockTable'
import { useSnapshotSectors } from '@/markets/snapshotSectors'
import type { OverseasCategory } from '@/hooks/useOverseasClassificationData'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData } from '@/hooks/useOverseasClassificationData'
import OverseasPublishControls from '@/components/OverseasPublishControls'
import { customMenu } from '@/utils/marketMenu'
import { useMemo } from 'react'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { stockColumnWidthsForJapan,  } from '@/utils/stockTableColumns'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import { appAlert } from '@/utils/appDialogBus'
import { toJoEokDecimal } from '@/utils/format'
import { yahooSectorKo } from '@/utils/yahooSector'
import { overseasMarketInfo } from '@/utils/markets'

import SheetScreen, { type SheetSlots } from '@/components/SheetScreen'
import { SNAPSHOT_STOCK_SHEETS } from '@/markets/snapshotStockSheets'
import { useMarketQuotes } from '@/markets/useMarketQuotes'
import { overseasRoute, type OverseasMarket } from '@/utils/markets'

type SheetQueries = ReturnType<typeof useOverseasClassificationData>

// 스냅샷 시장의 STOCK 데이터와 편집 동작을 공통 화면에 넘긴다.
export default function SnapshotStock({ market }: { market: OverseasMarket }) {
  const stockSheet = SNAPSHOT_STOCK_SHEETS[market]
  const { routeSegment, badgeLabel } = overseasMarketInfo(market)
  const { data: session } = useSession()
  // MARKETRY 모드는 운영자가 제시하는 기준이라 모든 항목(종목명 한글·분류)이 수정 불가이고, 관리자는 내 기준 모드에서만 고친다.
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  const canEdit = isAdminSession(session) && sheet === 'MINE'
  const publishedAt = useOverseasPublishedAt(market, sheet)
  const quotesQuery = useMarketQuotes(market)
  const namesQuery = useQuery({ queryKey: [routeSegment, 'names'], queryFn: async () => (await client.get<Record<string, string>>(`/${routeSegment}/stock-names`)).data })
  const data = useOverseasClassificationData(market, sheet)
  const { categories, classifications } = data
  const queries = [namesQuery, classifications, categories, quotesQuery]
  const isLoading = queries.some(query => query.isLoading)
  const isError = queries.some(query => query.isError)
  return (
    <SheetScreen
      page="STOCK"
      label={badgeLabel}
      menu={customMenu('stock', market, true, sheet === 'MINE')}
      taxonomy={sheet}
      state={isLoading ? { status: 'loading' } : isError ? { status: 'error', retry: () => queries.forEach(query => void query.refetch()) } : { status: 'ready' }}
      canEdit={canEdit}
      editItems={['bulk']}
      readOnlyNote={canUseMine ? null : `계산: ${stockSheet.unit.rateNote}`}
      publishControls={sheet === 'MINE' ? <OverseasPublishControls market={market} /> : null}
      isCaptureReady={!isLoading}
      isMineEmpty={sheet === 'MINE' && !isLoading && !isError && (categories.data ?? []).length === 0}
      mineSetupPath={overseasRoute('/sector', market)}
      panel={{ onlyTaxonomy: 'MARKETRY', snapshotTime: publishedAt, alsoTaxonomies: canUseMine ? ['MINE'] : undefined, withoutMiddle: true, onSelectTaxonomy: next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY') }}
    >
      {/* 모드를 바꾸면 선택·검색·필터·변경 내역을 새로 시작한다(모든 시장이 같다). */}
      {slots => <SnapshotStockTable key={sheet} market={market} categories={categories.data} classifications={classifications.data} editBase={data.editBase} invalidateClassification={data.invalidate} names={namesQuery.data} quotes={quotesQuery.data?.quotes} canEdit={canEdit} slots={slots} />}
    </SheetScreen>
  )
}

function SnapshotStockTable({ market, categories, classifications, editBase, invalidateClassification, names, quotes, canEdit, slots }: {
  market: OverseasMarket
  categories: readonly OverseasCategory[] | undefined
  classifications: SheetQueries['classifications']['data']
  editBase: string | null
  invalidateClassification: SheetQueries['invalidate']
  names: Record<string, string> | undefined
  quotes: readonly { stockCode: string; totalMarketValue: number }[] | undefined
  canEdit: boolean
  slots: SheetSlots
}) {
  const { stocks, unit, sectorColumnLabel } = SNAPSHOT_STOCK_SHEETS[market]
  const { routeSegment } = overseasMarketInfo(market)
  const queryClient = useQueryClient()
  const saveName = useMutation({ mutationFn: async ({ code, name }: { code: string; name: string }) => { await client.put(`/admin/${routeSegment}-stock-names/${code}`, { name }) }, onSuccess: () => queryClient.invalidateQueries({ queryKey: [routeSegment, 'names'] }), meta: { failure: '종목명 (한글)을 저장하지 못했습니다. 다시 시도해 주세요.' } })
  const assignClassification = useMutation({ mutationFn: async ({ codes, categoryId }: { codes: string[]; categoryId: number }) => { await client.put(`${editBase}/assign`, { stockCodes: codes, categoryId }) }, onSuccess: invalidateClassification, meta: { failure: '종목의 업종을 바꾸지 못했습니다.' } })
  const assign = async (codes: string[], categoryId: number) => { await assignClassification.mutateAsync({ codes, categoryId }) }
  const stockCodes = useMemo(() => stocks.map(stock => stock.code), [stocks])
  const { sectors, sectorStats } = useSnapshotSectors(categories, stockCodes, classifications, quotes)
  const rows = useMemo(() => {
    const marketValueByCode = new Map((quotes ?? []).map(quote => [quote.stockCode, quote.totalMarketValue]))
    // 분류 이름은 시장 안에서 하나뿐이라 가장 깊은 이름으로 업종을 찾는다.
    const idByName = new Map(sectors.map(sector => [sector.name, sector.id]))
    return stocks.map((stock): StockRow => {
      const value = classifications?.[stock.code]
      const path = [value?.sector, value?.industry, value?.subIndustry].filter((name): name is string => Boolean(name))
      return {
        code: stock.code, name: stock.englishName || '-', alias: names?.[stock.code] ?? stock.name, marketValue: marketValueByCode.get(stock.code) ?? 0,
        sectorId: idByName.get(path.at(-1) ?? '') ?? null, path: [path[0] ?? '-', path[1] ?? '-', path[2] ?? '-'], accent: false,
        cells: { industry: yahooSectorKo(stock.sector) },
      }
    })
  }, [stocks, quotes, classifications, names, sectors])
  const columns = useMemo((): StockColumn[] => {
    const amount = (row: StockRow, rate: number) => toJoEokDecimal((row.marketValue ?? 0) / unit.perEok * rate)
    return [
      { key: 'stockCode', header: '종목코드', align: 'center', text: row => row.code, sort: 'text' },
      { key: 'stockName', header: '종목명 (영어)', align: 'left', text: row => row.name, sort: 'text', cellHint: true },
      { key: 'alias', header: '종목명 (한글)', align: 'left', text: row => row.alias ?? '-', sort: 'text', isNameEdit: true },
      { key: 'totalMarketValue', header: `시가총액 (${unit.symbol})`, align: 'right', text: row => `${amount(row, 1)} ${unit.suffix}`, sort: 'marketValue' },
      { key: 'totalMarketValueKrw', header: '시가총액 (₩)', align: 'right', text: row => `${amount(row, unit.krwRate)} 원`, sort: 'marketValue' },
      { key: 'industry', header: sectorColumnLabel, align: 'left', text: row => row.cells.industry || '-', sort: 'text', cellHint: true, filter: { key: 'industry' } },
    ]
  }, [unit, sectorColumnLabel])
  const editor: StockTableEditor | null = canEdit ? {
    sectors,
    sectorStats,
    unassignedId: sectors.find(sector => sector.name === '미분류')?.id ?? null,
    assign: (code, sectorId) => assign([code], sectorId),
    assignMany: async (codes, sectorId) => { await assign(codes, sectorId); return { failed: [] } },
    restore: async entries => {
      const codesById = new Map<number, string[]>()
      for (const entry of entries) codesById.set(entry.sectorId, [...(codesById.get(entry.sectorId) ?? []), entry.code])
      try { for (const [sectorId, codes] of codesById) await assign(codes, sectorId); return true }
      catch { return false }
    },
    nameEdit: {
      label: row => `${row.code} 종목명 (한글)`,
      maxLength: 100,
      submit: (row, name) => {
        if (name === null) { void appAlert('종목명 (한글)을 입력해 주세요.', { title: '종목명 (한글) 저장' }); return }
        const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase()
        const conflict = rows.find(other => other.code !== row.code && normalize(other.alias ?? '') === normalize(name))
        if (conflict) void appAlert(`다른 종목의 종목명 (한글)과 겹칩니다.\n겹치는 종목: ${conflict.code} ${conflict.alias}`, { title: '종목명 (한글) 저장' })
        else saveName.mutate({ code: row.code, name })
      },
    },
  } : null
  return <StockTable rows={rows} columns={columns} editor={editor} slots={slots} arrangeWidths={stockColumnWidthsForJapan} marketValueTime={null} />
}
