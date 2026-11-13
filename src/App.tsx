import { lazy, Suspense, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'
import MobileMarketSummaryPage from './pages/MobileMarketSummaryPage'
import MobileHomePage from './pages/MobileHomePage'
import LoginGateProvider from './components/LoginGateProvider'
import AppDialogHost from './components/AppDialogHost'
import HoverHintLayer from './components/HoverHintLayer'
import MobileNotice from './components/MobileNotice'
import SearchMetadata from './components/SearchMetadata'
import Spinner from './components/Spinner'
import { marketRoute } from '@/utils/marketRoute'
import { useIsNarrowScreen } from './hooks/useIsNarrowScreen'
import { useSession } from './hooks/useSession'
import { isAdminSession, isSpecialSession } from './utils/adminAccess'
import { metricPageFromPath, reportClientMetric } from './utils/clientMetrics'

// 화면별로 코드를 나눠 받는다. 모바일 홈·지도는 첫 화면이라 바로 번들에 두고,
// PC 전용·관리자·글 페이지는 해당 주소를 열 때만 내려받는다.
const MarketSummaryPage = lazy(() => import('./pages/MarketSummaryPage'))
const MapPage = lazy(() => import('./pages/MapPage'))
const GroupPage = lazy(() => import('./pages/GroupPage'))
const CustomPage = lazy(() => import('./pages/CustomPage'))
const JapanStockPage = lazy(() => import('./pages/JapanStockPage'))
const JapanSectorPage = lazy(() => import('./pages/JapanSectorPage'))
const JapanMapPage = lazy(() => import('./pages/JapanMapPage'))
const JapanGraphPage = lazy(() => import('./pages/JapanGraphPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const SourcePage = lazy(() => import('./pages/SourcePage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const GuidePage = lazy(() => import('./pages/GuidePage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'))
const AdminMessagePage = lazy(() => import('./pages/AdminMessagePage'))
const AdminDefaultPage = lazy(() => import('./pages/AdminDefaultPage'))
const AdminBannerPage = lazy(() => import('./pages/AdminBannerPage'))

function ClientMetricsReporter() {
  const { pathname } = useLocation()
  useEffect(() => {
    const page = metricPageFromPath(pathname)
    if (!page) return
    const startedAt = performance.now()
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => reportClientMetric(page, 'PAGE_LOAD', performance.now() - startedAt))
    })
    const onError = () => reportClientMetric(page, 'CLIENT_ERROR')
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onError)
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onError)
    }
  }, [pathname])
  return null
}

// 페이지 전체와 document.body로 포털 렌더링한 메뉴/팝업에 같은 숫자 폭 규칙을 적용한다.
// 공통 스냅샷 날짜·시간도 FONT_BAR_TIME에서 동일한 숫자 폭을 명시한다.
function PageNumberStyle() {
  const { pathname } = useLocation()
  const useTabularNumbers = pathname === '/graph' || pathname.startsWith('/graph/')
    || pathname === '/custom' || pathname.startsWith('/custom/')

  useLayoutEffect(() => {
    document.body.classList.toggle('tabular-nums', useTabularNumbers)
    return () => document.body.classList.remove('tabular-nums')
  }, [useTabularNumbers])

  return null
}

// 시장이 주소 조각으로 오기 전의 옛 주소(/map?market=KOSPI)를 지금 주소(/map/kospi)로 옮긴다.
// ?market=은 경로 조각보다 먼저 지워지므로 그대로 두면 값이 사라진다 — 시장 값을 경로로 바꾸고, 나머지 쿼리와 해시는 그대로 둔다.
function LegacyMarketRedirect({ basePath }: { basePath: '/map' | '/graph' }) {
  const { search, hash } = useLocation()
  const params = new URLSearchParams(search)
  const marketParam = params.get('market')
  const market = marketParam === 'KOSPI' || marketParam === 'KOSDAQ' || marketParam === 'ALL_STOCK' ? marketParam : null
  if (market) params.delete('market')
  const rest = params.toString()
  return <Navigate to={`${marketRoute(basePath, market ?? 'ALL_STOCK')}${rest ? `?${rest}` : ''}${hash}`} replace />
}

function AdminRouteGuard() {
  const { data: session, isLoading } = useSession()
  if (isLoading) return null
  return isAdminSession(session) ? <Outlet /> : <Navigate to="/home" replace />
}

function SpecialRouteGuard() {
  const { data: session, isLoading } = useSession()
  if (isLoading) return null
  return isSpecialSession(session) ? <Outlet /> : <Navigate to="/home" replace />
}

