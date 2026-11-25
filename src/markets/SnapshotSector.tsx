import { SNAPSHOT_MAX_DEPTH, categoryPath, stocksUnder, useSnapshotSectors } from '@/markets/snapshotSectors'
import { subSectorsBlockMessage } from '@/hooks/useSectorDeleteFlow'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData, type OverseasCategory } from '@/hooks/useOverseasClassificationData'
import { customMenu } from '@/utils/marketMenu'
import { useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import client from '@/api/client'
import AdminSectorTable from '@/components/AdminSectorTable'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { appAlert, appWarnConfirm } from '@/utils/appDialogBus'
import type { SectorItem } from '@/types/api'
import { overseasMarketInfo } from '@/utils/markets'

import SheetScreen from '@/components/SheetScreen'
import { useListedStocks, useMarketQuotes } from '@/markets/useMarketQuotes'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { overseasRoute, type OverseasMarket } from '@/utils/markets'

type Category = OverseasCategory
// 확인한 종목 수가 그사이 바뀌어 서버가 삭제를 멈추면 새 수로 다시 확인한다. 계속 바뀌면 이 횟수까지만 다시 묻는다.
const MAX_CONFIRM_ATTEMPTS = 3
const protectedHint = () => '삭제한 분류의 종목이 이 그룹으로 옮겨집니다.'
// 스냅샷 시장의 SECTOR 데이터와 편집 동작을 공통 화면에 넘긴다.
export default function SnapshotSector({ market }: { market: OverseasMarket }) {
  const { bundledStocks, currencyUnit } = SNAPSHOT_MARKETS[market]
  const { data: session } = useSession()
  // 분류 편집은 내 기준(초안)에서만 한다. MARKETRY 모드는 운영 분류를 읽기만 한다.
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  const publishedAt = useOverseasPublishedAt(market, sheet)
  const canEdit = isAdminSession(session) && sheet === 'MINE'
  const quotes = useMarketQuotes(market)
  const listed = useListedStocks(market, bundledStocks === null)
  const stockCodes = useMemo(() => bundledStocks?.map(stock => stock.code) ?? (listed.data ?? []).map(stock => stock.symbol), [bundledStocks, listed.data])
  const { categories, classifications, editBase, invalidate } = useOverseasClassificationData(market, sheet)
  const endpoint = `${editBase}/categories`
  const depthOf = (parentId: number | null): number => (parentId === null ? -1 : sectors.find(item => item.id === parentId)?.depth ?? 0)
  const create = useMutation({ meta: { failure: '업종을 추가하지 못했습니다.' }, mutationFn: async ({ name, parentId }: { name: string; parentId: number | null }): Promise<SectorItem> => { const item = (await client.post<Category>(endpoint, { name, parentId })).data; return { ...item, depth: depthOf(item.parentId) + 1 } }, onSuccess: invalidate })
  const rename = useMutation({ meta: { failure: '업종명을 바꾸지 못했습니다.' }, mutationFn: async ({ id, name }: { id: number; name: string }) => client.put(`${endpoint}/${id}`, { name }), onSuccess: invalidate })
  const reparent = useMutation({ meta: { failure: '업종을 옮기지 못했습니다.' }, mutationFn: async ({ id, parentId }: { id: number; parentId: number | null }) => client.put(`${endpoint}/${id}/parent`, { parentId }), onSuccess: invalidate })
  const { sectors, sectorStats: stats } = useSnapshotSectors(categories.data, stockCodes, classifications.data, quotes.data?.quotes)
  const remove = async (id: number, name: string) => {
    let all: Category[] = sectors
    let count = stats.get(id)?.stockCount ?? 0
    for (let attempt = 0; attempt < MAX_CONFIRM_ATTEMPTS; attempt += 1) {
      const subNames = all.filter(item => item.parentId === id).map(item => item.name)
      if (subNames.length > 0) { void appAlert(subSectorsBlockMessage(name, subNames), { title: '삭제 불가' }); return }
      if (!await appWarnConfirm(`[${name}]\n삭제하시겠습니까?${count ? `\n${count}종목이 미분류로 이동합니다.` : ''}`, { title: '업종 삭제' })) return
      try { await client.delete(`${endpoint}/${id}`, { data: { expectedMoveCount: count } }); await invalidate(); return }
      catch {
        // 그사이 종목 수가 바뀌었으면 새 수로 다시 묻고, 그대로면 실패를 알린다.
        const latest = (await categories.refetch()).data
        const draft = latest && 'categories' in latest ? latest : null
        const target = draft?.categories.find(item => item.id === id)
        if (!draft || !target) break
        const nextCount = stocksUnder(categoryPath(draft.categories, target), stockCodes, draft.classifications).length
        if (nextCount === count && !draft.categories.some(item => item.parentId === id)) break
        all = draft.categories
        count = nextCount
      }
    }
    void appAlert(`[${name}]\n삭제하지 못했습니다. 다시 시도해 주세요.`, { title: '삭제 실패' })
  }
  const isLoading = categories.isLoading || classifications.isLoading || quotes.isLoading || listed.isLoading
  const isError = categories.isError || classifications.isError || quotes.isError || listed.isError
  const retry = () => { void categories.refetch(); void classifications.refetch(); void quotes.refetch(); if (bundledStocks === null) void listed.refetch() }
  return (
    <SheetScreen
      page="SECTOR"
      label={overseasMarketInfo(market).badgeLabel}
      menu={customMenu('sector', market, true, sheet === 'MINE')}
      taxonomy={sheet}
      state={isLoading ? { status: 'loading' } : isError ? { status: 'error', retry } : { status: 'ready' }}
      canEdit={canEdit}
      editItems={[]}
      readOnlyNote={null}
      publishControls={null}
      isCaptureReady={!isLoading}
      isMineEmpty={sheet === 'MINE' && !isLoading && !isError && sectors.length === 0}
      mineSetupPath={overseasRoute('/sector', market)}
      panel={{ onlyTaxonomy: 'MARKETRY', snapshotTime: publishedAt, alsoTaxonomies: canUseMine ? ['MINE'] : undefined, withoutMiddle: true, onSelectTaxonomy: next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY') }}
    >
      {slots => (
        <AdminSectorTable
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
