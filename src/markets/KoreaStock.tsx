import { useMemo } from 'react'
import type { SheetSlots } from '@/components/SheetScreen'
import { resolveSectorChain, buildSectorOptions } from '@/utils/sectorOptions'
import StockTable, { type StockColumn, type StockRow, type StockTableEditor } from '@/components/StockTable'
import { useAssignStockSector, useBulkAssignStockSector, useUpdateStockAlias } from '@/hooks/useHeatmapCustom'
import { useMarketValueTiers } from '@/hooks/useMarketValueTiers'
import { useSession } from '@/hooks/useSession'
import KoreaStockFiles from '@/markets/KoreaStockFiles'
import type { HeatmapResponse, SectorItem, StockSectorListItem } from '@/types/api'
import { isAdminSession } from '@/utils/adminAccess'
import { findAliasConflict } from '@/utils/aliasConflict'
import { appAlert } from '@/utils/appDialogBus'
import { toJoEokDecimal } from '@/utils/format'
import { KRX_PROTECTED_SECTOR_NAMES } from '@/utils/protectedSector'
import type { SectorStats } from '@/utils/sectorOrder'

type Market = 'KOSPI' | 'KOSDAQ'
const MARKET_LABEL: Record<Market, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
// 약칭 최대 글자 수 — 분류 이름(대·중·소분류)과 같다.
const ALIAS_MAX_LENGTH = 12
const cell = (key: 'sizeTier' | 'market' | 'industry') => (row: StockRow) => row.cells[key] || '-'
const isExchangeProtected = (value: string) => KRX_PROTECTED_SECTOR_NAMES.includes(value)

// 한국 종목 표의 열. 약칭을 보이지 않는 사용자는 종목명이 그 자리까지 차지해 나머지 열 위치가 같다.
function useKoreaColumns(showAlias: boolean, aliasHint?: string): StockColumn[] {
  const { data: tiers } = useMarketValueTiers()
  return useMemo(() => {
    // 규모 필터는 큰 구간부터.
    const tierOrder = [...(tiers ?? [])].sort((a, b) => b.thresholdValue - a.thresholdValue).map(tier => tier.label)
    return [
      { key: 'stockCode', header: '종목코드', align: 'center', text: row => row.code, sort: 'text' },
      { key: 'stockName', header: '종목명', align: 'left', text: row => row.name, sort: 'text', accent: true, spans: showAlias ? undefined : ['alias'] },
      ...(showAlias ? [{ key: 'alias', header: '약칭', align: 'left', text: row => row.alias ?? '-', sort: 'text', isNameEdit: true, headerHint: aliasHint } satisfies StockColumn] : []),
      { key: 'totalMarketValue', header: '시가총액', align: 'right', text: row => (row.marketValue === null ? '-' : `${toJoEokDecimal(row.marketValue / 100_000_000)} 원`), sort: 'marketValue' },
      // 규모는 시가총액이 클수록 큰 구간이라 시가총액 순서와 같다.
      { key: 'sizeTier', header: '규모', align: 'center', text: cell('sizeTier'), sort: 'marketValue', filter: { key: 'sizeTier', order: tierOrder } },
      { key: 'market', header: '마켓', align: 'center', text: cell('market'), sort: 'text', accent: true, filter: { key: 'market', order: ['코스피', '코스닥'] } },
      { key: 'industry', header: '거래소 분류', align: 'left', text: cell('industry'), sort: 'text', filter: { key: 'industry' } },
    ]
  }, [tiers, showAlias, aliasHint])
}

