import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import sampleMapImage from '@/assets/telegram-map-sample.png'
import {
  getTelegramSendSetting,
  saveTelegramSendSetting,
  sendTelegramReportOnce,
  type TelegramSendSetting,
  type TelegramSendSettingInput,
} from '@/api/adminTelegram'
import DigitalClockPicker from '@/components/DigitalClockPicker'
import IntervalDial from '@/components/IntervalDial'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import SettingsSegmentedControl from '@/components/SettingsSegmentedControl'
import { InfoPageHeading, InfoSection } from '@/components/InfoDocument'
import PageMainFrame from '@/components/PageMainFrame'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import Spinner from '@/components/Spinner'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { HistoryIcon, SaveIcon } from '@/components/icons/AppIcons'
import { appAlert, appConfirm, appWarnConfirm } from '@/utils/appDialogBus'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { isAdminSession } from '@/utils/adminAccess'

const SEND_OPTIONS = [{ value: true, label: '켜기' }, { value: false, label: '끄기' }] as const
const SAMPLE_TIME = '오후 8:00'
const SAMPLE_CAPTION = '필수 소비재 +1.1%\n헬스케어 +0.7%'

function toDraft(setting: TelegramSendSetting): TelegramSendSettingInput {
  return {
    enabled: setting.enabled,
    sectorSendMinute: setting.sectorSendMinute,
    sectorSendIntervalMinutes: setting.sectorSendIntervalMinutes,
  }
}

// 서버가 저장할 때 하는 검사와 같은 기준 — 어긋난 값은 저장 버튼을 막아 서버 오류를 피한다.
function isValidDraft(draft: TelegramSendSettingInput, setting: TelegramSendSetting) {
  const { collectIntervalMinutes } = setting
  if (draft.sectorSendMinute <= 0 || draft.sectorSendMinute % collectIntervalMinutes !== 0) return false
  if (draft.sectorSendIntervalMinutes <= 0 || draft.sectorSendIntervalMinutes % collectIntervalMinutes !== 0) return false
  return true
}

function isSameDraft(a: TelegramSendSettingInput, b: TelegramSendSettingInput) {
  return (
    a.enabled === b.enabled &&
    a.sectorSendMinute === b.sectorSendMinute &&
    a.sectorSendIntervalMinutes === b.sectorSendIntervalMinutes
  )
}

// 발송 미리보기가 스크롤 없이 보이도록 화면 높이에 맞춰 카드 전체를 줄인다. 400px은 카드 위아래 고정 영역, 1.9는 카드 높이÷너비(이미지 비율 1295/810 + 글자 줄)다.
const SAMPLE_CARD_MAX_WIDTH = 'min(26rem, calc((100dvh - 400px) / 1.9))'
// 카드 안 글자도 카드 너비에 맞춰 함께 줄인다. 최대 18px은 기존 text-lg와 같다.
const SAMPLE_TEXT = 'text-[clamp(8px,4.35cqw,18px)]'

