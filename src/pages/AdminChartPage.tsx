import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAdminDailyAccess } from '@/api/adminMembers'
import DailyAccessChart from '@/components/DailyAccessChart'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession } from '@/hooks/useSession'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'

const PERIOD_OPTIONS = [14, 30, 90] as const
type Period = (typeof PERIOD_OPTIONS)[number]

// 관리자 전용 차트 페이지 — 회원 명단(/admin/member)과 떨어뜨려 회원 이용 추이를 그래프로 본다.
// 화면에서 숨기는 것과 별개로 서버도 /api/admin/** 을 ADMIN만 허용한다. 관리자가 아니면 안내 문구만 보여 준다.
export default function AdminChartPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = session?.authenticated === true && session.role === 'ADMIN'
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const [period, setPeriod] = useState<Period>(14)
  const screenshotRef = useRef<HTMLDivElement>(null)
  const dailyAccess = useQuery({
    queryKey: ['admin-member-daily-access', session?.userId, period],
    queryFn: ({ signal }) => getAdminDailyAccess(period, signal),
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
              <section aria-label="회원 차트" className="flex h-full min-h-0 w-full flex-col text-sm">
                <Toolbar>
                  <ToolbarModeText page="ADMIN" label="CHART" />
                </Toolbar>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pb-6 pt-3">
                  <div className="flex items-center gap-3">
                    <h2 className="m-0 text-base font-bold text-ui-white">일별 접속 회원 수</h2>
                    <div role="radiogroup" aria-label="기간" className="flex items-center gap-1">
                      {PERIOD_OPTIONS.map(option => (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={period === option}
                          onClick={() => setPeriod(option)}
                          className={`h-6 rounded-[4px] border-0 px-2 text-sm transition-colors ${period === option ? 'bg-[var(--brand-surface)] font-bold text-ui-white' : 'bg-[var(--ui-panel)] font-normal text-ui-text hover:text-ui-white'}`}
                        >
                          {option}일
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-ui-muted">하루에 한 번이라도 접속한 서로 다른 회원 수 · 접속 기록은 기록을 시작한 날부터입니다.</span>
                  </div>
                  <div className="min-h-[260px] flex-1 border border-ui-border px-3 pb-3 pt-4">
                    {dailyAccess.isError ? (
                      <p role="alert" className="m-0 text-base text-ui-text">차트 정보를 불러오지 못했습니다.</p>
                    ) : dailyAccess.data ? (
                      <DailyAccessChart rows={dailyAccess.data} />
                    ) : (
                      <p role="status" className="m-0 text-base text-ui-text">불러오는 중입니다.</p>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>
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
