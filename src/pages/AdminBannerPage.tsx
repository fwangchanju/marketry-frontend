import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import MarketryLogo from '@/components/MarketryLogo'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import SettingsSegmentedControl from '@/components/SettingsSegmentedControl'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import ScreenshotModal from '@/components/ScreenshotModal'
import { useSession } from '@/hooks/useSession'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { screenshotElementToClipboard, copyDataUrlToClipboard } from '@/utils/screenshotToClipboard'
import { isAdminSession } from '@/utils/adminAccess'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { approveBanner, adminBannerImageUrl, deleteBannerDraft, getActiveBanner, getAdminBanners, saveBannerDraft, type BannerCampaign, type BannerDraftInput } from '@/api/adminBanners'
import { SaveIcon, UploadIcon } from '@/components/icons/AppIcons'

const DEFAULT_TEXT = 'MARKETRY 새 공지사항을 확인해 주세요.'
const INPUT_CLASS = 'h-8 w-full rounded border border-ui-border bg-ui-background px-2 text-sm text-ui-white outline-none focus:border-brand'

function kstInputValue(epoch = Date.now()): string {
  return new Date(epoch).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T').slice(0, 16)
}

function inputDateTime(value: string): string {
  return value ? value.slice(0, 16) : ''
}

function displayDateTime(value: string): string {
  return value.replace('T', ' ').slice(0, 16)
}

function parseKstDateTime(value: string): number {
  return Date.parse(`${value}:00+09:00`)
}

function initialDraft(): BannerDraftInput {
  return { id: null, type: 'NOTICE', title: '서비스 안내', text: DEFAULT_TEXT, linkUrl: '', startsAt: kstInputValue(), endsAt: '', file: null }
}

function statusLabel(status: BannerCampaign['status']) {
  switch (status) {
    case 'DRAFT': return '임시'
    case 'SCHEDULED': return '예약'
    case 'LIVE': return '게시 중'
    case 'ENDED': return '종료'
  }
}

function campaignImageUrl(campaign: BannerCampaign) {
  return adminBannerImageUrl(campaign.id, campaign.updatedAt)
}

function BannerPreview({ draft, savedCampaign, liveTitle, hasLiveBanner }: { draft: BannerDraftInput; savedCampaign?: BannerCampaign; liveTitle?: string | null; hasLiveBanner: boolean }) {
  const hasPendingApproval = !savedCampaign || savedCampaign.status === 'DRAFT'
  const localImageUrl = useMemo(() => draft.file ? URL.createObjectURL(draft.file) : null, [draft.file])
  useEffect(() => () => { if (localImageUrl) URL.revokeObjectURL(localImageUrl) }, [localImageUrl])
  const visitorStatus = hasLiveBanner ? `실제 방문자에게는 ${liveTitle ? `“${liveTitle}” 배너가` : '현재 배너가'} 계속 표시됩니다.` : '현재 실제 게시 배너는 없습니다.'
  return (
    <div className="w-full min-w-0 shrink-0 border border-ui-border bg-ui-background">
      <div className="flex min-h-10 items-center gap-3 border-b border-ui-border bg-ui-surface px-3 text-xs">
        <span className="inline-flex h-6 shrink-0 items-center rounded-sm border border-admin-only px-2 text-[14px] leading-none font-semibold text-admin-only">{hasPendingApproval ? 'TEST · 관리자 미리보기' : savedCampaign ? statusLabel(savedCampaign.status) : 'TEST'}</span>
        <span className="min-w-0 truncate text-ui-muted">{hasPendingApproval ? visitorStatus : '승인된 배너가 표시됩니다.'}</span>
      </div>
      <div className="relative h-[90px] bg-ui-surface">
        <div className="absolute inset-x-4 top-0 flex h-[90px] items-center justify-between">
          <MarketryLogo layout="horizontalClean" className="h-auto w-44 shrink-0" />
          <div className="mx-3 flex h-[90px] min-w-0 max-w-[728px] flex-1 items-center justify-center">
            {draft.type === 'AD' ? (
                localImageUrl ? (
                <img src={localImageUrl} alt={draft.title || '광고 배너 미리보기'} className="h-full w-full object-contain" />
              ) : savedCampaign?.hasImage ? (
                <img src={campaignImageUrl(savedCampaign)} alt={draft.title || '광고 배너 미리보기'} className="h-full w-full object-contain" />
              ) : (
                <span className="flex h-[90px] w-full items-center justify-center border border-dashed border-ui-border text-xs text-ui-muted">광고 이미지를 선택하면 이 위치에서 미리 볼 수 있습니다.</span>
              )
            ) : (
              <div className="flex h-[90px] w-full items-center justify-between gap-4 overflow-hidden bg-brand-surface px-5 text-ui-white">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-bold">{draft.title || '공지 제목'}</p>
                  <p className="m-0 truncate text-xs text-ui-white/80">{draft.text || '문구를 입력하면 바로 미리보기에 반영됩니다.'}</p>
                </div>
                {draft.linkUrl && <span className="shrink-0 text-xs font-bold text-brand">자세히 보기 ›</span>}
              </div>
            )}
          </div>
          <div aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded border border-ui-border text-ui-muted">◯</div>
        </div>
      </div>
      <div className="flex h-8 items-center gap-5 border-t border-ui-border bg-ui-surface px-4 text-xs text-ui-muted">
        <span className="text-ui-white">⌂ Home</span><span>▦ Map</span><span>▥ Graph</span><span>✎ Custom</span><span className="text-admin-only">♙ Admin</span>
      </div>
      {draft.linkUrl && <p className="m-0 truncate border-t border-ui-border px-3 py-1 text-[10px] text-ui-muted">연결 주소: {draft.linkUrl}</p>}
    </div>
  )
}