// 관리자 전용 메시지 페이지 — 텔레그램으로 나가는 정기 발송(홈 화면 이미지)을 운영자가 켜고 끄고 시각을 바꾼다.
// 저장된 값이 없으면 꺼짐이고 시각은 서버 기본값이다. 수집 실패 알림(개발자 채널)은 이 스위치와 별개로 간다.
// 화면에서 숨기는 것과 별개로 서버도 /api/admin/** 을 ADMIN만 허용한다. 관리자가 아니면 안내 문구만 보여 준다.
export default function AdminMessagePage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = isAdminSession(session)
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsPanelSide()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [draft, setDraft] = useState<TelegramSendSettingInput | null>(null)
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
      void appAlert('저장하지 못했습니다. 입력값을 확인하고 다시 시도해 주세요.', { title: '저장 실패' })
    },
  })

  const sendOnce = useMutation({
    mutationFn: sendTelegramReportOnce,
    meta: { skipGlobalError: true },
    onSuccess: () => {
      void appAlert('가장 최근 공통 스냅샷으로 홈 리포트를 텔레그램에 보냈습니다.', { title: '발송 완료' })
    },
    onError: error => {
      const message = isAxiosError(error) && error.response?.status === 409
        ? '발송할 공통 스냅샷이 없어 보내지 않았습니다.'
        : '캡처 또는 텔레그램 전송에 실패했습니다. 다시 시도해 주세요.'
      void appAlert(message, { title: '발송 실패' })
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
  const handleSendOnce = async () => {
    if (sendOnce.isPending) return
    if (await appWarnConfirm('정기 발송 설정과 관계없이 가장 최근 공통 스냅샷으로 홈 리포트를 한 번 전송합니다.', { title: '발송 테스트 1회' })) {
      sendOnce.mutate()
    }
  }
  const headerActions = (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="초기화" data-hint="저장값으로 되돌리기" disabled={save.isPending} onClick={() => void handleDiscard()} className="group relative flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-ui-muted outline-none transition-colors hover:text-brand focus-visible:text-brand disabled:opacity-50">
        <HistoryIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <button type="button" aria-label="저장" data-hint="변경값으로 저장하기" disabled={save.isPending} onClick={() => void handleSave()} className="group relative flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-ui-muted outline-none transition-colors hover:text-brand focus-visible:text-brand disabled:opacity-50">
        {isDirty && <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand" />}
        <SaveIcon className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )

  const updateDraft = (patch: Partial<TelegramSendSettingInput>) => setDraft(previous => (previous ? { ...previous, ...patch } : previous))

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
        <div className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
          <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background text-ui-white">
            {isLoading ? (
              <p role="status" className="m-auto text-base text-ui-text">관리자 권한을 확인하는 중입니다.</p>
            ) : !isAdmin ? (
              <p className="m-auto text-center text-base text-ui-text">관리자 전용 페이지입니다.</p>
            ) : (
              <>
                <Toolbar>
                  <ToolbarModeText page="ADMIN" label="MESSAGE" />
                </Toolbar>
                <PageMainFrame
                  className="p-0"
                  heading={(
                    <div className="mx-auto w-full max-w-4xl">
                      <InfoPageHeading
                        flushBottom
                        title="텔레그램"
                        summary="국내증시 지도를 텔레그램 메시지로 받아봅니다. 발송 여부와 시각은 설정창에서 조정합니다."
                      />
                    </div>
                  )}
                >
                  <article aria-label="메시지" className="mx-auto min-h-full w-full max-w-4xl space-y-5">
                    <InfoSection number="1" title="발송 미리보기">
                      {setting.isError ? (
                        <p role="alert" className="m-0 text-sm text-ui-text">불러오지 못했습니다.</p>
                      ) : saved ? (
                        <div className="mx-auto w-full rounded-2xl rounded-bl-md bg-ui-control p-1 [container-type:inline-size]" style={{ maxWidth: SAMPLE_CARD_MAX_WIDTH }}>
                          <p className={`m-0 px-3 pb-1 pt-1.5 ${SAMPLE_TEXT} font-medium text-[var(--sub-yellow)]`}>MARKETRY</p>
                          <div className="relative overflow-hidden rounded-[10px]">
                            <img src={sampleMapImage} alt="텔레그램 발송 이미지 예시 — 시장 지도" className="block h-auto w-full" draggable={false} />
                            {sendOnce.isPending && (
                              <div className="absolute inset-0 flex items-center justify-center bg-ui-background/60">
                                <Spinner className="h-16 w-16" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-end justify-between gap-2 px-3 pb-1.5 pt-2">
                            <p className={`m-0 whitespace-pre-line ${SAMPLE_TEXT} leading-snug text-ui-white`}>{SAMPLE_CAPTION}</p>
                            <span className={`flex shrink-0 items-center gap-1.5 ${SAMPLE_TEXT} text-ui-text`}>
                              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[1em] fill-none stroke-current" strokeWidth="2"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                              2
                              <span className="ml-1.5">{SAMPLE_TIME}</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center py-10"><Spinner className="h-12 w-12" /></div>
                      )}
                    </InfoSection>
                  </article>
                </PageMainFrame>
              </>
            )}
            <DisclaimerFooter />
          </div>
          {isAdmin && (
            <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
              <SettingsPanel
                pageLabel="Message"
                showPreferenceActions={false}
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                isOnLeft={isSettingsOnLeft}
                onToggleSide={toggleSettingsSide}
                sectionOrder={['adminManage']}
                sectionIconOverrides={{ adminManage: 'mail' }}
                sectionLabelOverrides={{ adminManage: '메시지' }}
                headerRight={headerActions}
              >
                <SettingsPanelGroup section="adminManage">
                  <div className="settings-plain-content">
                    {saved && draft && (
                      <>
                        <div className="settings-ops-item h-[180px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">발송 테스트</h2>
                            <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">최신 데이터로 발송 테스트</p>
                            <div className="mt-auto mb-auto flex max-w-full settings-control-inset justify-center">
                              <button
                                type="button"
                                disabled={sendOnce.isPending}
                                aria-busy={sendOnce.isPending}
                                onClick={() => void handleSendOnce()}
                                className="flex h-[25px] w-full items-center justify-center rounded-[4px] border-0 bg-brand-surface px-3 text-[13px] leading-[1.3] font-medium text-ui-white settings-chip-hover focus-visible:bg-brand-surface-hover disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                {sendOnce.isPending ? <Spinner className="h-4 w-4" /> : '발송 테스트'}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="settings-ops-item h-[180px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">정기발송</h2>
                            <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">정기 리포트를 텔레그램으로 보낼지</p>
                            <SettingsSegmentedControl label="정기발송" options={SEND_OPTIONS} value={draft.enabled} onChange={value => updateDraft({ enabled: value })} />
                          </div>
                        </div>
                        <div className="settings-ops-item h-[180px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">정기발송 시작</h2>
                            <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">정기 리포트 첫 발송 시각</p>
                            <div className="mt-auto mb-auto flex max-w-full settings-control-inset justify-center">
                              <DigitalClockPicker label="정기발송 시작" hour={saved.startHour} minute={draft.sectorSendMinute} step={saved.collectIntervalMinutes} onChange={value => updateDraft({ sectorSendMinute: value })} />
                            </div>
                          </div>
                        </div>
                        <div className="settings-ops-item h-[180px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">정기발송 간격</h2>
                            <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">정기 홈 리포트를 몇 분마다 보낼지</p>
                            <div className="mt-auto mb-auto grid max-w-full grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] items-center settings-control-inset">
                              <div className="col-start-2">
                                <IntervalDial label="정기발송 간격" unit="분" size={100} value={draft.sectorSendIntervalMinutes} step={saved.collectIntervalMinutes} onChange={value => updateDraft({ sectorSendIntervalMinutes: value })} />
                              </div>
                              <span className="col-start-3 ml-3 inline-flex h-5 w-[42px] shrink-0 items-center justify-center rounded-[4px] bg-ui-control px-1.5 text-xs font-semibold leading-none tabular-nums text-ui-white" aria-live="polite">
                                {draft.sectorSendIntervalMinutes}분
                              </span>
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
