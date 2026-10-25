import { useEffect, useRef, useState } from 'react'
import MarketryLogo from '@/components/MarketryLogo'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import sampleImage from '@/assets/telegram-home-sample.png'
import sampleMapImage from '@/assets/telegram-map-sample.png'
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
import DisclaimerFooter from '@/components/DisclaimerFooter'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { HistoryIcon, SaveIcon } from '@/components/icons/AppIcons'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { isAdminSession } from '@/utils/adminAccess'

// 예시 메시지의 시각 — 샘플 이미지 툴바에 찍힌 시각(20:00)과 같게 텔레그램처럼 오전·오후로 적는다.
const SAMPLE_TIME = '오후 8:00'

const SEND_OPTIONS = [{ value: true, label: '켜기' }, { value: false, label: '끄기' }] as const

function toDraft(setting: TelegramSendSetting): TelegramSendSettingInput {
  return {
    enabled: setting.enabled,
    sectorSendMinute: setting.sectorSendMinute,
    sectorSendIntervalMinutes: setting.sectorSendIntervalMinutes,
  }
}

// 샘플 이미지와 같이 나가는 메시지 예시 — 그룹 등락률이 가장 높은 상위 업종 2개이고, 등락률 기준이 누적이라 종가·애프터 태그는 붙지 않는다.
const SAMPLE_CAPTION = '헬스케어 +1.74% / S7 +0.99%'

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
              <section aria-label="메시지" className="flex min-h-0 flex-1 w-full flex-col text-sm">
                <Toolbar>
                  <ToolbarModeText page="ADMIN" label="MESSAGE" />
                </Toolbar>
                {/* 메시지 미리보기 외곽선을 지도·그래프 본문과 같은 하단선에 맞춘다. */}
                <div className="flex min-h-0 flex-1 items-stretch gap-1 overflow-auto">
                  {setting.isError ? (
                    <p role="alert" className="m-0 text-sm text-ui-text">불러오지 못했습니다.</p>
                  ) : saved ? (
                    <div className="flex min-h-0 w-full flex-col border border-ui-border p-[7px]">
                      <div className="flex h-[26px] shrink-0 items-center gap-3">
                        <FrameBadge>텔레그램</FrameBadge>
                        {!saved.saved && <span className="text-base font-semibold leading-none text-ui-white">저장된 설정이 없어 꺼져 있고, 시각은 서버 기본값입니다.</span>}
                        <span className="text-sm text-ui-muted">실제 발송된 메시지 샘플입니다.</span>
                      </div>
                      {/* 텔레그램 대화창처럼 보이는 예시 — 한 메시지에 이미지 두 장이 앨범으로 나가고(왼쪽 시장 요약=홈 화면, 오른쪽 시장 지도=지도 페이지 모바일 캡처) 그 아래에 캡션이 붙는다.
                          캡션은 서버 캡션 형식(SectorRankingTextBuilder.buildMapCaption)과 같은 모양이며 샘플 이미지의 값이다. 수집에 실패하면 개발자에게 따로 알림이 간다. */}
                      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg bg-ui-surface">
                        <div className="flex shrink-0 items-center justify-between bg-ui-panel px-5 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <MarketryLogo layout="horizontalClean" className="h-auto w-36" />
                            <span className="text-sm text-ui-muted">구독자 2명</span>
                          </div>
                          <span className="text-sm text-admin-only">t.me/MARKETRY2026</span>
                        </div>
                        <div className="flex min-h-0 flex-1 items-center justify-center px-5">
                          <div className="flex items-end gap-3">
                            <div className="w-fit max-w-full rounded-2xl rounded-bl-md bg-ui-control p-1">
                              <p className="m-0 px-3 pb-1 pt-1.5 text-lg font-medium text-[var(--sub-yellow)]">MARKETRY</p>
                              <div className="flex gap-0.5 overflow-hidden rounded-[10px]">
                                <img src={sampleImage} alt="텔레그램으로 나가는 이미지 예시 — 시장 요약(시장 지도와 그룹 등락률)" className="block h-[min(calc(100dvh-420px),600px)] w-auto" draggable={false} />
                                <img src={sampleMapImage} alt="텔레그램으로 나가는 이미지 예시 — 시장 지도" className="block h-[min(calc(100dvh-420px),600px)] w-auto" draggable={false} />
                              </div>
                              <div className="flex items-end justify-between gap-8 px-3 pb-1.5 pt-2">
                                <p className="m-0 whitespace-pre-line text-lg leading-snug text-ui-white">{SAMPLE_CAPTION}</p>
                                <span className="flex shrink-0 items-center gap-1.5 text-sm text-ui-text">
                                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2"><path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                                  2
                                  <span>{SAMPLE_TIME}</span>
                                </span>
                              </div>
                            </div>
                            <span aria-hidden="true" className="mb-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-ui-control text-ui-text">
                              <svg viewBox="0 0 24 24" className="size-5 fill-current"><path d="M14 4v4.5C8.5 9 5 12 4 18c2.5-3 5.5-4.2 10-4.5V18l7-7Z" /></svg>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                  )}
                </div>
              </section>
            )}
            <DisclaimerFooter />
          </div>
          {isAdmin && (
            <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
              <SettingsPanel
                pageLabel="Message"
                showPreferenceActions={false}
                fixedSideTab
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
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">텔레그램 발송</h2>
                            <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">정기 리포트를 텔레그램으로 보낼지</p>
                            <SettingsSegmentedControl label="텔레그램 발송" options={SEND_OPTIONS} value={draft.enabled} onChange={value => updateDraft({ enabled: value })} />
                          </div>
                        </div>
                        <div className="settings-ops-item h-[180px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">발송 시작</h2>
                            <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">메시지 첫 발송 시각</p>
                            <div className="mt-auto mb-auto flex max-w-full settings-control-inset justify-center">
                              <DigitalClockPicker label="발송 시작" hour={saved.startHour} minute={draft.sectorSendMinute} step={saved.collectIntervalMinutes} onChange={value => updateDraft({ sectorSendMinute: value })} />
                            </div>
                          </div>
                        </div>
                        <div className="settings-ops-item h-[180px] text-sm">
                          <div className="settings-custom-control">
                            <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">발송 간격</h2>
                            <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">시장 요약/시장 지도를 몇 분마다 보낼지</p>
                            <div className="mt-auto mb-auto flex max-w-full settings-control-inset items-center justify-center">
                              <MinuteDial label="발송 간격" size={100} value={draft.sectorSendIntervalMinutes} step={saved.collectIntervalMinutes} onChange={value => updateDraft({ sectorSendIntervalMinutes: value })} />
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
