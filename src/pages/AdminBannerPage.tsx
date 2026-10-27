import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import BannerPreview from '@/components/BannerPreview'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import ScrollArea from '@/components/ScrollArea'
import IntervalDial from '@/components/IntervalDial'
import BannerTypeBadge from '@/components/BannerTypeBadge'
import PageMainFrame from '@/components/PageMainFrame'
import { InfoPageHeading, InfoSection } from '@/components/InfoDocument'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import ScreenshotModal from '@/components/ScreenshotModal'
import { useSession } from '@/hooks/useSession'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { screenshotElementToClipboard, copyDataUrlToClipboard } from '@/utils/screenshotToClipboard'
import { isAdminSession } from '@/utils/adminAccess'
import { appAlert, appConfirm, appWarnConfirm } from '@/utils/appDialogBus'
import { approveBanner, adminBannerImageUrl, cancelBannerSchedule, deleteBannerCampaign, endBannerCampaign, getAdminBanners, getBannerRotationSetting, saveBannerDraft, saveBannerRotationSetting, type BannerCampaign, type BannerDraftInput } from '@/api/adminBanners'
import { CloseIcon, HistoryIcon, SaveIcon, UploadIcon } from '@/components/icons/AppIcons'
import BannerDatePicker from '@/components/BannerDatePicker'
import BannerTimePicker from '@/components/BannerTimePicker'

const INPUT_CLASS = 'h-[25px] w-full min-w-0 rounded-[4px] border border-transparent bg-[var(--ui-control)] px-2 text-[13px]/4 font-medium text-ui-white outline-none focus:border-brand placeholder:text-ui-muted disabled:opacity-35'
const SETTINGS_ACTION_CLASS = 'flex h-[25px] w-fit shrink-0 items-center justify-center gap-1.5 rounded-[4px] border-0 bg-[var(--ui-control)] text-[13px] leading-[1.3] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-35'
const EDITOR_ACTION_CLASS = 'flex h-[25px] w-[90px] shrink-0 items-center justify-center gap-1.5 rounded-[4px] border-0 px-1.5 text-[13px]/4 font-semibold text-ui-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35'
type SaveMutationVariables = { draft: BannerDraftInput; wasConfirmed: boolean }

function kstInputValue(epoch = Date.now()): string {
  return new Date(epoch).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T').slice(0, 16)
}

function inputDateTime(value: string): string {
  return value ? value.slice(0, 16) : ''
}

function addDaysToDateTime(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return ''
  const [, year, month, day, hour, minute] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + days, Number(hour), Number(minute)))
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function formatDatePart(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}/)
  if (!match) return ''
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00+09:00`)
  const weekday = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(date)
  return `${match[1]}. ${match[2]}. ${match[3]}. (${weekday})`
}

function formatTimePart(value: string): string {
  const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/)
  return match?.[1] ?? ''
}

function DateTimeField({ label, value, disabled, onChange, dateAnimationKey }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void; dateAnimationKey?: number }) {
  const selectedDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null

  return (
    <div className="flex h-[25px] w-full min-w-0 items-center gap-0.5">
      <BannerDatePicker
        label={label}
        displayValue={formatDatePart(value)}
        selectedDate={selectedDate}
        disabled={disabled}
        dateAnimationKey={dateAnimationKey}
        onSelect={date => {
          const nextValue = `${date}T00:00`
          onChange(nextValue)
        }}
      />
      <BannerTimePicker
        label={label}
        value={formatTimePart(value)}
        disabled={disabled || !selectedDate}
        onChange={time => {
          const nextValue = `${selectedDate}T${time}`
          onChange(nextValue)
        }}
      />
    </div>
  )
}

function formatScheduledAt(value: string): string {
  // 서버의 LocalDateTime은 시간대가 없는 문자열이므로 KST로 해석한다.
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const date = new Date(hasTimezone ? value : `${value}+09:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function isScheduledStart(value: string): boolean {
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const timestamp = Date.parse(hasTimezone ? value : `${value}+09:00`)
  return Number.isFinite(timestamp) && timestamp > Date.now()
}

function scheduleValidationMessage(startsAt: string, endsAt: string): string {
  const parse = (value: string) => {
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    const timestamp = Date.parse(hasTimezone ? value : `${value}+09:00`)
    return Number.isFinite(timestamp) ? timestamp : null
  }
  const start = parse(startsAt)
  const end = parse(endsAt)
  if (start === null || end === null) return '게시 시작·종료 시각을 확인해 주세요.'
  if (end <= start) return '종료 시각은 시작 시각보다 뒤여야 합니다.'
  if (end <= Date.now()) return '종료 시각은 현재 시각보다 뒤여야 합니다.'
  return ''
}

function formatStartCountdown(value: string): string {
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const timestamp = Date.parse(hasTimezone ? value : `${value}+09:00`)
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return ''
  const remaining = timestamp - Date.now()
  if (remaining >= 86_400_000) return `${Math.ceil(remaining / 86_400_000)}일 뒤`
  const hours = Math.max(1, Math.ceil(remaining / 3_600_000))
  return `${hours}시간 뒤`
}

function compareCampaignEndAtLatestFirst(a: BannerCampaign, b: BannerCampaign): number {
  const timestamp = (value: string | null) => {
    if (!value) return Number.NEGATIVE_INFINITY
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    const parsed = Date.parse(hasTimezone ? value : `${value}+09:00`)
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
  }
  return timestamp(b.endsAt) - timestamp(a.endsAt)
}

