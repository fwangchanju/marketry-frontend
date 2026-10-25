import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { BannerImage, NoticeBanner } from '@/components/BannerContent'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import AlwaysVisibleScrollArea from '@/components/AlwaysVisibleScrollArea'
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
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { approveBanner, adminBannerImageUrl, deleteBannerDraft, getAdminBanners, saveBannerDraft, type BannerCampaign, type BannerDraftInput } from '@/api/adminBanners'
import { CalendarIcon, ClockIcon, SaveIcon, UploadIcon } from '@/components/icons/AppIcons'
import AdBannerSlot from '@/components/AdBannerSlot'
import { SlidingHighlight } from '@/components/SlidingHighlight'
import SettingsDropdown from '@/components/SettingsDropdown'

const INPUT_CLASS = 'h-[25px] w-full min-w-0 rounded-[4px] border border-transparent bg-[var(--ui-control)] px-2 text-[13px]/4 font-medium text-ui-white outline-none focus:border-brand placeholder:text-ui-muted disabled:opacity-35'
const SETTINGS_ACTION_CLASS = 'flex h-[25px] w-fit shrink-0 items-center justify-center gap-1.5 rounded-[4px] border-0 bg-[var(--ui-control)] text-[13px] leading-[1.3] font-medium text-ui-white settings-chip-hover disabled:cursor-not-allowed disabled:opacity-35'

function kstInputValue(epoch = Date.now()): string {
  return new Date(epoch).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T').slice(0, 16)
}

function inputDateTime(value: string): string {
  return value ? value.slice(0, 16) : ''
}

function formatDatePart(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}/)
  return match ? `${match[1]}.${match[2]}.${match[3]}` : ''
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
    <div className={`flex h-8 w-full min-w-0 items-center rounded-[4px] border border-transparent bg-[var(--ui-control)] px-1 focus-within:border-brand ${disabled ? 'opacity-35' : ''}`}>
      <CalendarIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ui-muted" />
      <input aria-label={`${label} 날짜`} type="text" inputMode="numeric" disabled={disabled} value={dateText} placeholder="yyyy.mm.dd" onChange={event => {
        const next = event.target.value
        setDateText(next)
        commitParts(next, timeText)
      }} className="h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-[13px] font-medium tabular-nums text-ui-white outline-none placeholder:text-ui-muted" />
      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-ui-white/10" />
      <SettingsDropdown
        options={[{ key: 'am', label: '오전' }, { key: 'pm', label: '오후' }]}
        value={isPm ? 'pm' : 'am'}
        onChange={meridiem => {
        const nextIsPm = meridiem === 'pm'
        setIsPm(nextIsPm)
        const parsed = parseDateTime12(`${dateText} ${timeText}`, nextIsPm)
        const nextValue = parsed ?? ''
        if (nextValue !== lastEmittedValue.current) {
          lastEmittedValue.current = nextValue
          onChange(nextValue)
        }
        }}
        ariaLabel={`${label} 오전/오후`}
        disabled={disabled}
        smallChevron
        centerLabel
        className="w-[64px] shrink-0"
      />
      <span aria-hidden="true" className="h-4 w-px shrink-0 bg-ui-white/10" />
      <ClockIcon aria-hidden="true" className="ml-1 h-3.5 w-3.5 shrink-0 text-ui-muted" />
      <input aria-label={`${label} 시각 (12시간)`} type="text" inputMode="numeric" maxLength={5} disabled={disabled} value={timeText} placeholder="hh:mm" onChange={event => {
        const next = event.target.value
        setTimeText(next)
        commitParts(dateText, next)
      }} className="h-full w-[56px] shrink-0 border-0 bg-transparent pl-1 text-center text-[13px] font-medium tabular-nums text-ui-white outline-none placeholder:text-ui-muted" />
    </div>
  )
}

function formatScheduledAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

