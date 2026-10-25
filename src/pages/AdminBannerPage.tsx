import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { BannerImage, NoticeBanner } from '@/components/BannerContent'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
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

const INPUT_CLASS = 'h-[25px] w-full min-w-0 rounded-[4px] border border-transparent bg-[var(--ui-control)] px-2 text-[13px]/4 font-medium text-ui-white outline-none focus:border-brand placeholder:text-ui-muted disabled:opacity-35'
const SETTINGS_ACTION_CLASS = 'flex h-[25px] w-full items-center justify-center gap-1.5 rounded-[4px] border-0 bg-[var(--ui-control)] text-[13px] leading-[1.3] font-medium text-ui-white settings-chip-hover disabled:cursor-not-allowed disabled:opacity-35'

function kstInputValue(epoch = Date.now()): string {
  return new Date(epoch).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T').slice(0, 16)
}

function inputDateTime(value: string): string {
  return value ? value.slice(0, 16) : ''
}

function formatDatePart(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}/)
  return match ? `${match[1]}.${match[2]}.${match[3]}.` : ''
}

function formatTimePart(value: string): string {
  const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/)
  if (!match) return ''
  const hour = Number(match[1].slice(0, 2))
  return String(hour % 12 || 12).padStart(2, '0') + match[1].slice(2)
}

function isPmPart(value: string): boolean {
  const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):\d{2}/)
  return match ? Number(match[1]) >= 12 : false
}