function fitsNoticeBanner(text: string, textScalePercent = 100, textBold = false, sourceBody?: HTMLElement): boolean {
  if (!text) return true
  const body = sourceBody ?? document.querySelector<HTMLElement>('[data-banner-draft-preview] [data-banner-text-body]') ?? document.querySelector<HTMLElement>('[data-ad-banner-slot] [data-banner-text-body]')
  const bannerSlot = body?.closest<HTMLElement>('[data-ad-banner-slot]') ?? (sourceBody ? null : document.querySelector<HTMLElement>('[data-ad-banner-slot]'))
  if (!body || (!bannerSlot && !sourceBody)) return true

  const bodyStyle = getComputedStyle(body)
  // 목록 미리보기는 실제 배너 자리 밖에 있지만 항상 728×90 규격으로 그린다.
  const bannerHeight = Number(bannerSlot?.dataset.adBannerSlot?.split('x')[1] ?? 90)
  const compact = bannerHeight < 90
  const fontSize = (compact ? 10 : 12) * textScalePercent / 100
  const lineHeight = fontSize * 1.25
  const titleLineHeight = (compact ? 12 : 14) * 1.25
  const maxLines = Math.max(1, Math.floor((bannerHeight - titleLineHeight) / lineHeight))
  if (!maxLines || !lineHeight) return true

  const measure = document.createElement('p')
  // A zero-width sentinel makes a trailing newline occupy the blank line the textarea would create.
  measure.textContent = `${text}\u200b`
  Object.assign(measure.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    display: 'block',
    width: `${body.getBoundingClientRect().width}px`,
    margin: '0',
    overflow: 'visible',
    fontFamily: bodyStyle.fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: textBold ? '700' : '400',
    fontStyle: bodyStyle.fontStyle,
    lineHeight: `${lineHeight}px`,
    letterSpacing: bodyStyle.letterSpacing,
    whiteSpace: bodyStyle.whiteSpace,
    wordBreak: bodyStyle.wordBreak,
    overflowWrap: bodyStyle.overflowWrap,
    textIndent: bodyStyle.textIndent,
    visibility: 'hidden',
  })
  document.body.append(measure)
  const renderedSize = measure.getBoundingClientRect()
  const fitsVisibleArea = renderedSize.height <= maxLines * lineHeight + 0.5 && measure.scrollWidth <= measure.clientWidth + 1
  measure.remove()
  return fitsVisibleArea
}

function fitsNoticeTitle(title: string, width: number, font: string): boolean {
  if (!title || width <= 0) return true
  const probe = document.createElement('span')
  probe.style.cssText = `position:fixed;left:-10000px;top:0;display:inline-block;width:max-content;white-space:pre;visibility:hidden;font:${font};font-kerning:normal;`
  probe.textContent = title
  document.body.append(probe)
  const textWidth = probe.getBoundingClientRect().width
  probe.remove()
  return textWidth <= width
}

function truncateNoticeTitle(title: string, width: number, font: string): string {
  let fitted = ''
  for (const character of title) {
    const next = fitted + character
    if (!fitsNoticeTitle(next, width, font)) break
    fitted = next
  }
  return fitted
}

function initialDraft(): BannerDraftInput {
  return { id: null, type: 'NOTICE', title: '', text: '', textScalePercent: 100, textBold: false, linkUrl: 'https://', startsAt: kstInputValue(), endsAt: '', file: null }
}