function fitsNoticeBanner(text: string, textScalePercent = 100, textBold = false, sourceBody?: HTMLElement): boolean {
  if (!text) return true
  const body = sourceBody ?? document.querySelector<HTMLElement>('[data-ad-banner-slot] [data-banner-text-body]')
  const bannerSlot = body?.closest<HTMLElement>('[data-ad-banner-slot]') ?? (sourceBody ? null : document.querySelector<HTMLElement>('[data-ad-banner-slot]'))
  if (!body || !bannerSlot) return true

  const bodyStyle = getComputedStyle(body)
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

function initialDraft(): BannerDraftInput {
  return { id: null, type: 'NOTICE', title: '', text: '', textScalePercent: 100, textBold: false, linkUrl: '', startsAt: kstInputValue(), endsAt: '', file: null }
}

const BANNER_TEXT_SCALES = [80, 100, 120] as const

function BannerTextScalePicker({ value, textBold, disabled, onChange }: { value: number; textBold: boolean; disabled: boolean; onChange: (value: number) => void }) {
  return (
    <div aria-label="공지 글자 크기" aria-disabled={disabled || undefined} role="radiogroup" className={`relative grid h-7 grid-cols-3 gap-[2px] ${disabled ? 'opacity-35' : ''}`}>
      <SlidingHighlight gap={2} count={BANNER_TEXT_SCALES.length} index={BANNER_TEXT_SCALES.indexOf(value as typeof BANNER_TEXT_SCALES[number])} className="rounded-[4px] border border-brand bg-brand-surface" />
      {BANNER_TEXT_SCALES.map(scale => (
        <button key={scale} type="button" role="radio" aria-checked={value === scale} disabled={disabled} onClick={() => onChange(scale)} className="relative z-10 flex h-full items-center justify-center rounded-[4px] border-0 bg-transparent px-1 text-[12px] leading-none text-ui-white transition-colors disabled:cursor-not-allowed">
          <span style={{ fontSize: `${12 * scale / 100}px` }} className={textBold ? 'font-bold' : 'font-medium'}>{scale === 100 ? '기본' : scale === 80 ? '작게' : '크게'}</span>
        </button>
      ))}
    </div>
  )
}

function BannerTextWeightPicker({ value, disabled, onChange }: { value: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  const options = [{ value: false, label: '보통' }, { value: true, label: '굵게' }]
  return (
    <div aria-label="공지 글자 굵기" aria-disabled={disabled || undefined} role="radiogroup" className={`relative grid h-7 grid-cols-2 gap-[2px] ${disabled ? 'opacity-35' : ''}`}>
      <SlidingHighlight gap={2} count={options.length} index={value ? 1 : 0} className="rounded-[4px] border border-brand bg-brand-surface" />
      {options.map(option => (
        <button key={String(option.value)} type="button" role="radio" aria-checked={value === option.value} disabled={disabled} onClick={() => onChange(option.value)} className="relative z-10 flex h-full items-center justify-center rounded-[4px] border-0 bg-transparent px-1 text-[12px] leading-none text-ui-white transition-colors disabled:cursor-not-allowed">
          <span className={option.value ? 'font-bold' : 'font-medium'}>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

function CampaignStatusBadge({ status }: { status: BannerCampaign['status'] }) {
  const isPublic = status !== 'DRAFT'
  return <span className={`inline-flex h-5 shrink-0 items-center rounded-[4px] px-1.5 text-xs font-semibold ${isPublic ? 'bg-brand-surface text-ui-white' : 'bg-ui-control text-ui-white'}`}>{isPublic ? '공개' : '비공개'}</span>
}

function campaignImageUrl(campaign: BannerCampaign) {
  return adminBannerImageUrl(campaign.id, campaign.updatedAt)
}

interface BannerTextMetrics { width: number; fontSize: number; lineHeight: number; maxLines: number; inputHeight: number }

function BannerDraftSlot({ draft, savedCampaign, onMetricsChange }: { draft: BannerDraftInput; savedCampaign?: BannerCampaign; onMetricsChange: (metrics: BannerTextMetrics) => void }) {
  const localImageUrl = useMemo(() => draft.file ? URL.createObjectURL(draft.file) : null, [draft.file])
  useEffect(() => () => { if (localImageUrl) URL.revokeObjectURL(localImageUrl) }, [localImageUrl])
  const imageUrl = localImageUrl ?? (savedCampaign?.hasImage ? campaignImageUrl(savedCampaign) : null)
  const linkUrl = draft.linkUrl.trim() === 'http://' ? '' : draft.linkUrl.trim()
  useEffect(() => {
    const textArea = document.querySelector<HTMLElement>('[data-ad-banner-slot] [data-banner-text-area]')
    const textBody = document.querySelector<HTMLElement>('[data-ad-banner-slot] [data-banner-text-body]')
    const bannerSlot = document.querySelector<HTMLElement>('[data-ad-banner-slot]')
    if (!textArea) return
    const updateMetrics = () => {
      const bodyStyle = textBody ? getComputedStyle(textBody) : null
      const bannerHeight = Number(bannerSlot?.dataset.adBannerSlot?.split('x')[1] ?? 90)
      const lineHeight = Number.parseFloat(bodyStyle?.lineHeight ?? '15')
      const maxLines = Number(textBody?.dataset.bannerMaxLines ?? Math.floor((bannerHeight - (bannerHeight < 90 ? 15 : 17.5)) / lineHeight))
      onMetricsChange({
        width: textArea.getBoundingClientRect().width,
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
    if (textBody) observer.observe(textBody)
    return () => observer.disconnect()
  }, [draft.type, draft.textScalePercent, onMetricsChange])
  return (
    <AdBannerSlot>
      {size => draft.type === 'NOTICE'
        ? <NoticeBanner title={draft.title || '서비스 안내'} text={draft.text || '공지사항을 확인해 주세요.'} linkUrl={linkUrl || null} size={size} preview textScalePercent={draft.textScalePercent} textBold={draft.textBold} />
        : imageUrl
          ? <BannerImage src={imageUrl} title={draft.title || '광고 배너'} size={size} />
          : <div className="flex h-full w-full items-center justify-center bg-ui-panel text-sm text-ui-muted">광고 이미지를 선택해 주세요.</div>}
    </AdBannerSlot>
  )
}

export default function AdminBannerPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = isAdminSession(session)
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsPanelSide()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [activeType, setActiveType] = useState<BannerDraftInput['type']>('NOTICE')
  const [showCampaignList, setShowCampaignList] = useState(false)
  const [bannerTextAreaWidth, setBannerTextAreaWidth] = useState(640)
  const [bannerTextMetrics, setBannerTextMetrics] = useState<BannerTextMetrics>({ width: 640, fontSize: 12, lineHeight: 15, maxLines: 4, inputHeight: 74 })
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
    setBannerTextAreaWidth(previous => previous === next.width ? previous : next.width)
    setBannerTextMetrics(previous => Object.keys(next).every(key => previous[key as keyof BannerTextMetrics] === next[key as keyof BannerTextMetrics]) ? previous : next)
  }, [])

  const campaigns = useQuery({ queryKey: ['admin-banners'], queryFn: ({ signal }) => getAdminBanners(signal), enabled: isAdmin, retry: false })
  const draft = drafts[activeType]
  const isDraftSaved = savedFlags[activeType]
  const savedCampaign = savedCampaigns[activeType]
  const listedCampaign = useMemo(() => campaigns.data?.find(item => item.id === draft.id), [campaigns.data, draft.id])
  const selectedCampaign = listedCampaign ?? savedCampaign
  const canEdit = !selectedCampaign || selectedCampaign.status === 'DRAFT'
  const isDirty = !isDraftSaved
  const isDraftValid = Boolean(draft.title.trim() && draft.startsAt && (draft.type === 'NOTICE' ? draft.text.trim() : draft.file || savedCampaign?.hasImage))

  const saveMutation = useMutation({
    mutationFn: saveBannerDraft,
    onSuccess: async item => {
      setSavedCampaigns(value => ({ ...value, [item.type]: item }))
      setDrafts(value => ({ ...value, [item.type]: { ...value[item.type], id: item.id, linkUrl: item.linkUrl ?? '', file: null } }))
      setSavedFlags(value => ({ ...value, [item.type]: true }))
      setEditedFlags(value => ({ ...value, [item.type]: false }))
      await client.invalidateQueries({ queryKey: ['admin-banners'] })
      void appAlert('배너를 저장했습니다. 목록에서 공개할 수 있습니다.', { title: '저장 완료' })
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
    if (activeType === 'NOTICE' && !fitsNoticeBanner(draft.text, draft.textScalePercent, draft.textBold)) {
      setNoticeLimitMessage('현재 내용이 배너 표시 한도를 넘습니다. 내용을 줄인 뒤 저장해 주세요.')
      return
    }
    if (!draft.title.trim() || !draft.startsAt || (draft.type === 'NOTICE' && !draft.text.trim()) || (draft.type === 'AD' && !draft.file && !savedCampaign?.hasImage)) {
      void appAlert('제목, 문구 또는 광고 이미지와 게시 시작 시각을 확인해 주세요.', { title: '입력 확인' })
      return
    }
    saveMutation.mutate({ ...draft, linkUrl: draft.linkUrl.trim() === 'http://' ? '' : draft.linkUrl })
  }
  const handleApproveCampaign = async (item: BannerCampaign, previewBody?: HTMLElement) => {
    if (item.status !== 'DRAFT' || approveMutation.isPending) return
    if (item.type === 'NOTICE' && !fitsNoticeBanner(item.text ?? '', item.textScalePercent, item.textBold, previewBody)) {
      void appAlert('현재 내용이 배너 표시 한도를 넘습니다. 해당 배너를 수정한 뒤 다시 공개해 주세요.', { title: '배너 표시 확인' })
      return
    }
    const replacementAt = formatScheduledAt(item.startsAt)
    if (!await appConfirm(`등록한 배너를 ${replacementAt} (한국 시간)에 모든 방문자에게 공개하시겠습니까?`, { title: '배너 전체 공개' })) return
    approveMutation.mutate(item.id)
  }
  const confirmDiscard = (type: BannerDraftInput['type']) => !editedFlags[type] || appConfirm('저장하지 않은 변경 내용을 버리시겠습니까?', { title: '변경 내용 버리기' })
  const selectCampaign = async (item: BannerCampaign) => {
    if (!await confirmDiscard(item.type)) return false
    setEditedFlags(value => ({ ...value, [item.type]: false }))
    setDraftGeneration(value => value + 1)
    setActiveType(item.type)
    setShowCampaignList(false)
    setSavedCampaigns(value => ({ ...value, [item.type]: item }))
    setSavedFlags(value => ({ ...value, [item.type]: true }))
    setDrafts(value => ({ ...value, [item.type]: {
      id: item.id,
      type: item.type,
      title: item.title,
      text: item.text ?? '',
      textScalePercent: item.textScalePercent,
      textBold: item.textBold,
      linkUrl: item.linkUrl ?? '',
      startsAt: inputDateTime(item.startsAt),
      endsAt: inputDateTime(item.endsAt ?? ''),
      file: null,
    } }))
    return true
  }
  const startNewDraft = async (type: BannerDraftInput['type']) => {
    if (!await confirmDiscard(type)) return
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
  const openType = (type: BannerDraftInput['type']) => {
    if (showCampaignList) {
      void startNewDraft(type)
      return
    }
    setActiveType(type)
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

  const campaignsList = campaigns.data ?? []
  const isMutating = saveMutation.isPending || approveMutation.isPending || deleteMutation.isPending
  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar bannerSlot={isAdmin ? <BannerDraftSlot draft={draft} savedCampaign={selectedCampaign} onMetricsChange={updateBannerTextMetrics} /> : undefined} />
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
                <PageMainFrame className="p-6">
                  <article aria-label="배너 운영" className="mx-auto w-full max-w-4xl space-y-5">
                    <InfoPageHeading
                      title="배너"
                      summary={showCampaignList ? '등록한 공지·광고를 한곳에서 보고 선택해 수정합니다.' : draft.id ? `${activeType === 'NOTICE' ? '공지' : '광고'} 배너를 ${canEdit ? '수정' : '확인'}하고 있습니다.` : '새 배너 내용을 입력하거나 목록에서 기존 배너를 선택합니다.'}
                      actions={(
                        <>
                          <button type="button" aria-pressed={showCampaignList} onClick={() => setShowCampaignList(true)} className={`${SETTINGS_ACTION_CLASS} px-2 ${showCampaignList ? 'bg-brand-surface' : ''}`}>목록</button>
                          <button type="button" aria-pressed={!showCampaignList && activeType === 'NOTICE'} onClick={() => openType('NOTICE')} className={`${SETTINGS_ACTION_CLASS} px-2 ${!showCampaignList && activeType === 'NOTICE' ? 'bg-brand-surface' : ''}`}>공지</button>
                          <button type="button" aria-pressed={!showCampaignList && activeType === 'AD'} onClick={() => openType('AD')} className={`${SETTINGS_ACTION_CLASS} px-2 ${!showCampaignList && activeType === 'AD' ? 'bg-brand-surface' : ''}`}>광고</button>
                        </>
                      )}
                    />
                    {showCampaignList ? (
                      <InfoSection number="1" title={`등록된 배너 (${campaigns.isError && campaigns.data === undefined ? '—' : campaignsList.length}개)`}>
                        {campaigns.isPending ? <p role="status" className="m-0">배너 목록을 불러오는 중입니다.</p>
                          : campaigns.isError && campaigns.data === undefined ? <p role="alert" className="m-0">배너 목록을 불러오지 못했습니다.</p>
                            : campaignsList.length ? (
                              <AlwaysVisibleScrollArea className="h-[min(75vh,680px)] max-h-[680px]">
                                {campaignsList.map(item => (
                                  <div key={item.id} data-banner-campaign-card="" className="flex w-full flex-col gap-2 border border-ui-border bg-ui-panel p-3">
                                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                                      <span className="flex min-w-0 items-center gap-2">
                                        <BannerTypeBadge type={item.type} />
                                        <span className="max-w-[240px] truncate font-medium text-ui-white">{item.title}</span>
                                        <CampaignStatusBadge status={item.status} />
                                      </span>
                                      <span className="flex shrink-0 items-center gap-2">
                                        <span className="tabular-nums text-ui-muted">게시 {formatScheduledAt(item.startsAt)} ~ {item.endsAt ? formatScheduledAt(item.endsAt) : '종료 없음'}</span>
                                        {item.status === 'DRAFT' && <button type="button" disabled={isMutating} onClick={event => {
                                          const previewBody = event.currentTarget.closest('[data-banner-campaign-card]')?.querySelector<HTMLElement>('[data-banner-text-body]')
                                          void handleApproveCampaign(item, previewBody ?? undefined)
                                        }} className={`${SETTINGS_ACTION_CLASS} px-2`}>전체 공개</button>}
                                      </span>
                                    </div>
                                    <button key={`preview-${item.id}`} type="button" disabled={isMutating} onClick={() => void selectCampaign(item)} aria-label={`${item.type === 'AD' ? '광고' : '공지'} 배너 ${item.title} 편집`} className="mx-auto flex h-[90px] w-full max-w-[728px] items-center justify-center overflow-hidden border border-ui-border p-0 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand disabled:cursor-wait">
                                      {item.type === 'NOTICE'
                                        ? <NoticeBanner title={item.title} text={item.text ?? ''} linkUrl={item.linkUrl} size={{ width: 728, height: 90 }} preview textScalePercent={item.textScalePercent} textBold={item.textBold} />
                                        : item.hasImage
                                          ? <BannerImage src={campaignImageUrl(item)} title={item.title} size={{ width: 728, height: 90 }} />
                                          : <span className="flex h-full w-full items-center justify-center bg-ui-background text-sm text-ui-muted">광고 이미지 없음</span>}
                                    </button>
                                  </div>
                                ))}
                              </AlwaysVisibleScrollArea>
                            ) : <p role="status" className="m-0">등록된 배너가 없습니다.</p>}
                      </InfoSection>
                    ) : (
                      <>
                    <InfoSection number="1" title="배너 내용">
                      <div className="mx-auto w-full overflow-hidden border border-ui-border bg-ui-panel p-4" style={{ maxWidth: `${bannerTextAreaWidth + 36}px` }}>
                        <label className="flex flex-col gap-1 text-[15px] leading-[22px] font-medium text-ui-white">
                          <span>제목</span>
                          <input aria-label="배너 제목" placeholder="서비스 안내" maxLength={100} disabled={!canEdit} value={draft.title} onChange={event => changeDraft({ title: event.target.value })} className={INPUT_CLASS} />
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
                                }} style={{ height: `${bannerTextMetrics.inputHeight}px`, fontSize: `${bannerTextMetrics.fontSize}px`, lineHeight: `${bannerTextMetrics.lineHeight}px`, paddingTop: '6px', paddingBottom: '6px' }} className={`${INPUT_CLASS.replace('h-[25px]', 'h-auto')} resize-none overflow-y-auto`} />
                              </label>
                              {noticeLimitMessage && <p role="status" className="m-0 text-sm leading-5 text-status-error-text">{noticeLimitMessage}</p>}
                              <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-center gap-4">
                                <div className="min-w-0">
                                  <BannerTextScalePicker value={draft.textScalePercent} textBold={draft.textBold} disabled={!canEdit} onChange={textScalePercent => {
                                    if (fitsNoticeBanner(draft.text, textScalePercent, draft.textBold)) {
                                      changeDraft({ textScalePercent })
                                      setNoticeLimitMessage('')
                                    } else {
                                      setNoticeLimitMessage('내용을 줄인 뒤 더 큰 글자 크기를 선택해 주세요.')
                                    }
                                  }} />
                                </div>
                                <div className="min-w-0">
                                  <BannerTextWeightPicker value={draft.textBold} disabled={!canEdit} onChange={textBold => {
                                    if (fitsNoticeBanner(draft.text, draft.textScalePercent, textBold)) {
                                      changeDraft({ textBold })
                                      setNoticeLimitMessage('')
                                    } else {
                                      setNoticeLimitMessage('내용을 줄인 뒤 굵기를 변경해 주세요.')
                                    }
                                  }} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <label className="flex h-[25px] w-fit cursor-pointer items-center justify-center gap-1.5 rounded-[4px] border-0 bg-[var(--ui-control)] px-2 text-[13px]/4 font-medium text-ui-white settings-chip-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-35">
                              <UploadIcon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                              {draft.file?.name ?? (savedCampaign?.hasImage ? '이미지 교체' : '배너 이미지 선택')}
                              <input type="file" accept="image/png,image/jpeg" disabled={!canEdit} onChange={event => handlePickFile(event.target.files?.[0])} className="sr-only" />
                            </label>
                          )}
                        </div>
                        <div className="mt-3 border-t border-ui-border pt-3">
                          <label className="flex flex-col gap-1 text-[15px] leading-[22px] font-medium text-ui-white">
                            <span>연결 <span className="font-normal text-ui-muted">(선택)</span></span>
                            <input aria-label="연결 (선택)" disabled={!canEdit} value={draft.linkUrl} placeholder="https://" onChange={event => changeDraft({ linkUrl: event.target.value })} className={INPUT_CLASS} />
                            <span className="text-sm font-normal leading-relaxed text-ui-muted">입력하면 배너를 눌러 해당 주소로 이동합니다.</span>
                          </label>
                        </div>
                      </div>
                    </InfoSection>

                    <InfoSection number="2" title="게시 일정">
                      <div className="mx-auto w-full overflow-hidden border border-ui-border bg-ui-panel p-3" style={{ maxWidth: `${bannerTextAreaWidth + 32}px` }}>
                        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="flex min-w-0 flex-col gap-1 text-[15px]/[22px] font-medium text-ui-white"><span>시작</span><DateTimeField label="교체 시작" disabled={!canEdit} value={draft.startsAt} onChange={startsAt => changeDraft({ startsAt })} key={`${draftGeneration}-${activeType}-${draft.id ?? 'new'}-starts`} /></label>
                          <label className="flex min-w-0 flex-col gap-1 text-[15px]/[22px] font-medium text-ui-white"><span>종료 <span className="font-normal text-ui-muted">(선택)</span></span><DateTimeField label="교체 종료" disabled={!canEdit} value={draft.endsAt} onChange={endsAt => changeDraft({ endsAt })} key={`${draftGeneration}-${activeType}-${draft.id ?? 'new'}-ends`} /></label>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ui-border pt-3">
                          <button type="button" disabled={!canEdit || !isDraftValid || saveMutation.isPending || !isDirty} onClick={handleSave} className={`${SETTINGS_ACTION_CLASS} min-w-[100px] px-3`}><SaveIcon aria-hidden="true" className="h-4 w-4" />저장 (미공개)</button>
                          {draft.id && selectedCampaign?.status === 'DRAFT' && <button type="button" disabled={deleteMutation.isPending} onClick={() => void handleDelete()} className={`${SETTINGS_ACTION_CLASS} min-w-[100px] px-3`}>등록 취소</button>}
                          <span className="min-w-0 flex-1 text-right text-xs leading-relaxed text-ui-muted">한국 시간 기준</span>
                        </div>
                      </div>
                    </InfoSection>

                      </>
                    )}

                  </article>
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
              >
                <SettingsPanelGroup section="adminBanner">
                    <div className="settings-plain-content">
                    <div className="settings-ops-item flex min-h-[72px] flex-col text-sm">
                      <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">
                        등록 배너
                      </h2>
                      <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">배너를 선택해 수정합니다.</p>
                      <AlwaysVisibleScrollArea className="settings-control-inset mt-[7px] h-[92px] max-h-[92px] flex-shrink-0">
                      {campaigns.isPending ? <span className="text-ui-muted">목록을 불러오는 중입니다.</span>
                        : campaigns.isError && campaigns.data === undefined ? <span role="alert" className="text-ui-muted">목록을 불러오지 못했습니다.</span>
                          : campaignsList.length ? campaignsList.map(item => (
                            <button key={item.id} type="button" onClick={() => { void selectCampaign(item) }} className="flex h-5 w-full min-w-0 shrink-0 items-center justify-start gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-left text-[13px] font-medium text-ui-white transition-colors hover:bg-[var(--accent)]/35 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand">
                              <BannerTypeBadge type={item.type} />
                              <span className="min-w-0 flex-1 truncate">{item.title}</span>
                              <CampaignStatusBadge status={item.status} />
                            </button>
                          )) : <span className="text-ui-muted">등록된 배너가 없습니다.</span>}
                      </AlwaysVisibleScrollArea>
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
