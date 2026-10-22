import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getTelegramSendSetting,
  saveTelegramSendSetting,
  type TelegramSendSetting,
  type TelegramSendSettingInput,
} from '@/api/adminTelegram'
import DigitalClockPicker from '@/components/DigitalClockPicker'
import FrameBadge from '@/components/FrameBadge'
import MinuteDial from '@/components/MinuteDial'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import SettingsSegmentedControl from '@/components/SettingsSegmentedControl'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { HistoryIcon, SaveIcon } from '@/components/icons/AppIcons'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'

const SEND_OPTIONS = [{ value: true, label: '켜기' }, { value: false, label: '끄기' }] as const
const CHIP_BASE = 'flex h-7 items-center justify-center settings-chip-hover rounded-[4px] border-0 text-[13px]'
const CHIP_OFF = 'bg-[var(--ui-control)] font-medium text-ui-white'

function toDraft(setting: TelegramSendSetting): TelegramSendSettingInput {
  return {
    enabled: setting.enabled,
    sectorSendMinute: setting.sectorSendMinute,
    sectorSendIntervalMinutes: setting.sectorSendIntervalMinutes,
    mapSendTimes: setting.mapSendTimes,
  }
}

function formatClock(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

// 서버가 저장할 때 하는 검사와 같은 기준 — 어긋난 값은 저장 버튼을 막아 서버 오류를 피한다.
function isValidDraft(draft: TelegramSendSettingInput, setting: TelegramSendSetting) {
  const { collectIntervalMinutes, startHour, endHour } = setting
  if (draft.sectorSendMinute <= 0 || draft.sectorSendMinute % collectIntervalMinutes !== 0) return false
  if (draft.sectorSendIntervalMinutes <= 0 || draft.sectorSendIntervalMinutes % collectIntervalMinutes !== 0) return false
  if (draft.mapSendTimes.length === 0) return false
  return draft.mapSendTimes.every(time => {
    const [hour, minute] = time.split(':').map(Number)
    if (Number.isNaN(hour) || Number.isNaN(minute)) return false
    const total = hour * 60 + minute
    return minute % collectIntervalMinutes === 0 && total >= startHour * 60 && total <= endHour * 60
  })
}

function isSameDraft(a: TelegramSendSettingInput, b: TelegramSendSettingInput) {
  return (
    a.enabled === b.enabled &&
    a.sectorSendMinute === b.sectorSendMinute &&
    a.sectorSendIntervalMinutes === b.sectorSendIntervalMinutes &&
    a.mapSendTimes.length === b.mapSendTimes.length &&
    a.mapSendTimes.every((time, index) => time === b.mapSendTimes[index])
  )
}

// 관리자 전용 메시지 페이지 — 텔레그램으로 나가는 정기 발송(섹터 순위·지도 이미지)을 운영자가 켜고 끄고 시각을 바꾼다.
// 저장된 값이 없으면 꺼짐이고 시각은 서버 기본값이다. 수집 실패 알림(개발자 채널)은 이 스위치와 별개로 간다.
// 화면에서 숨기는 것과 별개로 서버도 /api/admin/** 을 ADMIN만 허용한다. 관리자가 아니면 안내 문구만 보여 준다.
export default function AdminMessagePage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = session?.authenticated === true && session.role === 'ADMIN'
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsPanelSide()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [draft, setDraft] = useState<TelegramSendSettingInput | null>(null)
  const [newTime, setNewTime] = useState('')
  const screenshotRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const setting = useQuery({
    queryKey: ['admin-telegram-setting', session?.userId],
    queryFn: ({ signal }) => getTelegramSendSetting(signal),
    enabled: isAdmin,
    staleTime: 0,
    retry: false,
  })
  useEffect(() => {
    if (setting.data) setDraft(toDraft(setting.data))
  }, [setting.data])

  const save = useMutation({
    mutationFn: saveTelegramSendSetting,
    onSuccess: saved => {
      queryClient.setQueryData(['admin-telegram-setting', session?.userId], saved)
    },
    onError: () => {
      void appAlert('저장하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요.', { adminOnly: true })
    },
  })

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

  const saved = setting.data
  const isDirty = saved !== undefined && draft !== null && (isSameDraft(draft, toDraft(saved)) === false || saved.saved === false)

  // 설정창 헤더 오른쪽의 되돌리기·저장 — 다른 페이지 설정창과 같은 아이콘이다. 바꾼 값이 있으면 저장 아이콘 모서리에 점이 뜬다.
  const handleDiscard = async () => {
    if (saved === undefined || isDirty === false) return
    if (await appConfirm('기존 저장값으로 되돌리시겠습니까?', { title: '되돌리기' })) setDraft(toDraft(saved))
  }
  const handleSave = async () => {
    if (saved === undefined || draft === null || isDirty === false || save.isPending) return
    if (isValidDraft(draft, saved) === false) {
      void appAlert('입력값이 올바르지 않습니다.\n시각과 간격을 확인해 주세요.', { title: '저장하기' })
      return
    }
    if (await appConfirm('지금 변경사항을 저장하시겠습니까?', { title: '저장하기' })) save.mutate(draft)
  }
  const headerActions = (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="초기화" data-hint="저장값으로 되돌리기" disabled={save.isPending} onClick={() => void handleDiscard()} className="group relative flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-ui-text outline-none transition-colors hover:text-brand focus-visible:text-brand disabled:opacity-50">
        <HistoryIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" aria-label="저장" data-hint="변경값으로 저장하기" disabled={save.isPending} onClick={() => void handleSave()} className="group relative flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-ui-text outline-none transition-colors hover:text-brand focus-visible:text-brand disabled:opacity-50">
        {isDirty && <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand" />}
        <SaveIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )

  const updateDraft = (patch: Partial<TelegramSendSettingInput>) => setDraft(previous => (previous ? { ...previous, ...patch } : previous))
  const addMapTime = () => {
    if (draft === null || newTime === '' || draft.mapSendTimes.includes(newTime)) return
    updateDraft({ mapSendTimes: [...draft.mapSendTimes, newTime].sort() })
    setNewTime('')
  }

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => void setting.refetch()}
            isRefreshing={setting.isFetching}
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
        <div className="main-settings-row relative z-10 -mt-[10.5px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
          <div ref={screenshotRef} data-main-area className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background text-ui-white">
            {isLoading ? (
              <p role="status" className="m-auto text-base text-ui-text">관리자 권한을 확인하는 중입니다.</p>
            ) : !isAdmin ? (
              <p className="m-auto text-center text-base text-ui-text">관리자 전용 페이지입니다.</p>
            ) : (
              <section aria-label="메시지" className="flex h-full min-h-0 w-full flex-col text-sm">
                <Toolbar>
                  <ToolbarModeText page="ADMIN" label="MESSAGE" />
                </Toolbar>
                <div className="min-h-0 flex-1 overflow-auto pb-1">
                  {setting.isError ? (
                    <p role="alert" className="m-0 text-sm text-ui-text">불러오지 못했습니다.</p>
                  ) : saved ? (
                    <section aria-label="텔레그램 정기 발송" className="flex max-w-[640px] flex-col border border-ui-border p-[7px]">
                      <div className="flex items-center gap-2">
                        <FrameBadge>텔레그램 정기 발송</FrameBadge>
                        <FrameBadge className={saved.enabled ? '' : '!bg-[var(--ui-control)] !text-ui-muted'}>
                          {saved.enabled ? '켜짐' : '꺼짐'}
                        </FrameBadge>
                      </div>
                      <p className="m-0 mt-2 text-xs font-medium text-ui-white">
                        {saved.saved
                          ? `마지막 저장 ${saved.updatedAt?.replace('T', ' ').slice(0, 16) ?? ''}`
                          : '저장된 설정이 없어 꺼져 있고, 시각은 서버 기본값입니다.'}
                      </p>
                      <dl className="m-0 mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
                        <dt className="text-ui-muted">섹터 순위</dt>
                        <dd className="m-0 text-ui-white">
                          {`매일 ${formatClock(saved.startHour, saved.sectorSendMinute)}부터 ${saved.sectorSendIntervalMinutes}분 간격 · 마지막 ${formatClock(saved.endHour, saved.sectorSendMinute)}`}
                        </dd>
                        <dt className="text-ui-muted">지도 이미지</dt>
                        <dd className="m-0 text-ui-white">
                          {saved.mapSendTimes.join(' · ')}
                          <span className="block text-xs text-ui-muted">마지막 시각은 그날 장 마감 시각으로 자동 대체됩니다.</span>
                        </dd>
                        <dt className="text-ui-muted">수집 실패 알림</dt>
                        <dd className="m-0 text-ui-white">이 스위치와 별개로 개발자 채널에 항상 갑니다.</dd>
                      </dl>
                    </section>
                  ) : (
                    <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                  )}
                </div>
              </section>
            )}
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
                headerRight={headerActions}
              >
                <SettingsPanelGroup section="adminManage">
                  <div className="settings-plain-content">
                    {saved && draft && (
                      <>
                        <div className="settings-ops-item h-[160px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">발송</h2>
                            <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-ui-muted">정기 리포트를 텔레그램으로 보낼지</p>
                            <SettingsSegmentedControl label="발송" options={SEND_OPTIONS} value={draft.enabled} onChange={value => updateDraft({ enabled: value })} />
                          </div>
                        </div>
                        <div className="settings-ops-item h-[160px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">발송 시작</h2>
                            <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-ui-muted">메시지 첫 발송 시각</p>
                            <div className="mt-3 flex max-w-[16rem] translate-y-[6px] settings-control-inset justify-center">
                              <DigitalClockPicker label="발송 시작" hour={saved.startHour} minute={draft.sectorSendMinute} step={saved.collectIntervalMinutes} onChange={value => updateDraft({ sectorSendMinute: value })} />
                            </div>
                          </div>
                        </div>
                        <div className="settings-ops-item h-[160px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">발송 간격</h2>
                            <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-ui-muted">섹터 순위를 몇 분마다 보낼지</p>
                            <div className="mt-1 flex max-w-[16rem] translate-y-[6px] settings-control-inset flex-col items-center justify-center gap-1.5">
                              <span className="rounded-[4px] border border-ui-border bg-ui-control px-1.5 py-0.5 text-[13px]/4 text-ui-white">{`${draft.sectorSendIntervalMinutes}분 간격`}</span>
                              <MinuteDial label="발송 간격" size={52} value={draft.sectorSendIntervalMinutes} step={saved.collectIntervalMinutes} onChange={value => updateDraft({ sectorSendIntervalMinutes: value })} />
                            </div>
                          </div>
                        </div>
                        <div className="settings-ops-item min-h-[160px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">지도 발송 시각</h2>
                            <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-ui-muted">마지막 시각은 장 마감 시각으로 대체</p>
                            <div className="settings-control-inset mt-2 flex max-h-[68px] flex-col gap-1 overflow-y-auto">
                              {draft.mapSendTimes.map(time => (
                                <button key={time} type="button" aria-label={`${time} 지우기`} data-hint="눌러서 지우기" onClick={() => updateDraft({ mapSendTimes: draft.mapSendTimes.filter(item => item !== time) })} className="flex h-5 w-full shrink-0 cursor-pointer items-center justify-start gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-left text-[13px] font-medium text-ui-white transition-colors hover:bg-[var(--accent)]/35">
                                  <span aria-hidden="true" className="w-3.5 shrink-0 text-center text-ui-text">×</span>
                                  <span className="min-w-0 truncate">{time}</span>
                                </button>
                              ))}
                            </div>
                            <div className="mt-3 grid max-w-[16rem] settings-control-inset grid-cols-[1fr_auto] gap-[6px]">
                              <input
                                type="time"
                                step={saved.collectIntervalMinutes * 60}
                                aria-label="추가할 지도 발송 시각"
                                value={newTime}
                                onChange={event => setNewTime(event.target.value)}
                                className="h-7 rounded-[4px] border-0 bg-[var(--ui-control)] px-2 text-[13px] font-medium text-ui-white"
                              />
                              <button type="button" onClick={addMapTime} disabled={newTime === ''} className={`${CHIP_BASE} ${CHIP_OFF} px-3 disabled:cursor-not-allowed disabled:opacity-35`}>
                                추가
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
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
