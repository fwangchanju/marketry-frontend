import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminAccessFrequency, getAdminDailyAccess, getAdminSignups, getAdminVisitorSources, getAdminVisitors } from '@/api/adminMembers'
import { getAdminDashboardMetrics } from '@/api/adminDashboard'
import DailyAccessChart from '@/components/DailyAccessChart'
import FrameBadge from '@/components/FrameBadge'
import GrowthLineChart from '@/components/GrowthLineChart'
import HorizontalBarsChart from '@/components/HorizontalBarsChart'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import SettingsSegmentedControl from '@/components/SettingsSegmentedControl'
import Toolbar from '@/components/Toolbar'
import StackedDailyChart, { StackedDailyLegend, type StackedDailyRow } from '@/components/StackedDailyChart'
import ToolbarModeText from '@/components/ToolbarModeText'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { isAdminSession } from '@/utils/adminAccess'
import { formatCount } from '@/utils/formatCount'

// 모든 차트가 같이 쓰는 기간(일) — 서버의 일별 접속 조회 한도(90일)를 넘지 않는다. 접속 빈도만 최근 30일로 고정이다.
const PERIOD_OPTIONS = [7, 14, 30, 90] as const
type Period = (typeof PERIOD_OPTIONS)[number]
const DASHBOARD_CARD_MIN_HEIGHT = 280
const DASHBOARD_GRID_GAP = 12
// 접속 빈도 구간의 막대 색 — 자주 올수록 진한 청록이고, 한 번도 안 온 회원은 흐린 회색이다.
const VISITOR_SOURCE_LABELS = { NAVER: '네이버', GOOGLE: '구글', DIRECT: '직접', OTHER: '기타' } as const
const DASHBOARD_PAGE_LABELS: Record<string, string> = { HOME: 'Home', MAP: 'Map', GRAPH: 'Graph', CUSTOM: 'Custom' }
const FREQUENCY_BAR_CLASSES = ['bg-ui-muted', 'bg-[var(--brand)]/35', 'bg-[var(--brand)]/50', 'bg-[var(--brand)]/85', 'bg-[var(--brand)]']

