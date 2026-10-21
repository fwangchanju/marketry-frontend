import { useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminAccessFrequency, getAdminDailyAccess, getAdminMemberSummary, getAdminSignups } from '@/api/adminMembers'
import DailyAccessChart from '@/components/DailyAccessChart'
import GrowthLineChart from '@/components/GrowthLineChart'
import HorizontalBarsChart from '@/components/HorizontalBarsChart'
import MemberCompositionChart from '@/components/MemberCompositionChart'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'

const PERIOD_OPTIONS = [14, 30] as const
type Period = (typeof PERIOD_OPTIONS)[number]
// 가입 추이 차트에 보여 줄 수 있는 기간(일).
const SIGNUP_PERIOD_OPTIONS = [30, 90, 180] as const
type SignupPeriod = (typeof SIGNUP_PERIOD_OPTIONS)[number]
// 접속 빈도 구간의 막대 색 — 자주 올수록 진한 청록이고, 한 번도 안 온 회원은 흐린 회색이다.
const FREQUENCY_BAR_CLASSES = ['bg-ui-muted', 'bg-[var(--brand)]/35', 'bg-[var(--brand)]/55', 'bg-[var(--brand)]/80', 'bg-[var(--brand)]']

// 관리자 전용 대시보드 — 회원 명단(/admin/member)과 떨어뜨려 회원 이용 현황을 작은 차트 여러 개로 모아 본다(홈 화면의 틀처럼 한 칸에 차트 하나).
// 화면에서 숨기는 것과 별개로 서버도 /api/admin/** 을 ADMIN만 허용한다. 관리자가 아니면 안내 문구만 보여 준다.
export default function AdminDashboardPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = session?.authenticated === true && session.role === 'ADMIN'
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsPanelSide()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [period, setPeriod] = useState<Period>(14)
  const [signupPeriod, setSignupPeriod] = useState<SignupPeriod>(90)
  const screenshotRef = useRef<HTMLDivElement>(null)
  const dailyAccess = useQuery({
    queryKey: ['admin-member-daily-access', session?.userId, period],
    queryFn: ({ signal }) => getAdminDailyAccess(period, signal),
    enabled: isAdmin,
    staleTime: 30_000,
    retry: false,
  })

  const signups = useQuery({
    queryKey: ['admin-member-signups', session?.userId, signupPeriod],
    queryFn: ({ signal }) => getAdminSignups(signupPeriod, signal),
    enabled: isAdmin,
    staleTime: 30_000,
    retry: false,
  })
  const accessFrequency = useQuery({
    queryKey: ['admin-member-access-frequency', session?.userId],
    queryFn: ({ signal }) => getAdminAccessFrequency(signal),
    enabled: isAdmin,
    staleTime: 30_000,
    retry: false,
  })
  const summary = useQuery({
    queryKey: ['admin-member-summary', session?.userId],
    queryFn: ({ signal }) => getAdminMemberSummary(signal),
    enabled: isAdmin,
    staleTime: 30_000,
    retry: false,
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

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => undefined}
            isRefreshing={false}
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
              <section aria-label="회원 대시보드" className="flex h-full min-h-0 w-full flex-col text-sm">
                <Toolbar>
                  <ToolbarModeText page="ADMIN" label="DASHBOARD" />
                </Toolbar>
                {/* 차트 한 개가 한 칸 — 화면을 가득 채우지 않고 칸 크기는 고정이며, 차트가 늘면 칸이 옆·아래로 늘어난다. */}
                <div className="grid min-h-0 flex-1 auto-rows-[280px] grid-cols-[repeat(auto-fill,minmax(380px,1fr))] content-start gap-3 overflow-auto px-3 pb-6 pt-3">
                  <ChartFrame
                    title="일별 접속 회원 수"
                    note="하루에 접속한 서로 다른 회원 수"
                  >
                    {dailyAccess.isError ? (
                      <p role="alert" className="m-0 text-sm text-ui-text">불러오지 못했습니다.</p>
                    ) : dailyAccess.data ? (
                      <DailyAccessChart rows={dailyAccess.data} />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="회원 구성" note="관리자 · 특별 회원 · 일반 회원">
                    {summary.isError ? (
                      <p role="alert" className="m-0 text-sm text-ui-text">불러오지 못했습니다.</p>
                    ) : summary.data ? (
                      <MemberCompositionChart counts={summary.data} />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="일별 신규 가입" note={`하루에 가입한 회원 수 · 최근 ${signupPeriod}일`}>
                    {signups.isError ? (
                      <p role="alert" className="m-0 text-sm text-ui-text">불러오지 못했습니다.</p>
                    ) : signups.data ? (
                      <DailyAccessChart rows={signups.data.map(row => ({ date: row.date, members: row.joined }))} ariaLabelPrefix="일별 신규 가입" />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="누적 회원 수" note={`가입 시점부터 쌓인 전체 회원 수 · 최근 ${signupPeriod}일`}>
                    {signups.isError ? (
                      <p role="alert" className="m-0 text-sm text-ui-text">불러오지 못했습니다.</p>
                    ) : signups.data ? (
                      <GrowthLineChart rows={signups.data} />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="접속 빈도" note="최근 30일 중 며칠 접속했나 · 구간별 회원 수">
                    {accessFrequency.isError ? (
                      <p role="alert" className="m-0 text-sm text-ui-text">불러오지 못했습니다.</p>
                    ) : accessFrequency.data ? (
                      <HorizontalBarsChart
                        ariaLabel="접속 빈도 분포"
                        labelWidth={64}
                        rows={accessFrequency.data.map((row, index) => ({
                          key: row.label,
                          label: row.label,
                          count: row.members,
                          barClass: FREQUENCY_BAR_CLASSES[index] ?? 'bg-[var(--brand)]',
                          textClass: 'text-ui-text',
                        }))}
                      />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
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
              >
                <SettingsPanelGroup section="adminManage">
                  <div className="settings-plain-content">
                    <div className="settings-ops-item h-[160px] text-sm">
                      <div className="settings-custom-control">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">일별 접속 기간</h2>
                        <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-ui-muted">일별 접속 회원 수 차트에 보여 줄 기간</p>
                        <div role="radiogroup" aria-label="일별 접속 기간" className="mt-4 grid max-w-[16rem] settings-control-inset grid-cols-2 gap-[6px]">
                          {PERIOD_OPTIONS.map(option => (
                            <button
                              key={option}
                              type="button"
                              role="radio"
                              aria-checked={period === option}
                              onClick={() => setPeriod(option)}
                              className={`flex h-7 items-center justify-center settings-chip-hover rounded-[4px] border-0 text-[13px] ${period === option ? 'bg-[var(--brand-surface)] font-bold text-ui-white' : 'bg-[var(--ui-control)] font-medium text-ui-white'}`}
                            >
                              {option}일
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="settings-ops-item h-[160px] text-sm">
                      <div className="settings-custom-control">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">가입 추이 기간</h2>
                        <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-ui-muted">신규 가입·누적 회원 수 차트에 보여 줄 기간</p>
                        <div role="radiogroup" aria-label="가입 추이 기간" className="mt-4 grid max-w-[16rem] settings-control-inset grid-cols-3 gap-[6px]">
                          {SIGNUP_PERIOD_OPTIONS.map(option => (
                            <button
                              key={option}
                              type="button"
                              role="radio"
                              aria-checked={signupPeriod === option}
                              onClick={() => setSignupPeriod(option)}
                              className={`flex h-7 items-center justify-center settings-chip-hover rounded-[4px] border-0 text-[13px] ${signupPeriod === option ? 'bg-[var(--brand-surface)] font-bold text-ui-white' : 'bg-[var(--ui-control)] font-medium text-ui-white'}`}
                            >
                              {option}일
                            </button>
                          ))}
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

// 차트 한 칸 — 왼쪽 위에 제목 배지(홈 화면의 틀 제목과 같은 짙은 청록), 오른쪽 위에 조작, 그 아래에 설명과 차트를 둔다.
function ChartFrame({ title, note, actions, children }: { title: string; note: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-h-0 flex-col border border-ui-border px-3 pb-3 pt-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="rounded bg-[var(--brand-surface)] px-2 py-1 text-sm leading-none font-semibold text-ui-white">{title}</span>
        {actions}
      </div>
      <p className="m-0 mt-2 shrink-0 text-xs text-ui-muted">{note}</p>
      <div className="mt-3 flex min-h-0 flex-1 items-end">{children}</div>
    </section>
  )
}
