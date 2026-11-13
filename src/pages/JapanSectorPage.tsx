import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { useJapanQuotes } from '@/hooks/useJapanQuotes'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { isAdminSession } from '@/utils/adminAccess'
import { appAlert, appWarnConfirm } from '@/utils/appDialogBus'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import type { SectorItem } from '@/types/api'
import stocks from '@/data/japanStocks.json'
import { JAPAN_SETTINGS_TAB_STORAGE, NO_TAXONOMY_CHANGE } from '@/utils/japanMapSettings'

type Category = { id: number; parentId: number | null; name: string }
type Classification = { sector: string | null; industry: string | null; subIndustry: string | null }
const MAX_DEPTH = 2
const categoriesKey = ['japan', 'categories'] as const
const classificationsKey = ['japan', 'classifications'] as const
const endpoint = '/admin/overseas-classification-categories/JAPAN'

export default function JapanSectorPage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const depthOf = (parentId: number | null): number => (parentId === null ? -1 : sectors.find(item => item.id === parentId)?.depth ?? 0)
  const categories = useQuery({ queryKey: categoriesKey, queryFn: async () => (await client.get<Category[]>('/japan/categories')).data })
  const quotes = useJapanQuotes()
  const classifications = useQuery({ queryKey: classificationsKey, queryFn: async () => (await client.get<Record<string, Classification>>('/japan/classifications')).data })
  const invalidate = () => { void queryClient.invalidateQueries({ queryKey: categoriesKey }); void queryClient.invalidateQueries({ queryKey: classificationsKey }) }
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
      const matching = stocks.filter(stock => {
        const classification = classifications.data?.[stock.code]
        const values = [classification?.sector, classification?.industry, classification?.subIndustry]
        return path.every((name, index) => values[index] === name)
      })
      result.set(category.id, { marketValue: matching.reduce((sum, stock) => sum + (quoteByCode.get(stock.code) ?? 0), 0), stockCount: matching.length })
    }
    return result
  }, [sectors, classifications.data, quotes.data])
  const remove = async (id: number, name: string) => {
    if (sectors.some(item => item.parentId === id)) { void appAlert(`[${name}]\n하위 업종이 있어 삭제할 수 없습니다.`, { title: '삭제 불가' }); return }
    const count = stats.get(id)?.stockCount ?? 0
    if (!await appWarnConfirm(`[${name}]\n삭제하시겠습니까?${count ? `\n${count}종목이 미분류로 이동합니다.` : ''}`, { title: '업종 삭제' })) return
    try { await client.delete(`${endpoint}/${id}`, { data: { expectedMoveCount: count } }); invalidate() }
    catch { void appAlert(`[${name}]\n삭제하지 못했습니다. 다시 시도해 주세요.`, { title: '삭제 실패' }) }
  }
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null)
  const [settingsActions, setSettingsActions] = useState<HTMLDivElement | null>(null)
  const [count, setCount] = useState<string>()
  const [settingsOpen, setSettingsOpen] = useState(true)
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
    <div ref={rowRef} className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 flex-1 gap-[4px] overflow-hidden bg-ui-background">
      <main ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="main-toolbar mt-[3px] mb-[8px] flex h-7 shrink-0 items-center gap-1 text-sm font-bold"><ToolbarModeText page="SECTOR" label="NIKKEI 225" /><div ref={setToolbar} className="min-w-0 flex-1" /><div className={`${FONT_BAR_MODE_STATUS} ml-2 flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy="MARKETRY" /></div></div>
        {categories.isLoading || classifications.isLoading || quotes.isLoading ? <div className="flex min-h-0 flex-1 items-center justify-center pt-4 pb-[47.5px]"><Spinner showElapsed /></div> : categories.isError || classifications.isError || quotes.isError ? <div className="flex min-h-0 flex-1 items-center justify-center pt-4 pb-[47.5px]"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void categories.refetch(); void classifications.refetch(); void quotes.refetch() }} /></div> : <AdminSectorTable sectors={sectors} sectorStats={stats} toolbarContainer={toolbar} settingsActionsTarget={settingsActions} onCountLabelChange={setCount} overseasActions={{ create, rename, reparent, remove }} readOnly={!isAdminSession(session)} />}
        <DisclaimerFooter />
      </main>
      <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}><SettingsPanel pageLabel="Sector" customTabLabel="섹터" customTabIcon="industry" tabStorageName={JAPAN_SETTINGS_TAB_STORAGE.sector} taxonomyAtBottom taxonomy="MARKETRY" onlyTaxonomy="MARKETRY" onSelectTaxonomy={NO_TAXONOMY_CHANGE} stockCountLabel={count} showPreferenceActions={false} isOpen={settingsOpen} onOpenChange={setSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={['custom', 'adminOps']}><SettingsPanelGroup section="custom"><div className="settings-empty-message">읽기 전용</div></SettingsPanelGroup><SettingsPanelGroup section="adminOps"><div ref={setSettingsActions} /></SettingsPanelGroup></SettingsPanel></div>
    </div>
    {shareOpen && <ScreenshotModal onClose={() => setShareOpen(false)} onCopy={copy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
  </div>
}