function parseDateTime12(value: string, isPm: boolean): string | null {
  const match = value.match(/^\s*(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})\.?\s+(\d{1,2}):(\d{2})\s*$/)
  if (!match) return null
  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const year = Number(yearText), month = Number(monthText), day = Number(dayText), hour12 = Number(hourText), minute = Number(minuteText)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour12 < 1 || hour12 > 12 || minute > 59) return null
  const hour = (hour12 % 12) + (isPm ? 12 : 0)
  return `${yearText}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function DateTimeField({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [dateText, setDateText] = useState(formatDatePart(value))
  const [timeText, setTimeText] = useState(formatTimePart(value))
  const [isPm, setIsPm] = useState(isPmPart(value))
  const lastEmittedValue = useRef(value)
  const commitParts = (date: string, time: string) => {
    const parsed = parseDateTime12(`${date} ${time}`, isPm)
    const nextValue = parsed ?? ''
    if (nextValue === lastEmittedValue.current) return
    lastEmittedValue.current = nextValue
    onChange(nextValue)
  }

  return (
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(82px,92px)_32px_52px] gap-0.5">
      <input aria-label={`${label} 날짜`} type="text" inputMode="numeric" disabled={disabled} value={dateText} placeholder="yyyy.mm.dd." onChange={event => {
        const next = event.target.value
        setDateText(next)
        commitParts(next, timeText)
      }} className="h-[25px] min-w-0 rounded-[4px] border border-transparent bg-[var(--ui-control)] px-1 text-center text-[13px] tabular-nums text-ui-white outline-none focus:border-brand disabled:opacity-35" />
      <select aria-label={`${label} 오전/오후`} disabled={disabled} value={isPm ? 'pm' : 'am'} onChange={event => {
        const nextIsPm = event.target.value === 'pm'
        setIsPm(nextIsPm)
        const parsed = parseDateTime12(`${dateText} ${timeText}`, nextIsPm)
        const nextValue = parsed ?? ''
        if (nextValue !== lastEmittedValue.current) {
          lastEmittedValue.current = nextValue
          onChange(nextValue)
        }
      }} className="h-[25px] w-[32px] appearance-none rounded-[4px] border border-transparent bg-[var(--ui-control)] p-0 text-center text-[11px] font-medium text-ui-white outline-none focus:border-brand disabled:opacity-35">
        <option value="am">오전</option>
        <option value="pm">오후</option>
      </select>
      <input aria-label={`${label} 시각 (12시간)`} type="text" inputMode="numeric" disabled={disabled} value={timeText} placeholder="hh:mm" onChange={event => {
        const next = event.target.value
        setTimeText(next)
        commitParts(dateText, next)
      }} className="h-[25px] w-full rounded-[4px] border border-transparent bg-[var(--ui-control)] px-1 text-center text-[13px] tabular-nums text-ui-white outline-none focus:border-brand disabled:opacity-35" />
    </div>
  )
}

function displayDateTime(value: string): string {
  return value.replace('T', ' ').slice(0, 16)
}

function parseKstDateTime(value: string): number {
  return Date.parse(`${value}:00+09:00`)
}

function initialDraft(): BannerDraftInput {
  return { id: null, type: 'NOTICE', title: '', text: '', linkUrl: 'http://', startsAt: kstInputValue(), endsAt: '', file: null }
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

function BannerPreview({ draft, savedCampaign, visitorStatus }: { draft: BannerDraftInput; savedCampaign?: BannerCampaign; visitorStatus: string }) {
  const localImageUrl = useMemo(() => draft.file ? URL.createObjectURL(draft.file) : null, [draft.file])
  useEffect(() => () => { if (localImageUrl) URL.revokeObjectURL(localImageUrl) }, [localImageUrl])
  const imageUrl = localImageUrl ?? (savedCampaign?.hasImage ? campaignImageUrl(savedCampaign) : null)
  const linkUrl = draft.linkUrl.trim() === 'http://' ? '' : draft.linkUrl.trim()
  return (
    <section aria-label="배너 미리보기" className="min-w-0 shrink-0">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ui-muted">
        <h1 className="m-0 text-[15px] font-medium">미리보기</h1>
        <span className="rounded-[4px] bg-[var(--ui-control)] px-2 py-1 text-ui-white">관리자 전용</span>
        <span role="status">{visitorStatus}</span>
      </div>
      <div className="flex flex-col gap-3 overflow-x-auto pb-1">
        {[{ width: 728, height: 90 }, { width: 468, height: 60 }].map(size => (
          <figure key={size.width} className="m-0 w-fit">
            <figcaption className="mb-1 text-xs text-ui-muted">{size.width} × {size.height}</figcaption>
            <div style={{ width: size.width, height: size.height }} className="overflow-hidden bg-ui-surface">
              {draft.type === 'NOTICE'
                ? <NoticeBanner title={draft.title || '서비스 안내'} text={draft.text} linkUrl={linkUrl || null} size={size} preview />
                : imageUrl
                  ? <BannerImage src={imageUrl} title={draft.title || '광고 배너'} size={size} />
                  : <p className="m-0 flex h-full items-center justify-center text-xs text-ui-muted">광고 이미지를 선택해 주세요.</p>}
            </div>
          </figure>
        ))}
      </div>
      {linkUrl && <p className="mb-0 break-all text-xs text-ui-muted">연결 주소: {linkUrl}</p>}
    </section>
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
  const [activeType, setActiveType] = useState<BannerDraftInput['type']>('NOTICE')
  const [drafts, setDrafts] = useState<Record<BannerDraftInput['type'], BannerDraftInput>>(() => ({
    AD: { ...initialDraft(), type: 'AD', title: '', text: '' },
    NOTICE: initialDraft(),
  }))
  const [editedFlags, setEditedFlags] = useState({ AD: false, NOTICE: false })
  const [draftGeneration, setDraftGeneration] = useState(0)
  const [savedFlags, setSavedFlags] = useState<Record<BannerDraftInput['type'], boolean>>({ AD: false, NOTICE: false })
  const [savedCampaigns, setSavedCampaigns] = useState<Partial<Record<BannerDraftInput['type'], BannerCampaign>>>({})
  const screenshotRef = useRef<HTMLDivElement>(null)
  const client = useQueryClient()

  const campaigns = useQuery({ queryKey: ['admin-banners'], queryFn: ({ signal }) => getAdminBanners(signal), enabled: isAdmin, retry: false })
  const activeBanner = useQuery({ queryKey: ['banners', 'active'], queryFn: ({ signal }) => getActiveBanner(signal), enabled: isAdmin, retry: false })
  const draft = drafts[activeType]
  const isDraftSaved = savedFlags[activeType]
  const savedCampaign = savedCampaigns[activeType]
  const listedCampaign = useMemo(() => campaigns.data?.find(item => item.id === draft.id), [campaigns.data, draft.id])
  const selectedCampaign = listedCampaign ?? savedCampaign
  const canEdit = !selectedCampaign || selectedCampaign.status === 'DRAFT'
  const isDirty = !isDraftSaved

  const saveMutation = useMutation({
    mutationFn: saveBannerDraft,
    onSuccess: async item => {
      setSavedCampaigns(value => ({ ...value, [item.type]: item }))
      setDrafts(value => ({ ...value, [item.type]: { ...value[item.type], id: item.id, linkUrl: item.linkUrl ?? '', file: null } }))
      setSavedFlags(value => ({ ...value, [item.type]: true }))
      setEditedFlags(value => ({ ...value, [item.type]: false }))
      await client.invalidateQueries({ queryKey: ['admin-banners'] })
      void appAlert('배너 시안을 저장했습니다. 실제 공개 전 테스트 미리보기에서 확인해 주세요.', { title: '저장 완료' })
    },
    onError: error => void appAlert(isAxiosError(error) ? String(error.response?.data?.message ?? '입력 내용을 확인하고 다시 시도해 주세요.') : '입력 내용을 확인하고 다시 시도해 주세요.', { title: '저장 실패' }),
  })
  const approveMutation = useMutation({
    mutationFn: approveBanner,
    onSuccess: async item => {
      setSavedCampaigns(value => ({ ...value, [item.type]: item }))
      setSavedFlags(value => ({ ...value, [item.type]: true }))
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
      setDraftGeneration(value => value + 1)
      setDrafts(value => ({ ...value, [activeType]: { ...initialDraft(), type: activeType, ...(activeType === 'AD' ? { title: '', text: '' } : {}) } }))
      setSavedCampaigns(value => ({ ...value, [activeType]: undefined }))
      setSavedFlags(value => ({ ...value, [activeType]: false }))
      await client.invalidateQueries({ queryKey: ['admin-banners'] })
    },
    onError: () => void appAlert('임시 배너를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', { title: '삭제 실패' }),
  })

  useEffect(() => {
    for (const item of Object.values(savedCampaigns)) {
      if (!item) continue
      const refreshed = campaigns.data?.find(campaign => campaign.id === item.id)
      if (refreshed && (refreshed.status !== item.status || refreshed.updatedAt !== item.updatedAt)) {
        setSavedCampaigns(value => ({ ...value, [refreshed.type]: refreshed }))
      }
    }
  }, [campaigns.data, savedCampaigns])

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
    setDrafts(value => ({ ...value, [activeType]: { ...value[activeType], ...patch } }))
    setSavedFlags(value => ({ ...value, [activeType]: false }))
    setEditedFlags(value => ({ ...value, [activeType]: true }))
  }
  const handleSave = () => {
    if (!canEdit || saveMutation.isPending) return
    if (!draft.title.trim() || !draft.startsAt || (draft.type === 'NOTICE' && !draft.text.trim()) || (draft.type === 'AD' && !draft.file && !savedCampaign?.hasImage)) {
      void appAlert('제목, 문구 또는 광고 이미지와 게시 시작 시각을 확인해 주세요.', { title: '입력 확인' })
      return
    }
    saveMutation.mutate({ ...draft, linkUrl: draft.linkUrl.trim() === 'http://' ? '' : draft.linkUrl })
  }
  const handleApprove = async () => {
    if (!draft.id || !isDraftSaved || selectedCampaign?.status !== 'DRAFT' || approveMutation.isPending) return
    const replacementAt = displayDateTime(draft.startsAt)
    if (!await appConfirm(`테스트 미리보기를 확인했습니다. ${replacementAt} (한국 시간)에 이 배너를 실제 방문자에게 공개하시겠습니까?`, { title: '배너 실제 반영' })) return
    approveMutation.mutate(draft.id)
  }
  const confirmDiscard = (type: BannerDraftInput['type']) => !editedFlags[type] || appConfirm('저장하지 않은 변경 내용을 버리시겠습니까?', { title: '변경 내용 버리기' })
  const selectCampaign = async (item: BannerCampaign) => {
    if (!await confirmDiscard(item.type)) return
    setEditedFlags(value => ({ ...value, [item.type]: false }))
    setDraftGeneration(value => value + 1)
    setActiveType(item.type)
    setSavedCampaigns(value => ({ ...value, [item.type]: item }))
    setSavedFlags(value => ({ ...value, [item.type]: true }))
    setDrafts(value => ({ ...value, [item.type]: {
      id: item.id,
      type: item.type,
      title: item.title,
      text: item.text ?? '',
      linkUrl: item.linkUrl ?? '',
      startsAt: inputDateTime(item.startsAt),
      endsAt: inputDateTime(item.endsAt ?? ''),
      file: null,
    } }))
  }
  const startNewDraft = async () => {
    if (!await confirmDiscard(activeType)) return
    setEditedFlags(value => ({ ...value, [activeType]: false }))
    setDraftGeneration(value => value + 1)
    setSavedCampaigns(value => ({ ...value, [activeType]: undefined }))
    setDrafts(value => ({ ...value, [activeType]: { ...initialDraft(), type: activeType, ...(activeType === 'AD' ? { title: '', text: '' } : {}) } }))
    setSavedFlags(value => ({ ...value, [activeType]: false }))
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
  const campaignsList = (campaigns.data ?? []).filter(item => item.type === activeType)
  const campaignSlots = Array.from({ length: 5 }, (_, index) => campaignsList[index])
  const settingsFields = (
    <div className="settings-plain-content">
      <div className="settings-ops-item h-[180px] text-sm">
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">내용</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">{activeType === 'AD' ? '광고 제목과 이미지를 등록합니다.' : '공지 제목과 문구를 입력합니다.'}</p>
          <div className="settings-control-inset mt-auto mb-auto flex flex-col gap-1">
            <input aria-label="배너 제목" placeholder="서비스 안내" maxLength={100} disabled={!canEdit} value={draft.title} onChange={event => changeDraft({ title: event.target.value })} className={INPUT_CLASS} />
            {activeType === 'NOTICE' ? (
              <textarea aria-label="공지 문구" placeholder="공지사항을 확인해 주세요." maxLength={200} disabled={!canEdit} value={draft.text} onChange={event => changeDraft({ text: event.target.value })} className={`${INPUT_CLASS.replace('h-[25px]', 'h-[60px]')} resize-none py-1`} />
            ) : (
              <label className="flex h-[25px] cursor-pointer items-center justify-center gap-1.5 rounded-[4px] border-0 bg-[var(--ui-control)] px-2 text-[13px]/4 font-medium text-ui-white settings-chip-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-35">
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
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">연결 주소</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">선택하면 배너를 눌러 해당 주소로 이동합니다.</p>
          <div className="settings-control-inset mt-auto mb-auto"><input aria-label="연결 주소" disabled={!canEdit} value={draft.linkUrl} onChange={event => changeDraft({ linkUrl: event.target.value })} onBlur={event => { if (!event.currentTarget.value.trim()) changeDraft({ linkUrl: 'http://' }) }} className={INPUT_CLASS} /></div>
        </div>
      </div>
      <div className="settings-ops-item h-[180px] text-sm">
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">교체 일정</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">한국 시간에 실제 배너가 교체됩니다.</p>
          <div className="settings-control-inset mt-auto mb-auto flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[11px] leading-3 text-ui-muted"><span className="inline-flex h-[25px] shrink-0 items-center rounded-[4px] bg-[var(--ui-control)] px-[6px] text-[13px]/4 font-medium text-ui-white">시작</span><DateTimeField label="교체 시작" disabled={!canEdit} value={draft.startsAt} onChange={startsAt => changeDraft({ startsAt })} key={`${draftGeneration}-${activeType}-${draft.id ?? 'new'}-starts`} /></label>
            <label className="flex items-center gap-1 text-[11px] leading-3 text-ui-muted"><span className="inline-flex h-[25px] shrink-0 items-center rounded-[4px] bg-[var(--ui-control)] px-[6px] text-[13px]/4 font-medium text-ui-white">종료</span><DateTimeField label="교체 종료" disabled={!canEdit} value={draft.endsAt} onChange={endsAt => changeDraft({ endsAt })} key={`${draftGeneration}-${activeType}-${draft.id ?? 'new'}-ends`} /></label>
          </div>
        </div>
      </div>
      <div className="settings-ops-item h-[180px] text-sm">
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">테스트 · 승인</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">테스트 미리보기는 관리자에게만 보입니다.</p>
          <div className="settings-control-inset mt-auto mb-auto flex flex-col gap-2">
            <button type="button" disabled={!canEdit || saveMutation.isPending || !isDirty} onClick={handleSave} className={SETTINGS_ACTION_CLASS}><SaveIcon aria-hidden="true" className="h-4 w-4" />시안 저장</button>
            <button type="button" disabled={!draft.id || !isDraftSaved || selectedCampaign?.status !== 'DRAFT' || approveMutation.isPending} onClick={() => void handleApprove()} className={SETTINGS_ACTION_CLASS}>{isStartingSoon ? '승인 후 예약' : '승인 후 실제 반영'}</button>
            {draft.id && selectedCampaign?.status === 'DRAFT' && <button type="button" disabled={deleteMutation.isPending} onClick={() => void handleDelete()} className={SETTINGS_ACTION_CLASS}>임시 시안 삭제</button>}
          </div>
        </div>
      </div>
    </div>
  )

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
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-1">
                  <div className="flex flex-col gap-5">
                    <BannerPreview draft={draft} savedCampaign={selectedCampaign} visitorStatus={activeBanner.isError
                      ? '실제 게시 상태를 불러오지 못했습니다.'
                      : activeBanner.isPending ? '실제 게시 상태를 불러오는 중입니다.'
                        : activeBanner.data?.active ? `현재 게시 중: ${activeBanner.data.title ?? '배너'}` : '현재 게시 중인 배너가 없습니다.'} />
                    <div className="flex shrink-0 flex-col overflow-hidden">
                      <div className="flex h-8 shrink-0 items-center justify-between border-b border-ui-white/10">
                        <span className="font-medium">배너 슬롯 <span className="text-ui-muted">{campaigns.isError && campaigns.data === undefined ? '—' : Math.min(campaignsList.length, 5)}/5</span></span>
                        <button type="button" onClick={() => void startNewDraft()} className="h-[25px] rounded-[4px] border-0 bg-[var(--ui-control)] px-2 text-[13px] text-ui-white settings-chip-hover">새 배너</button>
                      </div>
                      <p role="status" className={`m-0 py-2 text-xs ${campaigns.isError && campaigns.data === undefined ? 'text-status-error-text' : 'text-ui-muted'}`}>{campaigns.isError && campaigns.data === undefined ? '배너 목록을 불러오지 못했습니다.' : '게시 중인 배너는 다음 예약 시작 시각에 교체됩니다.'}</p>
                      <div className="flex flex-col">
                        {campaignSlots.map((item, index) => {
                          const unavailable = campaigns.isError && campaigns.data === undefined
                          const loading = campaigns.isPending && campaigns.data === undefined
                          const emptyLabel = unavailable ? '—' : loading ? '불러오는 중…' : '빈 슬롯'
                          return (
                            <button key={item?.id ?? `empty-${activeType}-${index}`} type="button" disabled={!item} onClick={() => { if (item) void selectCampaign(item) }} aria-pressed={item ? draft.id === item.id : undefined} aria-label={item ? `${statusLabel(item.status)} 배너 ${item.title} 편집` : `배너 슬롯 ${index + 1} · ${emptyLabel}`} className={`flex h-12 w-full items-center gap-3 border-0 border-b border-ui-white/10 px-2 text-left text-[13px] ${item ? `cursor-pointer hover:bg-[var(--brand)]/10 ${draft.id === item.id ? 'bg-[var(--brand)]/20' : 'bg-transparent'}` : 'cursor-default bg-transparent text-ui-muted'}`}>
                              <span className="w-6 shrink-0 text-center tabular-nums text-ui-muted">{index + 1}</span>
                              <span className="min-w-0 flex-1 truncate">
                                {item ? activeType === 'AD' ? item.hasImage ? `${item.title} · 이미지 등록됨` : `${item.title} · 이미지 없음` : `${item.title}${item.text ? ` · ${item.text}` : ''}` : <span className="text-ui-muted">{emptyLabel}</span>}
                              </span>
                              {item && <span className="inline-flex h-[25px] shrink-0 items-center rounded-[4px] bg-[var(--ui-control)] px-2 text-[13px] leading-none text-ui-white">{statusLabel(item.status)}</span>}
                            </button>
                          )
                        })}
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
                pageLabel="Banner"
                showPreferenceActions={false}
                fixedSideTab
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                isOnLeft={isSettingsOnLeft}
                onToggleSide={toggleSettingsSide}
                sectionOrder={['adminBannerNotice', 'adminBannerAd']}
                onSectionChange={section => {
                  if (section === 'adminBannerAd') setActiveType('AD')
                  if (section === 'adminBannerNotice') setActiveType('NOTICE')
                }}
              >
                <SettingsPanelGroup section="adminBannerAd">{settingsFields}</SettingsPanelGroup>
                <SettingsPanelGroup section="adminBannerNotice">{settingsFields}</SettingsPanelGroup>
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