export default function AdminBannerPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = isAdminSession(session)
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsPanelSide()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [draft, setDraft] = useState<BannerDraftInput>(initialDraft)
  const [isDraftSaved, setIsDraftSaved] = useState(false)
  const [savedCampaign, setSavedCampaign] = useState<BannerCampaign | undefined>()
  const screenshotRef = useRef<HTMLDivElement>(null)
  const client = useQueryClient()

  const campaigns = useQuery({ queryKey: ['admin-banners'], queryFn: ({ signal }) => getAdminBanners(signal), enabled: isAdmin, retry: false })
  const activeBanner = useQuery({ queryKey: ['banners', 'active'], queryFn: ({ signal }) => getActiveBanner(signal), enabled: isAdmin, retry: false })
  const listedCampaign = useMemo(() => campaigns.data?.find(item => item.id === draft.id), [campaigns.data, draft.id])
  const selectedCampaign = listedCampaign ?? savedCampaign
  const canEdit = !selectedCampaign || selectedCampaign.status === 'DRAFT'
  const isDirty = !isDraftSaved

  const saveMutation = useMutation({
    mutationFn: saveBannerDraft,
    onSuccess: async item => {
      setSavedCampaign(item)
      setDraft(value => ({ ...value, id: item.id, file: null }))
      setIsDraftSaved(true)
      await client.invalidateQueries({ queryKey: ['admin-banners'] })
      void appAlert('배너 시안을 저장했습니다. 실제 공개 전 테스트 미리보기에서 확인해 주세요.', { title: '저장 완료' })
    },
    onError: error => void appAlert(isAxiosError(error) ? String(error.response?.data?.message ?? '입력 내용을 확인하고 다시 시도해 주세요.') : '입력 내용을 확인하고 다시 시도해 주세요.', { title: '저장 실패' }),
  })
  const approveMutation = useMutation({
    mutationFn: approveBanner,
    onSuccess: async item => {
      setSavedCampaign(item)
      setIsDraftSaved(true)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-banners'] }),
        client.invalidateQueries({ queryKey: ['banners', 'active'] }),
      ])
      void appAlert(item.status === 'SCHEDULED' ? '선택한 시각에 배너가 교체되도록 예약했습니다.' : '배너를 실제 상단 영역에 반영했습니다.', { title: '승인 완료' })
    },
    onError: error => void appAlert(isAxiosError(error) ? String(error.response?.data?.message ?? '시간이 겹치는 배너가 있는지 확인해 주세요.') : '배너 승인에 실패했습니다. 잠시 후 다시 시도해 주세요.', { title: '승인 실패' }),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteBannerDraft,
    onSuccess: async () => {
      setDraft(initialDraft())
      setSavedCampaign(undefined)
      setIsDraftSaved(false)
      await client.invalidateQueries({ queryKey: ['admin-banners'] })
    },
    onError: () => void appAlert('임시 배너를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', { title: '삭제 실패' }),
  })

  useEffect(() => {
    if (!savedCampaign || draft.id !== savedCampaign.id) return
    const refreshed = campaigns.data?.find(item => item.id === savedCampaign.id)
    if (refreshed) setSavedCampaign(refreshed)
  }, [campaigns.data, draft.id, savedCampaign])

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
  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const changeDraft = (patch: Partial<BannerDraftInput>) => {
    setDraft(value => ({ ...value, ...patch }))
    setIsDraftSaved(false)
  }
  const handleSave = () => {
    if (!canEdit || saveMutation.isPending) return
    if (!draft.title.trim() || !draft.startsAt || (draft.type === 'NOTICE' && !draft.text.trim()) || (draft.type === 'AD' && !draft.file && !savedCampaign?.hasImage)) {
      void appAlert('제목, 문구 또는 광고 이미지와 게시 시작 시각을 확인해 주세요.', { title: '입력 확인' })
      return
    }
    saveMutation.mutate(draft)
  }
  const handleApprove = async () => {
    if (!draft.id || !isDraftSaved || selectedCampaign?.status !== 'DRAFT' || approveMutation.isPending) return
    const replacementAt = displayDateTime(draft.startsAt)
    if (!await appConfirm(`테스트 미리보기를 확인했습니다. ${replacementAt} (한국 시간)에 이 배너를 실제 방문자에게 공개하시겠습니까?`, { title: '배너 실제 반영' })) return
    approveMutation.mutate(draft.id)
  }
  const selectCampaign = (item: BannerCampaign) => {
    setSavedCampaign(item)
    setIsDraftSaved(true)
    setDraft({
      id: item.id,
      type: item.type,
      title: item.title,
      text: item.text ?? '',
      linkUrl: item.linkUrl ?? '',
      startsAt: inputDateTime(item.startsAt),
      endsAt: inputDateTime(item.endsAt ?? ''),
      file: null,
    })
  }
  const startNewDraft = () => {
    setSavedCampaign(undefined)
    setDraft(initialDraft())
    setIsDraftSaved(false)
  }
  const handleDelete = async () => {
    if (!draft.id || selectedCampaign?.status !== 'DRAFT') return
    if (await appConfirm('이 임시 배너를 삭제하시겠습니까?', { title: '배너 삭제' })) deleteMutation.mutate(draft.id)
  }

  const handlePickFile = (file: File | undefined) => {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      void appAlert('PNG 또는 JPEG 이미지 파일을 선택해 주세요.', { title: '파일 형식 확인' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      void appAlert('배너 이미지는 2MB 이하만 올릴 수 있습니다.', { title: '파일 크기 확인' })
      return
    }
    changeDraft({ file })
  }

  const isStartingSoon = draft.startsAt && parseKstDateTime(draft.startsAt) > Date.now()
  const campaignsList = campaigns.data ?? []

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => { void campaigns.refetch(); void activeBanner.refetch() }}
            isRefreshing={campaigns.isFetching || activeBanner.isFetching}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            showRefresh={false}
            onToggleSettings={() => setIsSettingsOpen(previous => !previous)}
            isSettingsOpen={isSettingsOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isScreenshotOpen={isShareOpen}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        <div className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
          <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background text-ui-white">
            {isLoading ? (
              <p role="status" className="m-auto text-base text-ui-text">관리자 권한을 확인하는 중입니다.</p>
            ) : !isAdmin ? (
              <p className="m-auto text-center text-base text-ui-text">관리자 전용 페이지입니다.</p>
            ) : (
              <section aria-label="배너 운영" className="flex min-h-0 flex-1 w-full flex-col text-sm">
                <Toolbar>
                  <ToolbarModeText page="ADMIN" label="BANNER" />
                </Toolbar>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-2 pb-1">
                  <div className="flex shrink-0 items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h1 className="m-0 text-lg font-bold text-ui-white">배너 운영</h1>
                      <p className="m-0 mt-1 text-xs text-ui-muted">수정 → 테스트 → 승인 후 실제 반영 · 게시 슬롯에는 한 번에 하나만 표시됩니다.</p>
                    </div>
                    <button type="button" onClick={startNewDraft} className="toolbar-badge-control h-6 shrink-0 border-0 bg-brand-surface px-3 text-sm font-bold text-ui-white hover:bg-brand-surface-hover">새 배너</button>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
                    <BannerPreview draft={draft} savedCampaign={selectedCampaign} liveTitle={activeBanner.data?.title} hasLiveBanner={activeBanner.data?.active ?? false} />
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-ui-border">
                      <div className="flex h-8 shrink-0 items-center justify-between border-b border-ui-border px-2">
                        <span className="font-bold">배너 목록 <span className="text-ui-muted">{campaignsList.length}건</span></span>
                        <span className="text-xs text-ui-muted">게시 중인 배너는 다음 예약 시작 시각에 교체됩니다.</span>
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto">
                        {campaigns.isError ? (
                          <p role="alert" className="m-0 flex h-full items-center justify-center p-3 text-center text-sm text-status-error-text">배너 목록을 불러오지 못했습니다.</p>
                        ) : campaigns.isPending ? (
                          <p role="status" className="m-0 p-3 text-sm text-ui-muted">배너 목록을 불러오는 중입니다.</p>
                        ) : campaignsList.length === 0 ? (
                          <p className="m-0 p-3 text-sm text-ui-muted">등록된 배너가 없습니다.</p>
                        ) : (
                          <table className="nes-table is-dark w-full min-w-[730px] table-fixed text-xs [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:py-1.5 [&_th]:border-ui-border [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-[var(--ui-panel)] [&_th]:py-1.5">
                            <colgroup><col style={{ width: 82 }} /><col style={{ width: 76 }} /><col /><col style={{ width: 164 }} /><col style={{ width: 164 }} /></colgroup>
                            <thead><tr><th>상태</th><th>종류</th><th className="text-left">제목</th><th>시작</th><th>종료</th></tr></thead>
                            <tbody>
                              {campaignsList.map(item => (
                                <tr key={item.id} onClick={() => selectCampaign(item)} className={`cursor-pointer ${draft.id === item.id ? 'bg-[var(--brand)]/15' : 'hover:bg-[var(--brand)]/10'}`}>
                                  <td className="text-center">{statusLabel(item.status)}</td>
                                  <td className="text-center">{item.type === 'NOTICE' ? '공지' : '광고'}</td>
                                  <td className="truncate text-left">{item.title}</td>
                                  <td className="text-center tabular-nums">{displayDateTime(item.startsAt)}</td>
                                  <td className="text-center tabular-nums">{item.endsAt ? displayDateTime(item.endsAt) : '다음 배너까지'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
            <DisclaimerFooter />
          </div>
          {isAdmin && (
            <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
              <SettingsPanel
                pageLabel="Admin"
                showPreferenceActions={false}
                fixedSideTab
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                isOnLeft={isSettingsOnLeft}
                onToggleSide={toggleSettingsSide}
                sectionOrder={['adminManage']}
              >
                <SettingsPanelGroup section="adminManage">
                  <div className="settings-plain-content">
                    <div className="settings-ops-item h-[180px] text-sm">
                      <div className="settings-custom-control">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">배너 종류</h2>
                        <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">광고 이미지 또는 공지 문구</p>
                        <div className="mt-auto mb-auto flex flex-col gap-2">
                          <SettingsSegmentedControl
                            label="배너 종류"
                            options={[{ value: 'AD', label: '광고' }, { value: 'NOTICE', label: '공지' }]}
                            value={draft.type}
                            onChange={type => changeDraft({ type })}
                            disabled={!canEdit}
                          />
                          <label className="block text-xs text-ui-muted">연결 주소(선택)<input aria-label="연결 주소" disabled={!canEdit} value={draft.linkUrl} onChange={event => changeDraft({ linkUrl: event.target.value })} placeholder="https:// 또는 /경로" className={`${INPUT_CLASS} mt-1`} /></label>
                        </div>
                      </div>
                    </div>
                    <div className="settings-ops-item h-[180px] text-sm">
                      <div className="settings-custom-control">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">내용</h2>
                        <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">입력 내용은 미리보기에 바로 반영됩니다.</p>
                        <div className="mt-auto mb-auto flex flex-col gap-1">
                          <label className="block text-[11px] leading-3 text-ui-muted">제목<input aria-label="배너 제목" maxLength={100} disabled={!canEdit} value={draft.title} onChange={event => changeDraft({ title: event.target.value })} className={`${INPUT_CLASS} mt-0.5`} /></label>
                          {draft.type === 'NOTICE' ? (
                            <label className="block text-[11px] leading-3 text-ui-muted">공지 문구<textarea aria-label="공지 문구" maxLength={200} disabled={!canEdit} value={draft.text} onChange={event => changeDraft({ text: event.target.value })} className="mt-0.5 h-9 w-full resize-none rounded border border-ui-border bg-ui-background p-1.5 text-xs text-ui-white outline-none focus:border-brand disabled:opacity-50" /></label>
                          ) : (
                            <label className="flex h-[25px] cursor-pointer items-center justify-center gap-1 rounded-[4px] border border-ui-border bg-ui-background px-2 text-[13px]/4 text-ui-white hover:border-brand has-[:disabled]:opacity-35">
                              <UploadIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                              {draft.file?.name ?? (savedCampaign?.hasImage ? '이미지 교체' : '배너 이미지 선택')}
                              <input type="file" accept="image/png,image/jpeg" disabled={!canEdit} onChange={event => handlePickFile(event.target.files?.[0])} className="sr-only" />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="settings-ops-item h-[180px] text-sm">
                      <div className="settings-custom-control">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">교체 일정</h2>
                        <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">한국 시간에 실제 배너가 교체됩니다.</p>
                        <div className="mt-auto mb-auto flex flex-col gap-1">
                          <label className="block text-[11px] leading-3 text-ui-muted">교체 시작 날짜·시각<input type="datetime-local" disabled={!canEdit} value={draft.startsAt} onChange={event => changeDraft({ startsAt: event.target.value })} className={`${INPUT_CLASS} mt-0.5`} /></label>
                          <label className="block text-[11px] leading-3 text-ui-muted">교체 종료 날짜·시각(선택)<input type="datetime-local" disabled={!canEdit} value={draft.endsAt} onChange={event => changeDraft({ endsAt: event.target.value })} className={`${INPUT_CLASS} mt-0.5`} /></label>
                          <p className="m-0 text-[10px]/3 text-ui-muted">종료 시 다음 예약 배너로 바뀝니다.</p>
                        </div>
                      </div>
                    </div>
                    <div className="settings-ops-item h-[180px] text-sm">
                      <div className="settings-custom-control">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">테스트 · 승인</h2>
                        <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">테스트 미리보기는 관리자에게만 보입니다.</p>
                        <div className="mt-auto mb-auto flex flex-col gap-2">
                          <button type="button" disabled={!canEdit || saveMutation.isPending || !isDirty} onClick={handleSave} className="flex h-[25px] items-center justify-center gap-1.5 rounded-[4px] border border-ui-border bg-ui-control text-[13px] leading-[1.3] font-medium text-ui-white settings-chip-hover disabled:cursor-not-allowed disabled:opacity-35"><SaveIcon aria-hidden="true" className="h-4 w-4" />시안 저장</button>
                          <button type="button" disabled={!draft.id || !isDraftSaved || selectedCampaign?.status !== 'DRAFT' || approveMutation.isPending} onClick={() => void handleApprove()} className="h-[25px] rounded-[4px] border-0 bg-admin-only px-2 text-[13px] leading-[1.3] font-medium text-ui-background hover:bg-admin-only-hover disabled:cursor-not-allowed disabled:opacity-35">{isStartingSoon ? '승인 후 예약' : '승인 후 실제 반영'}</button>
                          {draft.id && selectedCampaign?.status === 'DRAFT' && <button type="button" disabled={deleteMutation.isPending} onClick={() => void handleDelete()} className="h-[25px] rounded-[4px] border border-ui-border bg-transparent px-2 text-[13px] leading-[1.3] font-medium text-ui-muted settings-chip-hover disabled:cursor-not-allowed disabled:opacity-35">임시 시안 삭제</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                </SettingsPanelGroup>
              </SettingsPanel>
            </div>
          )}
        </div>
      </div>
      {isShareOpen && (
        <ScreenshotModal
          onClose={() => setIsShareOpen(false)}
          onCopy={handleCopy}
          copyLabel={copyLabel}
          isCopying={copyStatus === 'copying'}
          screenshotTarget={screenshotRef.current}
        />
      )}
    </div>
  )
}