function ResponsiveHomePage() {
  const isNarrow = useIsNarrowScreen()
  const [searchParams] = useSearchParams()
  // 모바일의 업종 지도는 홈 주소에 ?map을 붙여 연다(PC 홈은 이 값을 읽지 않는다).
  if (isNarrow && searchParams.has('map')) return <MobileMarketSummaryPage mode="sector" />
  return isNarrow ? <MobileHomePage /> : <MarketSummaryPage />
}

function ResponsiveGraphPage() {
  const isNarrow = useIsNarrowScreen()
  return isNarrow ? <MobileMarketSummaryPage mode="graph" /> : <GroupPage />
}

function ResponsiveMapPage() {
  const isNarrow = useIsNarrowScreen()
  return isNarrow ? <MobileMarketSummaryPage mode="stock" /> : <MapPage />
}

// 모바일(폭 768px 미만)에서는 홈·지도(모바일 요약 화면)와 글 페이지만 열고, 그 밖의 PC 전용 화면은 안내만 보여 준다.
// 글 페이지(/info 아래의 가이드·개인정보처리방침·데이터·약관·문의)는 모바일 틀(MobileDocumentShell)이 있어 모바일에서도 열린다.
function isMobileOpenPath(pathname: string) {
  return pathname === '/info' || pathname.startsWith('/info/')
}

function isMobileMarketPath(pathname: string) {
  // 첫 화면(/)은 곧 /home으로 옮겨 가지만, 폰 화면 판정이 먼저 일어나므로 여기서도 열어 둔다.
  return pathname === '/' || pathname === '/home' || pathname === '/map' || pathname.startsWith('/map/') || pathname === '/graph' || pathname.startsWith('/graph/')
}

function MobileGate({ children }: { children: ReactNode }) {
  const isNarrow = useIsNarrowScreen()
  const { pathname } = useLocation()
  if (isNarrow && !isMobileOpenPath(pathname) && !isMobileMarketPath(pathname)) return <MobileNotice />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <SearchMetadata />
      <ClientMetricsReporter />
      <AppDialogHost />
      <HoverHintLayer />
      <MobileGate>
      <LoginGateProvider>
        <PageNumberStyle />
        <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<ResponsiveHomePage />} />
          <Route path="/map" element={<LegacyMarketRedirect basePath="/map" />} />
          <Route path="/map/kospi" element={<ResponsiveMapPage />} />
          <Route path="/map/kosdaq" element={<ResponsiveMapPage />} />
          <Route path="/map/korea" element={<ResponsiveMapPage />} />
          <Route path="/graph" element={<LegacyMarketRedirect basePath="/graph" />} />
          <Route path="/graph/kospi" element={<ResponsiveGraphPage />} />
          <Route path="/graph/kosdaq" element={<ResponsiveGraphPage />} />
          <Route path="/graph/korea" element={<ResponsiveGraphPage />} />
          {/* 커스텀 관리의 주소는 /custom 아래에서 업종·종목 화면으로 나뉜다. */}
          <Route path="/custom" element={<Navigate to="/custom/sector" replace />} />
          <Route path="/custom/sector" element={<CustomPage />} />
          <Route path="/custom/stock" element={<CustomPage />} />
          <Route element={<SpecialRouteGuard />}>
            <Route path="/custom/stock/japan" element={<JapanStockPage />} />
            <Route path="/custom/sector/japan" element={<JapanSectorPage />} />
            <Route path="/map/japan" element={<JapanMapPage />} />
            <Route path="/graph/japan" element={<JapanGraphPage />} />
          </Route>
          {/* Google OAuth 동의 화면에 등록하는 공개 페이지 — 로그인 여부와 무관하게 누구나 볼 수 있다. */}
          <Route path="/info" element={<Navigate to="/info/guide" replace />} />
          <Route path="/info/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/info/terms" element={<TermsPage />} />
          <Route path="/info/source" element={<SourcePage />} />
          <Route path="/info/contact" element={<ContactPage />} />
          <Route path="/info/guide" element={<GuidePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* 관리자 페이지는 /admin 아래에서 회원 명단, 대시보드(차트 모음), 메시지, 배너로 나뉜다. */}
          <Route path="/admin" element={<AdminRouteGuard />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="member" element={<AdminPage />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="message" element={<AdminMessagePage />} />
            <Route path="default" element={<AdminDefaultPage />} />
            <Route path="banner" element={<AdminBannerPage />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
        </Suspense>
      </LoginGateProvider>
      </MobileGate>
    </BrowserRouter>
  )
}