// MARKETRY·거래소 종목 표 — 읽기 전용이다.
export function KoreaReadOnlyStock({ data, isExchange, markets, industries, slots }: {
  data: HeatmapResponse | undefined
  isExchange: boolean
  markets: ReadonlyMap<string, Market>
  industries: ReadonlyMap<string, string | null>
  slots: SheetSlots
}) {
  const isAdmin = isAdminSession(useSession().data)
  const showAlias = !isExchange || isAdmin
  const rows = useMemo(() => {
    const result: StockRow[] = []
    const walk = (nodes: HeatmapResponse['items'], parents: string[]) => {
      for (const node of nodes) {
        const path = [...parents, node.sectorName]
        for (const stock of node.items) {
          const market = markets.get(stock.stockCode)
          result.push({
            code: stock.stockCode, name: stock.stockName, alias: showAlias ? stock.alias ?? null : null, marketValue: stock.totalMarketValue, sectorId: null,
            // 거래소의 대·중·소분류는 아직 값이 없다.
            path: isExchange ? ['-', '-', '-'] : [path[0] ?? '-', path[1] ?? '-', path[2] ?? '-'],
            accent: market === 'KOSDAQ',
            cells: { sizeTier: stock.marketValueTier ?? '', market: market ? MARKET_LABEL[market] : '', industry: isExchange ? node.sectorName : industries.get(stock.stockCode) ?? '' },
            searchLabel: isExchange ? industries.get(stock.stockCode) ?? undefined : node.sectorName,
          })
        }
        walk(node.children, path)
      }
    }
    walk(data?.items ?? [], [])
    return result
  }, [data, isExchange, markets, industries, showAlias])
  return <StockTable rows={rows} columns={useKoreaColumns(showAlias)} editor={null} slots={slots} marketValueTime={null} industryProtected={isExchange ? isExchangeProtected : undefined} levelSortKey={isExchange ? 'industry' : undefined} />
}

// 내 기준 종목 표 — 분류를 고친다. 약칭은 관리자만 보고 고친다.
export function KoreaMineStock({ items, sectors, sectorStats, snapshotTime, slots }: {
  items: readonly StockSectorListItem[]
  sectors: SectorItem[]
  sectorStats: SectorStats
  snapshotTime: string | null
  slots: SheetSlots
}) {
  const isAdmin = isAdminSession(useSession().data)
  const assignStock = useAssignStockSector()
  const assignStocks = useBulkAssignStockSector()
  const updateAlias = useUpdateStockAlias()
  const rows = useMemo(() => {
    const byId = new Map(buildSectorOptions(sectors).map(option => [option.id, option]))
    return items.map((item): StockRow => {
      const chain = resolveSectorChain(byId, item.sectorId)
      return {
        code: item.stockCode, name: item.stockName, alias: isAdmin ? item.alias : null, marketValue: item.totalMarketValue, sectorId: item.sectorId,
        path: [chain.rootName, chain.midName ?? '-', chain.leafName ?? '-'], accent: item.market === 'KOSDAQ',
        cells: { sizeTier: item.marketValueTier ?? '', market: MARKET_LABEL[item.market], industry: item.industryName ?? '' },
      }
    })
  }, [items, sectors, isAdmin])
  const editor: StockTableEditor = {
    sectors,
    sectorStats,
    unassignedId: null,
    assign: async (stockCode, sectorId) => { await assignStock.mutateAsync({ stockCode, sectorId }) },
    assignMany: async (stockCodes, sectorId) => ({ failed: (await assignStocks.mutateAsync({ stockCodes, sectorId })).failedStockCodes }),
    restore: async entries => {
      for (const entry of entries) assignStock.mutate({ stockCode: entry.code, sectorId: entry.sectorId })
      return true
    },
    nameEdit: isAdmin ? {
      label: () => '운영자 전용 약칭',
      maxLength: ALIAS_MAX_LENGTH,
      submit: (row, alias) => {
        // 다른 종목의 이름이나 약칭과 같은 약칭은 저장하지 않는다 — 지도에서 서로 다른 종목이 같은 이름으로 보인다.
        const conflict = alias === null ? null : findAliasConflict([...items], row.code, alias)
        if (conflict) void appAlert(`"${alias}"은(는) 다른 종목과 겹치는 약칭이라 저장하지 않았습니다.\n겹치는 종목: ${conflict}`, { title: '약칭 저장' })
        else updateAlias.mutate({ stockCode: row.code, alias })
      },
    } : null,
  }
  return (
    <StockTable
      rows={rows}
      columns={useKoreaColumns(isAdmin, '약칭은 운영자만 관리할 수 있습니다.')}
      editor={editor}
      slots={slots}
      marketValueTime={snapshotTime}
      extras={context => <KoreaStockFiles items={items} sectors={sectors} excelContainer={slots.excel} resetContainer={slots.reset} {...context} />}
    />
  )
}
