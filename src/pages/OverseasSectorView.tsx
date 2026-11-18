import MainAreaLoading from '@/components/MainAreaLoading'
import { overseasMiddleLabel } from '@/utils/overseasMiddle'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData, type OverseasCategory } from '@/hooks/useOverseasClassificationData'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { customMenu } from '@/utils/marketMenu'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import client from '@/api/client'
import AdminSectorTable from '@/components/AdminSectorTable'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import Spinner from '@/components/Spinner'
import ScreenshotModal from '@/components/ScreenshotModal'
import ToolbarModeText from '@/components/ToolbarModeText'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import type { OverseasSectorSource } from '@/hooks/overseasSectorSource'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { isAdminSession } from '@/utils/adminAccess'
import { appAlert, appWarnConfirm } from '@/utils/appDialogBus'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import type { SectorItem } from '@/types/api'
import { overseasMarketInfo } from '@/utils/markets'

type Category = OverseasCategory
const MAX_DEPTH = 2

export default function OverseasSectorView({ source }: { source: OverseasSectorSource }) {
  // 시장마다 다른 부분(종목 목록·시세·통화)은 source로 받고, 분류 데이터 주소와 화면 구성은 모든 해외 시장이 같다.
  const { market, stockCodes, stocksState, quotes, currency, tabStorageName } = source
  const { badgeLabel } = overseasMarketInfo(market)
  const { data: session } = useSession()
  // 분류 편집은 내 기준(초안)에서만 한다. MARKETRY 모드는 운영 분류를 읽기만 한다.
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  const publishedAt = useOverseasPublishedAt(market, sheet)
  const canEdit = isAdminSession(session) && sheet === 'MINE'
  const { categories, classifications, editBase, invalidate } = useOverseasClassificationData(market, sheet)
  const endpoint = `${editBase}/categories`
  const depthOf = (parentId: number | null): number => (parentId === null ? -1 : sectors.find(item => item.id === parentId)?.depth ?? 0)
  const create = useMutation({ meta: { failure: '분류를 추가하지 못했습니다.' }, mutationFn: async ({ name, parentId }: { name: string; parentId: number | null }): Promise<SectorItem> => { const item = (await client.post<Category>(endpoint, { name, parentId })).data; return { ...item, depth: depthOf(item.parentId) + 1 } }, onSuccess: invalidate })
  const rename = useMutation({ meta: { failure: '분류 이름을 바꾸지 못했습니다.' }, mutationFn: async ({ id, name }: { id: number; name: string }) => client.put(`${endpoint}/${id}`, { name }), onSuccess: invalidate })
  const reparent = useMutation({ meta: { failure: '분류를 옮기지 못했습니다.' }, mutationFn: async ({ id, parentId }: { id: number; parentId: number | null }) => client.put(`${endpoint}/${id}/parent`, { parentId }), onSuccess: invalidate })
  const sectors = useMemo<SectorItem[]>(() => {
    const all = categories.data ?? []
    const depth = (item: Category): number => { const parent = all.find(candidate => candidate.id === item.parentId); return parent ? depth(parent) + 1 : 0 }
    return all.map(item => ({ ...item, depth: Math.min(depth(item), MAX_DEPTH) }))
  }, [categories.data])
  const stats = useMemo(() => {
    const result = new Map<number, { marketValue: number; stockCount: number }>()
    const quoteByCode = new Map((quotes.data?.quotes ?? []).map(quote => [quote.stockCode, quote.totalMarketValue]))
    for (const category of sectors) {
      const path: string[] = []
      for (let current: SectorItem | undefined = category; current; current = sectors.find(item => item.id === current?.parentId)) path.unshift(current.name)
      const matching = stockCodes.filter(code => {
        const classification = classifications.data?.[code]
        const values = [classification?.sector, classification?.industry, classification?.subIndustry]
        return path.every((name, index) => values[index] === name)
      })
      result.set(category.id, { marketValue: matching.reduce((sum, code) => sum + (quoteByCode.get(code) ?? 0), 0), stockCount: matching.length })
    }
    return result
  }, [sectors, stockCodes, classifications.data, quotes.data])
  const remove = async (id: number, name: string) => {
    if (sectors.some(item => item.parentId === id)) { void appAlert(`[${name}]\n하위 업종이 있어 삭제할 수 없습니다.`, { title: '삭제 불가' }); return }
    const count = stats.get(id)?.stockCount ?? 0
    if (!await appWarnConfirm(`[${name}]\n삭제하시겠습니까?${count ? `\n${count}종목이 미분류로 이동합니다.` : ''}`, { title: '업종 삭제' })) return
    try { await client.delete(`${endpoint}/${id}`, { data: { expectedMoveCount: count } }); invalidate() }
    catch { void appAlert(`[${name}]\n삭제하지 못했습니다. 다시 시도해 주세요.`, { title: '삭제 실패' }) }
  }
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null)
  const [settingsActions, setSettingsActions] = useState<HTMLDivElement | null>(null)
  const [settingsOpen, setSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const [shareOpen, setShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLElement>(null)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const copy = async (previewSrc?: string | null) => {
    if (!previewSrc && !screenshotRef.current) return
    setCopyStatus('copying')
    try { if (previewSrc) await copyDataUrlToClipboard(previewSrc); else if (screenshotRef.current) await screenshotElementToClipboard(screenshotRef.current); setCopyStatus('copied') }
    catch { setCopyStatus('error') }
    finally { setTimeout(() => setCopyStatus('idle'), 2000) }
  }
  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  return <div className="flex h-screen flex-col overflow-hidden bg-ui-background text-ui-white">
    <NavBar /><NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => setShareOpen(true)} isScreenshotOpen={shareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setSettingsOpen(open => !open)} isSettingsOpen={settingsOpen} />} />
    <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 flex-1 overflow-hidden bg-ui-background">
      <main ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="main-toolbar mt-[3px] mb-[8px] flex h-7 shrink-0 items-center gap-1 text-sm font-bold"><ToolbarModeText page="SECTOR" label={badgeLabel} showChevron menu={customMenu('sector', market, true, sheet === 'MINE')} /><div ref={setToolbar} className="min-w-0 flex-1" /><div className={`${FONT_BAR_MODE_STATUS} ml-2 flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy={sheet} /></div></div>
        {categories.isLoading || classifications.isLoading || quotes.isLoading || stocksState.isLoading ? <MainAreaLoading><Spinner showElapsed /></MainAreaLoading> : categories.isError || classifications.isError || quotes.isError || stocksState.isError ? <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void categories.refetch(); void classifications.refetch(); void quotes.refetch(); stocksState.refetch() }} /></MainAreaLoading> : <AdminSectorTable sectors={sectors} sectorStats={stats} toolbarContainer={toolbar} settingsActionsTarget={settingsActions} overseasActions={{ create, rename, reparent, remove }} levels={3} currency={currency} readOnly={!canEdit} />}
        <DisclaimerFooter />
      </main>
      <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}><SettingsPanel pageLabel="Sector" customTabLabel="섹터" customTabIcon="industry" tabStorageName={tabStorageName} taxonomyAtBottom taxonomy={sheet} onlyTaxonomy="MARKETRY" snapshotTime={publishedAt} alsoTaxonomies={canUseMine ? ['MINE'] : undefined} middleLabel={overseasMiddleLabel(market)} onSelectTaxonomy={next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY')} showPreferenceActions={false} isOpen={settingsOpen} onOpenChange={setSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={['custom']}><SettingsPanelGroup section="custom">{canEdit ? <div ref={setSettingsActions} /> : <div className="settings-empty-message"><span className="text-center">읽기 전용{canUseMine && <><br /><span className="text-ui-muted">[내 기준] 모드만 쓰기 가능</span></>}</span></div>}</SettingsPanelGroup></SettingsPanel></div>
    </div>
    {shareOpen && <ScreenshotModal onClose={() => setShareOpen(false)} onCopy={copy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
  </div>
}