// 관리자 전용 대시보드 — 회원 명단(/admin/member)과 떨어뜨려 회원 이용 현황을 작은 차트 여러 개로 모아 본다(홈 화면의 틀처럼 한 칸에 차트 하나).
// 화면에서 숨기는 것과 별개로 서버도 /api/admin/** 을 ADMIN만 허용한다. 관리자가 아니면 안내 문구만 보여 준다.
export default function AdminDashboardPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = isAdminSession(session)
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsPanelSide()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [period, setPeriod] = useState<Period>(14)
  const screenshotRef = useRef<HTMLDivElement>(null)
  const dashboardGridRef = useRef<HTMLDivElement>(null)
  const [dashboardRowSize, setDashboardRowSize] = useState({ count: 1, height: DASHBOARD_CARD_MIN_HEIGHT })

  useLayoutEffect(() => {
    const grid = dashboardGridRef.current
    if (!grid) return
    const updateRows = () => {
      const availableHeight = grid.clientHeight
      const count = Math.max(1, Math.floor((availableHeight + DASHBOARD_GRID_GAP) / (DASHBOARD_CARD_MIN_HEIGHT + DASHBOARD_GRID_GAP)))
      const height = Math.max(DASHBOARD_CARD_MIN_HEIGHT, (availableHeight - DASHBOARD_GRID_GAP * (count - 1)) / count)
      setDashboardRowSize(previous => previous.count === count && previous.height === height ? previous : { count, height })
    }
    const observer = new ResizeObserver(updateRows)
    observer.observe(grid)
    updateRows()
    return () => observer.disconnect()
  }, [isAdmin, isLoading])
  const dailyAccess = useQuery({
    queryKey: ['admin-member-daily-access', session?.userId, period],
    queryFn: ({ signal }) => getAdminDailyAccess(period, signal),
    enabled: isAdmin,
    staleTime: 30_000,
    retry: false,
  })

  const signups = useQuery({
    queryKey: ['admin-member-signups', session?.userId, period],
    queryFn: ({ signal }) => getAdminSignups(period, signal),
    enabled: isAdmin,
    staleTime: 30_000,
    retry: false,
  })
  const visitors = useQuery({
    queryKey: ['admin-member-visitors', session?.userId, period],
    queryFn: ({ signal }) => getAdminVisitors(period, signal),
    enabled: isAdmin,
    staleTime: 30_000,
    retry: false,
  })
  // 방문자를 세기 시작한 날부터만 합친다 — 그 전 날의 가입까지 더하면 전환율이 부풀려진다.
  const countedDays = (visitors.data ?? []).filter(row => row.visitors > 0)
  const totalVisitors = countedDays.reduce((sum, row) => sum + row.visitors, 0)
  const totalJoined = countedDays.reduce((sum, row) => sum + row.joined, 0)
  const visitorSources = useQuery({
    queryKey: ['admin-member-visitor-sources', session?.userId, period],
    queryFn: ({ signal }) => getAdminVisitorSources(period, signal),
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
  const dashboardMetrics = useQuery({
    queryKey: ['admin-dashboard-metrics', session?.userId, period],
    queryFn: ({ signal }) => getAdminDashboardMetrics(period, signal),
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
        <div className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
          <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background text-ui-white">
            {isLoading ? (
              <p role="status" className="m-auto text-base text-ui-text">관리자 권한을 확인하는 중입니다.</p>
            ) : !isAdmin ? (
              <p className="m-auto text-center text-base text-ui-text">관리자 전용 페이지입니다.</p>
            ) : (
              <section aria-label="회원 대시보드" className="flex min-h-0 flex-1 w-full flex-col text-sm">
                <Toolbar>
                  <ToolbarModeText page="ADMIN" label="DASHBOARD" />
                </Toolbar>
                <div
                  ref={dashboardGridRef}
                  className="grid min-h-0 flex-1 auto-rows-[280px] grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-3 overflow-auto"
                  style={{ gridTemplateRows: `repeat(${dashboardRowSize.count}, ${dashboardRowSize.height}px)` }}
                >
                  <ChartFrame title="총 방문자" headerContent={<StackedDailyLegend />}>
                    {visitors.isError || dailyAccess.isError ? (
                      <DashboardMetricError />
                    ) : visitors.data && dailyAccess.data ? (
                      <StackedDailyChart rows={totalVisitorRows(visitors.data, dailyAccess.data)} showLegend={false} />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="방문자 수" note="비회원 방문">
                    {visitors.isError ? (
                      <DashboardMetricError />
                    ) : visitors.data ? (
                      <DailyAccessChart rows={visitors.data.map(row => ({ date: row.date, members: row.visitors }))} ariaLabelPrefix="비회원 방문자 수" />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="신규 가입" note="가입 회원 수">
                    {signups.isError ? (
                      <DashboardMetricError />
                    ) : signups.data ? (
                      <DailyAccessChart rows={signups.data.map(row => ({ date: row.date, members: row.joined }))} ariaLabelPrefix="신규 가입" />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="가입 전환율" note="방문자 가입률">
                    {visitors.isError ? (
                      <DashboardMetricError />
                    ) : visitors.data ? (
                      totalVisitors === 0 ? (
                        <p className="m-0 w-full self-center text-center text-sm text-ui-text">아직 센 방문자가 없습니다.</p>
                      ) : (
                        <div className="flex w-full flex-col items-center gap-2 self-center">
                          <span className="text-5xl font-bold leading-none tabular-nums text-ui-white">{((totalJoined / totalVisitors) * 100).toFixed(1)}%</span>
                          <span className="text-xs font-medium text-ui-white">방문자 {formatCount(totalVisitors)}명 중 {formatCount(totalJoined)}명 가입</span>
                          <span className="text-xs text-ui-muted">방문자를 세기 시작한 {countedDays.length}일 기준</span>
                        </div>
                      )
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="유입 경로" note="비회원 유입 경로">
                    {visitorSources.isError ? (
                      <DashboardMetricError />
                    ) : visitorSources.data ? (
                      <HorizontalBarsChart
                        ariaLabel="유입 경로 분포"
                        labelWidth={64}
                        rows={visitorSources.data.map(row => ({
                          key: row.source,
                          label: VISITOR_SOURCE_LABELS[row.source],
                          count: row.visitors,
                          barClass: 'bg-[var(--brand)]',
                          textClass: 'text-ui-text',
                        }))}
                      />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="첫 분류 완료율" note="가입 7일 내 첫 종목 분류 비율">
                    {dashboardMetrics.isError ? <DashboardMetricError /> : dashboardMetrics.data ? (
                      <RateMetric numerator={dashboardMetrics.data.classifiedMembers} denominator={dashboardMetrics.data.classificationEligibleMembers} emptyText="관찰 가능한 가입자가 없습니다." />
                    ) : <DashboardMetricLoading />}
                  </ChartFrame>
                  <ChartFrame
                    title="접속 회원 수"
                    note="일별 접속 회원 수"
                  >
                    {dailyAccess.isError ? (
                      <DashboardMetricError />
                    ) : dailyAccess.data ? (
                      <DailyAccessChart rows={dailyAccess.data} />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="접속 빈도" note="최근 30일 접속일별 회원 수">
                    {accessFrequency.isError ? (
                      <DashboardMetricError />
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
                  <ChartFrame title="7일 재방문율" note="가입 후 7일 내 재방문 비율">
                    {dashboardMetrics.isError ? <DashboardMetricError /> : dashboardMetrics.data ? (
                      <RateMetric numerator={dashboardMetrics.data.returningMembers} denominator={dashboardMetrics.data.revisitEligibleMembers} emptyText="7일 접속 기록이 쌓이는 중입니다." />
                    ) : <DashboardMetricLoading />}
                  </ChartFrame>
                  <ChartFrame title="누적 회원 수" note="전체 누적 회원 수">
                    {signups.isError ? (
                      <DashboardMetricError />
                    ) : signups.data ? (
                      <GrowthLineChart rows={signups.data} />
                    ) : (
                      <p role="status" className="m-0 text-sm text-ui-text">불러오는 중입니다.</p>
                    )}
                  </ChartFrame>
                  <ChartFrame title="화면 속도·오류" note="화면별 첫 렌더링·오류, 지도 캡처 시간">
                    {dashboardMetrics.isError ? <DashboardMetricError /> : dashboardMetrics.data ? (
                      <div className="w-full self-center px-1">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-ui-border pb-1 text-[10px] text-ui-muted"><span>화면</span><span>첫 렌더링 평균</span><span>오류</span></div>
                        {dashboardMetrics.data.pages.length ? dashboardMetrics.data.pages.map(row => (
                          <div key={row.page} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-ui-border/50 py-1.5 text-xs text-ui-text">
                            <span>{DASHBOARD_PAGE_LABELS[row.page] ?? row.page}</span>
                            <span className="tabular-nums">{row.pageLoads ? `${row.averageLoadMs} ms` : '—'}</span>
                            <span className="min-w-5 text-right tabular-nums">{formatCount(row.clientErrors)}</span>
                          </div>
                        )) : <p className="m-0 py-3 text-center text-xs text-ui-muted">화면 지표를 수집하는 중입니다.</p>}
                        <div className="mt-3 flex items-center justify-between gap-2 text-xs"><span className="text-ui-muted">모바일 지도 캡처 평균</span><span className="font-medium tabular-nums text-ui-white">{dashboardMetrics.data.mobileCaptures ? `${dashboardMetrics.data.averageMobileCaptureMs} ms · ${formatCount(dashboardMetrics.data.mobileCaptures)}회` : '기록 대기'}</span></div>
                      </div>
                    ) : <DashboardMetricLoading />}
                  </ChartFrame>
                </div>
              </section>
            )}
            <DisclaimerFooter />
          </div>
          {isAdmin && (
            <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
              <SettingsPanel
                pageLabel="Dashboard"
                showPreferenceActions={false}
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                isOnLeft={isSettingsOnLeft}
                onToggleSide={toggleSettingsSide}
                sectionOrder={['adminManage']}
                sectionIconOverrides={{ adminManage: 'dashboard' }}
                sectionLabelOverrides={{ adminManage: '대시보드' }}
              >
                <SettingsPanelGroup section="adminManage">
                  <div className="settings-plain-content">
                    <div className="settings-ops-item h-[180px] text-sm">
                      <div className="settings-custom-control">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">기간</h2>
                        <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">모든 차트에 보여 줄 기간</p>
                        <SettingsSegmentedControl label="기간" options={PERIOD_OPTIONS.map(option => ({ value: option, label: `${option}일` }))} value={period} onChange={setPeriod} />
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

// 날짜별 비회원 방문자 수와 그날 접속한 회원 수를 한 줄로 묶는다. 같은 사람이 같은 날 비회원으로 들어왔다가 로그인하면 두 번 센다.
function totalVisitorRows(visitors: { date: string; visitors: number }[], members: { date: string; members: number }[]): StackedDailyRow[] {
  const memberCounts = new Map(members.map(row => [row.date, row.members]))
  return visitors.map(row => ({ date: row.date, guests: row.visitors, members: memberCounts.get(row.date) ?? 0 }))
}

// 차트 한 칸 — 제목 배지 오른쪽에 짧은 설명을 두고, 아래에는 차트를 둔다.
function ChartFrame({ title, note, headerContent, actions, children }: { title: string; note?: string; headerContent?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-h-0 flex-col border border-ui-border p-[7px]">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FrameBadge>{title}</FrameBadge>
          {headerContent}
          {note && <p className="m-0 min-w-0 truncate text-xs font-medium leading-tight text-ui-white">{note}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 items-end">{children}</div>
    </section>
  )
}

function DashboardMetricError() {
  return <p role="alert" className="m-auto text-sm text-ui-text">불러오지 못했습니다.</p>
}

function DashboardMetricLoading() {
  return <p role="status" className="m-auto text-sm text-ui-text">불러오는 중입니다.</p>
}

function RateMetric({ numerator, denominator, emptyText }: { numerator: number; denominator: number; emptyText: string }) {
  if (!denominator) return <p className="m-auto text-sm text-ui-muted">{emptyText}</p>
  return (
    <div className="flex w-full flex-col items-center gap-3 self-center">
      <span className="text-5xl font-bold leading-none tabular-nums text-ui-white">{((numerator / denominator) * 100).toFixed(1)}%</span>
      <span className="text-xs font-medium text-ui-white">{formatCount(numerator)}명 / {formatCount(denominator)}명</span>
      <div className="h-2 w-4/5 overflow-hidden rounded-full bg-ui-control" role="img" aria-label={`${((numerator / denominator) * 100).toFixed(1)}퍼센트`}>
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (numerator / denominator) * 100)}%` }} />
      </div>
    </div>
  )
}
