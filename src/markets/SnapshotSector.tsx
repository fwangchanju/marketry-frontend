import { SNAPSHOT_MAX_DEPTH, useSnapshotSectors } from '@/markets/snapshotSectors'
import { useSectorDeleteFlow } from '@/hooks/useSectorDeleteFlow'
import { useCreateSector, useRenameSector, useReparentSector } from '@/hooks/useHeatmapCustom'
import { useSnapshotPublishedAt } from '@/markets/useSnapshotPublishedAt'
import { useSnapshotSheet } from '@/markets/useSnapshotSheet'
import { useSnapshotClassificationData } from '@/markets/useSnapshotClassificationData'
import { customMenu } from '@/utils/marketMenu'
import SectorTable from '@/components/SectorTable'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { snapshotMarketInfo } from '@/utils/markets'

import SheetScreen from '@/components/SheetScreen'
import { useMarketStocks } from '@/markets/useMarketStocks'
import { useMarketQuotes } from '@/markets/useMarketQuotes'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { snapshotRoute, type SnapshotMarket } from '@/utils/markets'

const protectedHint = () => '삭제한 분류의 종목이 이 그룹으로 옮겨집니다.'
// 스냅샷 시장의 SECTOR 데이터와 편집 동작을 공통 화면에 넘긴다.
export default function SnapshotSector({ market }: { market: SnapshotMarket }) {
  const { currencyUnit } = SNAPSHOT_MARKETS[market]
  const { data: session } = useSession()
  // 분류 편집은 내 기준에서만 한다. MARKETRY 모드는 MARKETRY 분류를 읽기만 한다.
  const { sheet, canUseMine, selectSheet } = useSnapshotSheet()
  const publishedAt = useSnapshotPublishedAt(market, sheet)
  const canEdit = isAdminSession(session) && sheet === 'MINE'
  const quotes = useMarketQuotes(market)
  const stocks = useMarketStocks(market)
  const stockCodes = stocks.codes
  const { categories, classifications } = useSnapshotClassificationData(market, sheet)
  // 편집은 한국과 같은 훅에 시장만 넘긴다. 삭제도 한국처럼 서버가 옮길 종목 수를 세어 확인한다.
  const create = useCreateSector({ market })
  const rename = useRenameSector(market)
  const reparent = useReparentSector(market)
  const { remove } = useSectorDeleteFlow(market)
  const { sectors, sectorStats: stats } = useSnapshotSectors(categories.data, stockCodes, classifications.data, quotes.data?.quotes)
  const isLoading = categories.isLoading || classifications.isLoading || quotes.isLoading || stocks.isLoading
  const isError = categories.isError || classifications.isError || quotes.isError || stocks.isError
  const retry = () => { void categories.refetch(); void classifications.refetch(); void quotes.refetch(); void stocks.refetch() }
  return (
    <SheetScreen
      page="SECTOR"
      label={snapshotMarketInfo(market).badgeLabel}
      menu={customMenu('sector', market, true, sheet === 'MINE')}
      taxonomy={sheet}
      state={isLoading ? { status: 'loading' } : isError ? { status: 'error', retry } : { status: 'ready' }}
      canEdit={canEdit}
      editItems={[]}
      readOnlyNote={null}
      publishControls={null}
      isCaptureReady={!isLoading}
      isMineEmpty={sheet === 'MINE' && !isLoading && !isError && sectors.length === 0}
      mineSetupPath={snapshotRoute('/sector', market)}
      panel={{ onlyTaxonomy: 'MARKETRY', snapshotTime: publishedAt, alsoTaxonomies: canUseMine ? ['MINE'] : undefined, withoutMiddle: true, onSelectTaxonomy: next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY') }}
    >
      {slots => (
        <SectorTable
          sectors={sectors}
          sectorStats={stats}
          toolbarContainer={slots.toolbar}
          settingsActionsTarget={slots.history}
          actions={canEdit ? { create: create.mutate, rename: rename.mutate, reparent: reparent.mutate, remove: (id, name) => void remove(id, name) } : null}
          currency={currencyUnit}
          maxDepth={SNAPSHOT_MAX_DEPTH}
          protectedHint={protectedHint}
        />
      )}
    </SheetScreen>
  )
}
