import { useEffect, useLayoutEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MapPage from './pages/MapPage'
import GroupPage from './pages/GroupPage'
import CustomPage from './pages/CustomPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsPage from './pages/TermsPage'
import SourcePage from './pages/SourcePage'
import ContactPage from './pages/ContactPage'
import MobileMarketSummaryPage from './pages/MobileMarketSummaryPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminMessagePage from './pages/AdminMessagePage'
import AdminBannerPage from './pages/AdminBannerPage'
import LoginGateProvider from './components/LoginGateProvider'
import AppDialogHost from './components/AppDialogHost'
import HoverHintLayer from './components/HoverHintLayer'
import MobileNotice from './components/MobileNotice'
import SearchMetadata from './components/SearchMetadata'
import { marketRoute } from '@/utils/marketRoute'
import { useIsNarrowScreen } from './hooks/useIsNarrowScreen'
import { useSession } from './hooks/useSession'
import { isAdminSession } from './utils/adminAccess'
import { metricPageFromPath, reportClientMetric } from './utils/clientMetrics'

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

function LegacyGroupRedirect() {
  const { pathname, search, hash } = useLocation()
  const groupPath = pathname.replace(/^\/(?:group|sector|industry)(?=\/|$)/, '/graph')
  return <Navigate to={`${groupPath}${search}${hash}`} replace />
}

function AdminRouteGuard() {
  const { data: session, isLoading } = useSession()
  if (isLoading) return null
  return isAdminSession(session) ? <Outlet /> : <Navigate to="/home" replace />
}

function ResponsiveHomePage() {
  const isNarrow = useIsNarrowScreen()
  return isNarrow ? <MobileMarketSummaryPage /> : <MarketSummaryPage />
}

function ResponsiveMapPage() {
  const isNarrow = useIsNarrowScreen()
  return isNarrow ? <MobileMarketSummaryPage /> : <MapPage />
}

// 모바일은 홈 요약 화면을 제공한다. 그 밖의 PC 전용 지도·그래프·관리 화면은 안내만 보여 준다.
// 개인정보처리방침은 Google OAuth 동의 화면에 등록된 공개 페이지라 모바일에서도 열린다.
function MobileGate({ children }: { children: ReactNode }) {
  const isNarrow = useIsNarrowScreen()
  const { pathname } = useLocation()
  const isMobileMarketRoute = pathname === '/home' || pathname === '/summary' || pathname === '/map' || pathname.startsWith('/map/')
  if (isNarrow && pathname !== '/privacy' && pathname !== '/info/privacy' && !isMobileMarketRoute) return <MobileNotice />
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
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<ResponsiveHomePage />} />
          <Route path="/summary" element={<Navigate to="/home" replace />} />
          <Route path="/map" element={<LegacyMarketRedirect basePath="/map" />} />
          <Route path="/map/kospi" element={<ResponsiveMapPage />} />
          <Route path="/map/kosdaq" element={<ResponsiveMapPage />} />
          <Route path="/map/allstock" element={<ResponsiveMapPage />} />
          <Route path="/graph" element={<LegacyMarketRedirect basePath="/graph" />} />
          <Route path="/graph/kospi" element={<GroupPage />} />
          <Route path="/graph/kosdaq" element={<GroupPage />} />
          <Route path="/graph/allstock" element={<GroupPage />} />
          <Route path="/group" element={<LegacyGroupRedirect />} />
          <Route path="/group/*" element={<LegacyGroupRedirect />} />
          <Route path="/sector" element={<LegacyGroupRedirect />} />
          <Route path="/sector/*" element={<LegacyGroupRedirect />} />
          <Route path="/industry" element={<LegacyGroupRedirect />} />
          <Route path="/industry/*" element={<LegacyGroupRedirect />} />
          {/* 커스텀 관리의 주소는 /custom 아래에서 업종·종목 화면으로 나뉜다. */}
          <Route path="/custom" element={<Navigate to="/custom/sector" replace />} />
          <Route path="/custom/sector" element={<CustomPage />} />
          {/* 예전 주소(/custom/industry)로 들어와도 새 주소로 보낸다. */}
          <Route path="/custom/industry" element={<Navigate to="/custom/sector" replace />} />
          <Route path="/custom/category" element={<Navigate to="/custom/sector" replace />} />
          <Route path="/custom/stock" element={<CustomPage />} />
          {/* Google OAuth 동의 화면에 등록하는 공개 페이지 — 로그인 여부와 무관하게 누구나 볼 수 있다. */}
          <Route path="/info" element={<Navigate to="/info/source" replace />} />
          <Route path="/info/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/info/terms" element={<TermsPage />} />
          <Route path="/info/source" element={<SourcePage />} />
          <Route path="/info/contact" element={<ContactPage />} />
          {/* 이전 주소와 Google OAuth에 등록된 /privacy 주소도 새 정보 경로로 보낸다. */}
          <Route path="/privacy" element={<Navigate to="/info/privacy" replace />} />
          <Route path="/terms" element={<Navigate to="/info/terms" replace />} />
          <Route path="/source" element={<Navigate to="/info/source" replace />} />
          <Route path="/contact" element={<Navigate to="/info/contact" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* 관리자 페이지는 /admin 아래에서 회원 명단, 대시보드(차트 모음), 메시지, 배너로 나뉜다. */}
          <Route path="/admin" element={<AdminRouteGuard />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="member" element={<AdminPage />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="message" element={<AdminMessagePage />} />
            <Route path="banner" element={<AdminBannerPage />} />
            <Route path="chart" element={<Navigate to="/admin/dashboard" replace />} />
            {/* 기존 링크와 로그인 returnTo 호환을 위해 이전 주소는 새 주소로 보낸다. */}
            <Route path="sector" element={<Navigate to="/custom/sector" replace />} />
            <Route path="stock" element={<Navigate to="/custom/stock" replace />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </LoginGateProvider>
      </MobileGate>
    </BrowserRouter>
  )
}