function normalizeBannerLink(value: string): string {
  const link = value.trim()
  if (!link || /^https?:\/\/$/i.test(link)) return ''
  if (/^https?:\/\//i.test(link) || link.startsWith('/')) return link
  return `https://${link}`
}

function campaignImageUrl(campaign: BannerCampaign) {
  return adminBannerImageUrl(campaign.id, campaign.updatedAt)
}

interface BannerTextMetrics { width: number; titleWidth: number; titleFont: string; fontSize: number; lineHeight: number; maxLines: number; inputHeight: number }

function BannerDraftSlot({ draft, savedCampaign, onMetricsChange }: { draft: BannerDraftInput; savedCampaign?: BannerCampaign; onMetricsChange: (metrics: BannerTextMetrics) => void }) {
  const previewSlotRef = useRef<HTMLDivElement>(null)
  const localImageUrl = useMemo(() => draft.file ? URL.createObjectURL(draft.file) : null, [draft.file])
  useEffect(() => () => { if (localImageUrl) URL.revokeObjectURL(localImageUrl) }, [localImageUrl])
  const imageUrl = localImageUrl ?? (savedCampaign?.hasImage ? campaignImageUrl(savedCampaign) : null)
  useEffect(() => {
    const bannerSlot = previewSlotRef.current
    const textArea = bannerSlot?.querySelector<HTMLElement>('[data-banner-text-area]')
    const title = bannerSlot?.querySelector<HTMLElement>('[data-banner-title]')
    const textBody = bannerSlot?.querySelector<HTMLElement>('[data-banner-text-body]')
    if (!textArea) return
    const updateMetrics = () => {
      const titleStyle = title ? getComputedStyle(title) : null
      const bodyStyle = textBody ? getComputedStyle(textBody) : null
      const bannerHeight = Number(bannerSlot?.dataset.adBannerSlot?.split('x')[1] ?? 90)
      const lineHeight = Number.parseFloat(bodyStyle?.lineHeight ?? '15')
      const maxLines = Number(textBody?.dataset.bannerMaxLines ?? Math.floor((bannerHeight - (bannerHeight < 90 ? 15 : 17.5)) / lineHeight))
      onMetricsChange({
        width: textArea.getBoundingClientRect().width,
        titleWidth: title?.getBoundingClientRect().width ?? 0,
        // CanvasRenderingContext2D.font does not accept CSS font shorthand with a line-height.
        // Build a valid canvas font so title input limits match the visible preview width.
        titleFont: titleStyle ? `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}` : '700 14px sans-serif',
        fontSize: Number.parseFloat(bodyStyle?.fontSize ?? '12'),
        lineHeight,
        maxLines,
        // Fit the textarea to the rows the live banner preview can display, including padding and border.
        inputHeight: Math.ceil(maxLines * lineHeight + 14),
      })
    }
    updateMetrics()
    const observer = new ResizeObserver(updateMetrics)
    observer.observe(textArea)
    if (title) observer.observe(title)
    if (textBody) observer.observe(textBody)
    return () => observer.disconnect()
  }, [draft.type, draft.textScalePercent, onMetricsChange])
  return (
    <div ref={previewSlotRef} aria-hidden="true" inert data-ad-banner-slot="728x90" data-banner-draft-preview="" className="pointer-events-none fixed left-[-10000px] top-0 h-[90px] w-[728px] overflow-hidden">
      <BannerPreview type={draft.type} title={draft.title} text={draft.text} imageUrl={imageUrl} size={{ width: 728, height: 90 }} textScalePercent={draft.textScalePercent} textBold={draft.textBold} emptyMessage="광고 이미지를 선택해 주세요." className="border-0 bg-transparent" framed={false} />
    </div>
  )
}

function BannerEditorPreviews({ draft, campaign }: { draft: BannerDraftInput; campaign?: BannerCampaign }) {
  const [draftImage, setDraftImage] = useState<{ file: File; url: string } | null>(null)
  useEffect(() => {
    if (!draft.file) return
    const file = draft.file
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setDraftImage({ file, url: reader.result })
    }
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [draft.file])

  return (
    <div className="mx-auto w-full max-w-[728px] min-w-0">
      <BannerPreview
        type={draft.type}
        title={draft.title}
        text={draft.text}
        imageUrl={draftImage?.file === draft.file ? draftImage.url : campaign?.hasImage ? campaignImageUrl(campaign) : null}
        textScalePercent={draft.textScalePercent}
        textBold={draft.textBold}
        emptyMessage="광고 이미지를 선택해 주세요."
      />
    </div>
  )
}

export default function AdminBannerPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: session, isLoading } = useSession()
  const isAdmin = isAdminSession(session)
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsPanelSide()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [activeType, setActiveType] = useState<BannerDraftInput['type']>('NOTICE')
  const [showCampaignList, setShowCampaignList] = useState(() => (location.state as { bannerCampaignView?: string } | null)?.bannerCampaignView !== 'editor')
  const [bannerTextMetrics, setBannerTextMetrics] = useState<BannerTextMetrics>({ width: 640, titleWidth: 600, titleFont: '700 14px sans-serif', fontSize: 12, lineHeight: 15, maxLines: 4, inputHeight: 74 })
  const [endDatePresetGeneration, setEndDatePresetGeneration] = useState(0)
  const [rotationDraft, setRotationDraft] = useState<number | null>(null)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)
  const [noticeLimitMessage, setNoticeLimitMessage] = useState('')
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
  const updateBannerTextMetrics = useCallback((metrics: BannerTextMetrics) => {
    const next = { ...metrics, width: Math.round(metrics.width) }
    setBannerTextMetrics(previous => Object.keys(next).every(key => previous[key as keyof BannerTextMetrics] === next[key as keyof BannerTextMetrics]) ? previous : next)
  }, [])

  const pushCampaignView = (view: 'list' | 'editor') => {
    const currentState = location.state && typeof location.state === 'object' ? location.state as Record<string, unknown> : {}
    navigate(`${location.pathname}${location.search}${location.hash}`, { state: { ...currentState, bannerCampaignView: view } })
  }

  useEffect(() => {
    setShowCampaignList((location.state as { bannerCampaignView?: string } | null)?.bannerCampaignView !== 'editor')
  }, [location.state])

  const campaigns = useQuery({ queryKey: ['admin-banners'], queryFn: ({ signal }) => getAdminBanners(signal), enabled: isAdmin, retry: false, refetchInterval: showCampaignList ? 30_000 : false })
  const rotationSetting = useQuery({ queryKey: ['admin-banners', 'rotation-setting'], queryFn: ({ signal }) => getBannerRotationSetting(signal), enabled: isAdmin, retry: false })
  const savedRotationInterval = rotationSetting.data?.intervalSeconds ?? 10
  const rotationInterval = rotationDraft ?? savedRotationInterval
  const isRotationDirty = rotationInterval !== savedRotationInterval
  const draft = drafts[activeType]
  const displayedEndAt = draft.endsAt || addDaysToDateTime(draft.startsAt, 30)
  const scheduleError = scheduleValidationMessage(draft.startsAt, displayedEndAt)
  const endPresets = [
    { key: '7d', label: '7일', value: addDaysToDateTime(draft.startsAt, 7) },
    { key: '14d', label: '14일', value: addDaysToDateTime(draft.startsAt, 14) },
    { key: '30d', label: '30일', value: addDaysToDateTime(draft.startsAt, 30) },
  ]
  const selectedEndPreset = endPresets.find(preset => preset.value && preset.value === displayedEndAt)?.key
  const isDraftSaved = savedFlags[activeType]
  const savedCampaign = savedCampaigns[activeType]
  const listedCampaign = useMemo(() => campaigns.data?.find(item => item.id === draft.id), [campaigns.data, draft.id])
  const selectedCampaign = listedCampaign ?? savedCampaign
  const canEdit = true
  const isDirty = !isDraftSaved
  const isDraftValid = Boolean(draft.title.trim() && draft.startsAt && !scheduleError && (draft.type === 'NOTICE' ? draft.text.trim() : draft.file || savedCampaign?.hasImage))
  const saveButtonLabel = selectedCampaign?.status === 'LIVE' || selectedCampaign?.status === 'SCHEDULED'
    ? '저장'
    : selectedCampaign?.status === 'ENDED'
      ? isScheduledStart(draft.startsAt) ? '재예약' : '다시 게시'
      : isScheduledStart(draft.startsAt) ? '예약' : '게시'

  const saveMutation = useMutation({
    mutationFn: async ({ draft }: SaveMutationVariables) => {
      const item = await saveBannerDraft(draft)
      if (item.status !== 'DRAFT') return { item, publishError: null }
      try {
        return { item: await approveBanner(item.id), publishError: null }
      } catch (publishError) {
        return { item, publishError }
      }
    },
    meta: { skipGlobalError: true },
    onSuccess: async ({ item, publishError }, variables) => {
      setSavedCampaigns(value => ({ ...value, [item.type]: item }))
      setDrafts(value => ({ ...value, [item.type]: { ...value[item.type], id: item.id, linkUrl: item.linkUrl ?? 'https://', file: null } }))
      setSavedFlags(value => ({ ...value, [item.type]: true }))
      setEditedFlags(value => ({ ...value, [item.type]: false }))
      pushCampaignView('list')
      setShowCampaignList(true)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-banners'] }),
        client.invalidateQueries({ queryKey: ['banners', 'active'] }),
      ])
      if (publishError) {
        void appAlert('내용은 대기 목록에 보관했습니다. 대기 목록에서 다시 게시하거나 예약해 주세요.', { title: '게시 실패' })
        return
      }
      if (variables.wasConfirmed) return
      const message = item.status === 'SCHEDULED' ? '예약 배너 내용을 저장했습니다.' : '배너 내용을 저장했습니다.'
      void appAlert(message, { title: '저장 완료' })
    },
    onError: error => {
      void client.invalidateQueries({ queryKey: ['admin-banners'] })
      void appAlert(isAxiosError(error) ? String(error.response?.data?.detail ?? error.response?.data?.message ?? '입력 내용을 확인하고 다시 시도해 주세요.') : '입력 내용을 확인하고 다시 시도해 주세요.', { title: '게시 또는 저장 실패' })
    },
  })
  const cancelScheduleMutation = useMutation({
    mutationFn: cancelBannerSchedule,
    onSuccess: async item => {
      client.setQueryData<BannerCampaign[]>(['admin-banners'], current => current?.map(campaign => campaign.id === item.id ? item : campaign))
      setSavedCampaigns(value => ({ ...value, [item.type]: item }))
      setDrafts(value => ({ ...value, [item.type]: draftFromCampaign(item) }))
      setSavedFlags(value => ({ ...value, [item.type]: true }))
      setEditedFlags(value => ({ ...value, [item.type]: false }))
      pushCampaignView('list')
      setShowCampaignList(true)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-banners'] }),
        client.invalidateQueries({ queryKey: ['banners', 'active'] }),
      ])
    },
    onError: error => void appAlert(isAxiosError(error) ? String(error.response?.data?.detail ?? error.response?.data?.message ?? '예약을 취소하지 못했습니다. 다시 시도해 주세요.') : '예약을 취소하지 못했습니다. 다시 시도해 주세요.', { title: '예약 취소 실패' }),
  })
  const endMutation = useMutation({
    mutationFn: endBannerCampaign,
    meta: { skipGlobalError: true },
    onSuccess: async item => {
      client.setQueryData<BannerCampaign[]>(['admin-banners'], current => current?.map(campaign => campaign.id === item.id ? item : campaign))
      setSavedCampaigns(value => ({ ...value, [item.type]: item }))
      setDrafts(value => ({ ...value, [item.type]: draftFromCampaign(item) }))
      setSavedFlags(value => ({ ...value, [item.type]: true }))
      setEditedFlags(value => ({ ...value, [item.type]: false }))
      pushCampaignView('list')
      setShowCampaignList(true)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-banners'] }),
        client.invalidateQueries({ queryKey: ['banners', 'active'] }),
      ])
    },
    onError: error => {
      const status = isAxiosError(error) ? error.response?.status : undefined
      const fallback = status === 404
        ? '배너 종료 기능을 찾을 수 없습니다. 서버 업데이트 후 다시 시도해 주세요.'
        : status === 409
          ? '게재 중인 배너만 종료할 수 있습니다.'
          : '배너를 종료하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      const message = isAxiosError(error) ? error.response?.data?.detail ?? error.response?.data?.message ?? fallback : fallback
      void appAlert(String(message), { title: '종료 실패' })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteBannerCampaign,
    onSuccess: async () => {
      setDraftGeneration(value => value + 1)
      setDrafts(value => ({ ...value, [activeType]: { ...initialDraft(), type: activeType, ...(activeType === 'AD' ? { title: '', text: '' } : {}) } }))
      setSavedCampaigns(value => ({ ...value, [activeType]: undefined }))
      setSavedFlags(value => ({ ...value, [activeType]: false }))
      setEditedFlags(value => ({ ...value, [activeType]: false }))
      pushCampaignView('list')
      setShowCampaignList(true)
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin-banners'] }),
        client.invalidateQueries({ queryKey: ['banners', 'active'] }),
      ])
    },
    onError: () => void appAlert('배너를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', { title: '삭제 실패' }),
  })
  const saveRotationSettingMutation = useMutation({
    mutationFn: saveBannerRotationSetting,
    meta: { skipGlobalError: true },
    onSuccess: async setting => {
      client.setQueryData(['admin-banners', 'rotation-setting'], setting)
      setRotationDraft(null)
      await client.invalidateQueries({ queryKey: ['banners', 'active'] })
    },
    onError: () => void appAlert('배너 전환 간격을 저장하지 못했습니다. 다시 시도해 주세요.', { title: '저장 실패' }),
  })
  const handleDiscardRotationSetting = async () => {
    if (!isRotationDirty || saveRotationSettingMutation.isPending) return
    if (await appConfirm('배너 전환 간격을 저장된 값으로 되돌리시겠습니까?', { title: '되돌리기' })) {
      setRotationDraft(null)
    }
  }
  const handleSaveRotationSetting = async () => {
    if (!isRotationDirty || rotationSetting.isPending || saveRotationSettingMutation.isPending) return
    if (await appConfirm(`배너 전환 간격을 ${rotationInterval}초로 저장하시겠습니까?`, { title: '저장하기' })) {
      saveRotationSettingMutation.mutate(rotationInterval)
    }
  }
  const rotationHeaderActions = (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="초기화" data-hint="저장값으로 되돌리기" disabled={rotationSetting.isPending || saveRotationSettingMutation.isPending} onClick={() => void handleDiscardRotationSetting()} className="group relative flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-ui-muted outline-none transition-colors hover:text-brand focus-visible:text-brand disabled:opacity-50">
        <HistoryIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" aria-label="저장" data-hint="변경값으로 저장하기" disabled={rotationSetting.isPending || saveRotationSettingMutation.isPending} onClick={() => void handleSaveRotationSetting()} className="group relative flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-ui-muted outline-none transition-colors hover:text-brand focus-visible:text-brand disabled:opacity-50">
        {isRotationDirty && <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand" />}
        <SaveIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )

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
  const handleSave = async () => {
    if (!canEdit || saveMutation.isPending) return
    if (scheduleError) {
      void appAlert(scheduleError, { title: '게시 일정 확인' })
      return
    }
    if (activeType === 'NOTICE' && !fitsNoticeBanner(draft.text, draft.textScalePercent, draft.textBold)) {
      setNoticeLimitMessage('현재 내용이 배너 표시 한도를 넘습니다. 내용을 줄인 뒤 저장해 주세요.')
      return
    }
    if (!draft.title.trim() || !draft.startsAt || (draft.type === 'NOTICE' && !draft.text.trim()) || (draft.type === 'AD' && !draft.file && !savedCampaign?.hasImage)) {
      void appAlert('제목, 문구 또는 광고 이미지와 게시 시작 시각을 확인해 주세요.', { title: '입력 확인' })
      return
    }
    const willPublish = !selectedCampaign || selectedCampaign.status === 'DRAFT' || selectedCampaign.status === 'ENDED'
    if (willPublish) {
      const action = selectedCampaign?.status === 'ENDED'
        ? isScheduledStart(draft.startsAt) ? '재예약' : '다시 게시'
        : isScheduledStart(draft.startsAt) ? '예약' : '게시'
      const confirmationMessage = action === '예약' || action === '재예약'
        ? `이 시각에 배너 공개를 ${action}하시겠습니까?`
        : `이 시각에 배너를 모든 방문자에게 ${action === '다시 게시' ? '다시 공개' : '공개'}하시겠습니까?`
      if (!await appConfirm(`[${formatScheduledAt(draft.startsAt)}]\n${confirmationMessage}`, { title: `배너 ${action}` })) return
    }
    saveMutation.mutate({ draft: { ...draft, endsAt: displayedEndAt, linkUrl: normalizeBannerLink(draft.linkUrl) }, wasConfirmed: willPublish })
  }
  const confirmDiscard = (type: BannerDraftInput['type']) => !editedFlags[type] || appConfirm('저장하지 않은 변경 내용을 버리시겠습니까?', { title: '변경 내용 버리기' })
  const draftFromCampaign = (item: BannerCampaign, prepareForRepublish = false): BannerDraftInput => {
    const startsAt = prepareForRepublish ? kstInputValue() : inputDateTime(item.startsAt)
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      text: item.text ?? '',
      textScalePercent: item.textScalePercent,
      textBold: item.textBold,
      linkUrl: item.linkUrl ?? 'https://',
      startsAt,
      endsAt: prepareForRepublish ? addDaysToDateTime(startsAt, 30) : inputDateTime(item.endsAt ?? ''),
      file: null,
    }
  }
  const discardDraft = (type: BannerDraftInput['type']) => {
    const current = drafts[type]
    const saved = current.id
      ? campaigns.data?.find(item => item.id === current.id) ?? savedCampaigns[type]
      : undefined
    setEditedFlags(value => ({ ...value, [type]: false }))
    setDraftGeneration(value => value + 1)
    setSavedCampaigns(value => ({ ...value, [type]: saved }))
    setSavedFlags(value => ({ ...value, [type]: Boolean(saved) }))
    setDrafts(value => ({
      ...value,
      [type]: saved ? draftFromCampaign(saved) : { ...initialDraft(), type, ...(type === 'AD' ? { title: '', text: '' } : {}) },
    }))
  }
  const openCampaignList = async () => {
    if (!showCampaignList && !await confirmDiscard(activeType)) return
    if (!showCampaignList && editedFlags[activeType]) discardDraft(activeType)
    if (!showCampaignList) pushCampaignView('list')
    setShowCampaignList(true)
  }
  const selectCampaign = async (item: BannerCampaign) => {
    if (!await confirmDiscard(item.type)) return false
    if (showCampaignList) pushCampaignView('editor')
    setEditedFlags(value => ({ ...value, [item.type]: false }))
    setDraftGeneration(value => value + 1)
    setActiveType(item.type)
    setShowCampaignList(false)
    setSavedCampaigns(value => ({ ...value, [item.type]: item }))
    const prepareForRepublish = item.status === 'ENDED'
    setSavedFlags(value => ({ ...value, [item.type]: !prepareForRepublish }))
    setDrafts(value => ({ ...value, [item.type]: draftFromCampaign(item, prepareForRepublish) }))
    return true
  }
  const startNewDraft = async (type: BannerDraftInput['type']) => {
    const affectedTypes = [...new Set([activeType, type])]
    for (const affectedType of affectedTypes) {
      if (!await confirmDiscard(affectedType)) return
    }
    for (const affectedType of affectedTypes) {
      if (editedFlags[affectedType]) discardDraft(affectedType)
    }
    if (showCampaignList) pushCampaignView('editor')
    setDraftGeneration(value => value + 1)
    setEditedFlags(value => ({ ...value, [type]: false }))
    setSavedFlags(value => ({ ...value, [type]: false }))
    setSavedCampaigns(value => ({ ...value, [type]: undefined }))
    setDrafts(value => ({
      ...value,
      [type]: { ...initialDraft(), type, ...(type === 'AD' ? { title: '', text: '' } : {}) },
    }))
    setActiveType(type)
    setShowCampaignList(false)
  }
  const openType = async (type: BannerDraftInput['type']) => {
    await startNewDraft(type)
  }
  const handleDelete = async () => {
    if (!draft.id || selectedCampaign?.status !== 'ENDED') return
    if (await appWarnConfirm('종료된 이 배너를 삭제하시겠습니까?', { title: '배너 삭제' })) deleteMutation.mutate(draft.id)
  }
  const handleEnd = async () => {
    if (!draft.id || selectedCampaign?.status !== 'LIVE' || isDirty) return
    if (await appWarnConfirm('현재 게재 중인 배너를 지금 종료하시겠습니까?', { title: '배너 종료' })) endMutation.mutate(draft.id)
  }
  const handleCancelScheduled = async () => {
    if (!draft.id || selectedCampaign?.status !== 'SCHEDULED' || isDirty) return
    if (await appConfirm('예약을 취소하시겠습니까? 자동 게시가 중단되고 배너는 미예약 상태로 보관됩니다.', { title: '예약 취소' })) cancelScheduleMutation.mutate(draft.id)
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

  const campaignsList = campaigns.data ?? []
  const postedCampaigns = campaignsList.filter(item => item.status === 'LIVE').sort(compareCampaignEndAtLatestFirst)
  const pendingCampaigns = campaignsList.filter(item => item.status === 'SCHEDULED' || item.status === 'DRAFT').sort(compareCampaignEndAtLatestFirst)
  const endedCampaigns = campaignsList.filter(item => item.status === 'ENDED').sort(compareCampaignEndAtLatestFirst)
  const isMutating = saveMutation.isPending || cancelScheduleMutation.isPending || endMutation.isPending || deleteMutation.isPending
  const renderCampaignCards = (items: BannerCampaign[], emptyMessage: string) => {
    if (campaigns.isPending) return <p role="status" className="m-0">배너 목록을 불러오는 중입니다.</p>
    if (campaigns.isError && campaigns.data === undefined) return <p role="alert" className="m-0">배너 목록을 불러오지 못했습니다.</p>
    if (!items.length) return <p role="status" className="m-0">{emptyMessage}</p>
    return (
      <div className="flex flex-col gap-1">
        {items.map(item => (
          <div key={item.id} data-banner-campaign-card="" className="flex w-full flex-col gap-2 border border-ui-border bg-ui-panel p-3">
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <BannerTypeBadge type={item.type} size="normal" />
                <span className="max-w-[240px] truncate font-medium text-ui-white">{item.title}</span>
                {item.status === 'SCHEDULED' && <span className="shrink-0 text-xs text-ui-muted">{formatStartCountdown(item.startsAt)}</span>}
                {item.status === 'DRAFT' && <span className="shrink-0 text-xs text-ui-muted">미예약</span>}
              </span>
              <span className="tabular-nums text-ui-muted">{item.status === 'DRAFT' ? '게시 기간: 미정' : `게시 기간: ${formatScheduledAt(item.startsAt)} ~ ${item.endsAt ? formatScheduledAt(item.endsAt) : '종료 없음'}`}</span>
            </div>
            <button type="button" disabled={isMutating} onClick={() => void selectCampaign(item)} aria-label={`${item.type === 'AD' ? '광고' : '공지'} 배너 ${item.title} 편집`} className="mx-auto flex h-[90px] w-full max-w-[728px] items-center justify-center overflow-hidden border-0 bg-transparent p-0 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand disabled:cursor-wait">
              <BannerPreview type={item.type} title={item.title} text={item.text ?? ''} imageUrl={item.hasImage ? campaignImageUrl(item) : null} textScalePercent={item.textScalePercent} textBold={item.textBold} />
            </button>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      {isAdmin && <BannerDraftSlot draft={draft} savedCampaign={selectedCampaign} onMetricsChange={updateBannerTextMetrics} />}
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => { void campaigns.refetch() }}
            isRefreshing={campaigns.isFetching}
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
              <>
                <Toolbar>
                  <ToolbarModeText page="ADMIN" label="BANNER" />
                </Toolbar>
                <PageMainFrame scrollable={false} className="p-0">
                  <div className="relative z-10 shrink-0 bg-ui-background px-6 pt-6">
                    <article aria-label="배너 운영" className="mx-auto w-full max-w-4xl">
                    <InfoPageHeading
                      flushBottom
                      title="배너 운영"
                      summary="목록에서 공지·광고를 확인하거나 새 배너를 작성합니다."
                      actions={(
                        <>
                          <button type="button" aria-pressed={showCampaignList} onClick={() => void openCampaignList()} className={`settings-choice-hover ${SETTINGS_ACTION_CLASS} px-2 ${showCampaignList ? 'bg-brand-surface' : ''}`}>목록</button>
                          <button type="button" aria-pressed={!showCampaignList && activeType === 'NOTICE'} onClick={() => openType('NOTICE')} className={`settings-choice-hover ${SETTINGS_ACTION_CLASS} px-2 ${!showCampaignList && activeType === 'NOTICE' ? 'bg-brand-surface' : ''}`}>새 공지</button>
                          <button type="button" aria-pressed={!showCampaignList && activeType === 'AD'} onClick={() => openType('AD')} className={`settings-choice-hover ${SETTINGS_ACTION_CLASS} px-2 ${!showCampaignList && activeType === 'AD' ? 'bg-brand-surface' : ''}`}>새 광고</button>
                        </>
                      )}
                    />
                    </article>
                  </div>
                  <div className="min-h-0 flex-1 px-6">
                    <div className="page-main-scroll h-full overflow-y-auto pb-6 pt-7">
                  <article aria-label="배너 운영 콘텐츠" className="mx-auto w-full max-w-4xl space-y-5">
                    {showCampaignList ? (
                      <div className="flex flex-col gap-3">
                        <InfoSection number="1" title={`게시 (${campaigns.isError && campaigns.data === undefined ? '—' : postedCampaigns.length}개)`}>
                          {renderCampaignCards(postedCampaigns, '게시 중인 배너가 없습니다.')}
                        </InfoSection>
                        <InfoSection number="2" title={`대기 (${campaigns.isError && campaigns.data === undefined ? '—' : pendingCampaigns.length}개)`}>
                          {renderCampaignCards(pendingCampaigns, '대기 중인 배너가 없습니다.')}
                        </InfoSection>
                        <InfoSection number="3" title={`종료 (${campaigns.isError && campaigns.data === undefined ? '—' : endedCampaigns.length}개)`}>
                          {renderCampaignCards(endedCampaigns, '종료 항목이 없습니다.')}
                        </InfoSection>
                      </div>
                    ) : (
                      <>
                    <InfoSection number="1" title="미리 보기">
                      <BannerEditorPreviews draft={draft} campaign={draft.id ? selectedCampaign : undefined} />
                    </InfoSection>
                    <InfoSection number="2" title="배너 내용">
                      <div className="mx-auto w-full overflow-hidden border border-ui-border bg-ui-panel p-4" style={{ maxWidth: `${bannerTextMetrics.width + 34}px` }}>
                        <label className="flex flex-col gap-1 text-[15px] leading-[22px] font-medium text-ui-white">
                          <span>제목</span>
                          <input aria-label="배너 제목" placeholder="제목을 입력해 주세요." maxLength={100} disabled={!canEdit} value={draft.title} onChange={event => {
                            const nextTitle = event.currentTarget.value
                            if ((event.nativeEvent as InputEvent).isComposing) {
                              changeDraft({ title: nextTitle })
                              return
                            }
                            if (activeType === 'NOTICE' && !fitsNoticeTitle(nextTitle, bannerTextMetrics.titleWidth, bannerTextMetrics.titleFont)) return
                            changeDraft({ title: nextTitle })
                          }} onCompositionEnd={event => {
                            if (activeType !== 'NOTICE') return
                            const title = event.currentTarget.value
                            const fittedTitle = truncateNoticeTitle(title, bannerTextMetrics.titleWidth, bannerTextMetrics.titleFont)
                            if (fittedTitle !== title) changeDraft({ title: fittedTitle })
                          }} style={{ width: `${bannerTextMetrics.width}px`, maxWidth: '100%' }} className={INPUT_CLASS} />
                        </label>
                        <div className="mt-3 border-t border-ui-border pt-3">
                          {activeType === 'NOTICE' ? (
                            <div className="flex w-full flex-col gap-3">
                              <label className="flex flex-col gap-1 text-[15px] leading-[22px] font-medium text-ui-white">
                                <span>내용</span>
                                <textarea aria-label="내용" placeholder="내용을 입력해 주세요." maxLength={200} disabled={!canEdit} value={draft.text} onKeyDown={event => {
                                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
                                  const { value, selectionStart, selectionEnd } = event.currentTarget
                                  const nextText = `${value.slice(0, selectionStart)}\n${value.slice(selectionEnd)}`
                                  if (!fitsNoticeBanner(nextText, draft.textScalePercent, draft.textBold)) {
                                    event.preventDefault()
                                    setNoticeLimitMessage('현재 배너에 표시할 수 있는 분량을 모두 입력했습니다.')
                                  }
                                }} onChange={event => {
                                  const nextText = event.currentTarget.value
                                  if (fitsNoticeBanner(nextText, draft.textScalePercent, draft.textBold)) {
                                    changeDraft({ text: nextText })
                                    setNoticeLimitMessage('')
                                  } else {
                                    setNoticeLimitMessage('현재 배너에 표시할 수 있는 분량을 모두 입력했습니다.')
                                  }
                                }} style={{ width: `${bannerTextMetrics.width}px`, maxWidth: '100%', height: `${bannerTextMetrics.inputHeight}px`, fontSize: `${bannerTextMetrics.fontSize}px`, lineHeight: `${bannerTextMetrics.lineHeight}px`, paddingTop: '6px', paddingBottom: '6px' }} className={`${INPUT_CLASS.replace('h-[25px]', 'h-auto')} resize-none overflow-y-auto`} />
                              </label>
                              {noticeLimitMessage && <p role="status" className="m-0 text-sm leading-5 text-status-error-text">{noticeLimitMessage}</p>}
                            </div>
                          ) : (
                            <div className="h-[25px] w-fit max-w-full overflow-x-auto overflow-y-hidden">
                              <div className="flex h-[25px] w-max items-center">
                                <label className={`flex h-[25px] w-fit cursor-pointer items-center justify-center gap-1.5 border-0 bg-[var(--ui-control)] px-2 text-[13px]/4 font-medium text-ui-white settings-chip-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-35 ${draft.file ? 'rounded-l-[4px] rounded-r-none' : 'rounded-[4px]'}`}>
                                  <UploadIcon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                                  <span className="whitespace-nowrap">{draft.file?.name ?? (savedCampaign?.hasImage ? '이미지 교체' : '배너 이미지 선택')}</span>
                                  <input ref={bannerFileInputRef} type="file" accept="image/png,image/jpeg" disabled={!canEdit} onChange={event => handlePickFile(event.target.files?.[0])} className="sr-only" />
                                </label>
                                {draft.file && <button type="button" aria-label="선택한 배너 이미지 제거" disabled={!canEdit} onClick={() => {
                                  changeDraft({ file: null })
                                  if (bannerFileInputRef.current) bannerFileInputRef.current.value = ''
                                }} className="flex h-[25px] w-6 shrink-0 items-center justify-center rounded-r-[4px] border-0 bg-[var(--ui-control)] pr-1 text-ui-white settings-chip-hover disabled:cursor-not-allowed disabled:opacity-35"><CloseIcon aria-hidden="true" className="h-3.5 w-3.5" /></button>}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="mt-3 border-t border-ui-border pt-3">
                          <label className="flex flex-col gap-1 text-[15px] leading-[22px] font-medium text-ui-white">
                            <span>연결 <span className="font-normal text-ui-muted">(선택)</span></span>
                            <input aria-label="연결 (선택)" disabled={!canEdit} value={draft.linkUrl} onChange={event => changeDraft({ linkUrl: event.target.value })} style={{ width: `${bannerTextMetrics.width}px`, maxWidth: '100%' }} onBlur={event => {
                              const normalized = normalizeBannerLink(event.target.value) || 'https://'
                              if (normalized !== draft.linkUrl) changeDraft({ linkUrl: normalized })
                            }} className={INPUT_CLASS} />
                            <span className="text-sm font-normal leading-relaxed text-ui-muted">입력하면 배너를 눌러 해당 주소로 이동합니다.</span>
                          </label>
                        </div>
                      </div>
                    </InfoSection>

                    <InfoSection number="3" title="게시 일정">
                      <div className="mx-auto w-full overflow-hidden border border-ui-border bg-ui-panel p-3" style={{ maxWidth: `${bannerTextMetrics.width + 34}px` }}>
                        <div className="flex w-full flex-wrap items-start gap-x-2 gap-y-3">
                          <div className="flex min-w-[208px] flex-[1_1_208px] flex-col gap-1 text-[15px]/[22px] font-medium text-ui-white">
                            <span className="flex h-[25px] items-center">시작</span>
                            <DateTimeField label="교체 시작" disabled={!canEdit} value={draft.startsAt} onChange={startsAt => changeDraft({ startsAt })} key={`${draftGeneration}-${activeType}-${draft.id ?? 'new'}-starts`} />
                          </div>
                          <div className="flex min-w-[208px] flex-[1_1_208px] flex-col gap-1 text-[15px]/[22px] font-medium text-ui-white">
                            <span className="flex h-[25px] items-center">종료</span>
                            <DateTimeField label="교체 종료" disabled={!canEdit} value={displayedEndAt} onChange={endsAt => changeDraft({ endsAt })} dateAnimationKey={endDatePresetGeneration} key={`${draftGeneration}-${activeType}-${draft.id ?? 'new'}-ends`} />
                          </div>
                          <div className="flex flex-col gap-1 text-[15px]/[22px] font-medium text-ui-white">
                            <span className="flex h-[25px] items-center">기간</span>
                            <div className="flex h-[25px] items-center gap-0.5 sm:justify-end">
                              {endPresets.map(preset => (
                                <button
                                  key={preset.key}
                                  type="button"
                                  disabled={!canEdit || !preset.value || saveMutation.isPending}
                                  aria-pressed={selectedEndPreset === preset.key}
                                  onClick={() => {
                                    if (preset.value) {
                                      changeDraft({ endsAt: preset.value })
                                      setEndDatePresetGeneration(value => value + 1)
                                    }
                                  }}
                                  className={`settings-choice-hover flex h-[25px] w-[42px] shrink-0 items-center justify-center rounded-[4px] border-0 px-0 text-[13px]/[16px] font-medium text-ui-white disabled:cursor-not-allowed disabled:opacity-35 ${selectedEndPreset === preset.key ? 'bg-brand-surface' : 'bg-[var(--ui-control)]'}`}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {scheduleError && <p role="alert" className="mt-2 text-sm leading-5 text-status-error-text">{scheduleError}</p>}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ui-border pt-3">
                          <button type="button" disabled={!canEdit || !isDraftValid || saveMutation.isPending || !isDirty} onClick={() => { void handleSave() }} className={`${EDITOR_ACTION_CLASS} bg-brand-surface hover:bg-brand-surface-hover focus-visible:outline-brand`}>{saveButtonLabel}</button>
                          {draft.id && selectedCampaign?.status === 'SCHEDULED' && <button type="button" disabled={isMutating || isDirty} onClick={() => void handleCancelScheduled()} className={`${EDITOR_ACTION_CLASS} bg-[var(--ui-control)] font-medium hover:bg-ui-control-hover focus-visible:outline-brand`}>예약 취소</button>}
                          {draft.id && selectedCampaign?.status === 'LIVE' && <button type="button" disabled={isMutating || isDirty} onClick={() => void handleEnd()} className={`${EDITOR_ACTION_CLASS} bg-[#BC2F2F] font-medium hover:brightness-110 focus-visible:outline-[#BC2F2F]`}>종료</button>}
                          {draft.id && selectedCampaign?.status === 'ENDED' && <button type="button" disabled={isMutating} onClick={() => void handleDelete()} className={`${EDITOR_ACTION_CLASS} bg-[#BC2F2F] font-medium hover:brightness-110 focus-visible:outline-[#BC2F2F]`}>삭제</button>}
                        </div>
                      </div>
                    </InfoSection>

                      </>
                    )}

                  </article>
                    </div>
                  </div>
                </PageMainFrame>
              </>
            )}
            <DisclaimerFooter />
          </div>
          {isAdmin && (
            <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
              <SettingsPanel
                pageLabel="Banner"
                showPreferenceActions={false}
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                isOnLeft={isSettingsOnLeft}
                onToggleSide={toggleSettingsSide}
                sectionOrder={['adminBanner']}
                headerRight={rotationHeaderActions}
              >
                <SettingsPanelGroup section="adminBanner">
                    <div className="settings-plain-content">
                    {([
                      { title: '게시', description: '현재 게재 중인 배너', items: postedCampaigns },
                      { title: '대기', description: '예약되었거나 게시할 수 있는 배너', items: pendingCampaigns },
                      { title: '종료', description: '게재가 종료된 배너', items: endedCampaigns },
                    ] as const).map(section => (
                      <div key={section.title} className="settings-ops-item h-[180px] text-sm">
                        <div className="settings-custom-control">
                          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">{section.title}</h2>
                          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">{section.description}</p>
                          <ScrollArea className="settings-control-inset h-[92px] max-h-[92px] flex-shrink-0">
                            {campaigns.isPending ? <span className="text-ui-muted">목록을 불러오는 중입니다.</span>
                              : campaigns.isError && campaigns.data === undefined ? <span role="alert" className="text-ui-muted">목록을 불러오지 못했습니다.</span>
                                : section.items.length ? section.items.map(item => (
                                  <button key={item.id} type="button" onClick={() => { void selectCampaign(item) }} className="flex h-5 w-full min-w-0 shrink-0 items-center justify-start gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-left text-[13px] font-medium text-ui-white transition-colors hover:bg-[var(--accent)]/35 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand">
                                    <BannerTypeBadge type={item.type} />
                                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                                    {item.status === 'SCHEDULED' && <span className="shrink-0 text-[11px] text-ui-muted">{formatStartCountdown(item.startsAt)}</span>}
                                    {item.status === 'DRAFT' && <span className="shrink-0 text-[11px] text-ui-muted">미예약</span>}
                                  </button>
                                )) : null}
                          </ScrollArea>
                        </div>
                      </div>
                    ))}
                    <div className="settings-ops-item h-[180px] text-sm">
                      <div className="settings-custom-control">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">배너 전환 간격</h2>
                        <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">공개 배너가 순서대로 바뀌는 간격</p>
                        <div className="mt-auto mb-auto grid max-w-full grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] items-center settings-control-inset">
                          <div className="col-start-2">
                            <IntervalDial
                              label="배너 전환 간격"
                              unit="초"
                              size={100}
                              value={rotationInterval}
                              step={5}
                              disabled={rotationSetting.isPending || saveRotationSettingMutation.isPending}
                              onChange={setRotationDraft}
                            />
                          </div>
                          <span className="col-start-3 ml-3 inline-flex h-5 w-[42px] shrink-0 items-center justify-center rounded-[4px] bg-ui-control px-1.5 text-xs font-semibold leading-none tabular-nums text-ui-white" aria-live="polite">
                            {rotationInterval}초
                          </span>
                        </div>
                        {rotationSetting.isError && <p role="alert" className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">설정을 불러오지 못했습니다. 간격을 선택해 다시 저장해 주세요.</p>}
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
