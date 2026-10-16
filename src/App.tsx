import { useLayoutEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import MarketSummaryPage from './pages/MarketSummaryPage'
import MapPage from './pages/MapPage'
import GroupPage from './pages/GroupPage'
import CustomPage from './pages/CustomPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import LoginGateProvider from './components/LoginGateProvider'
import AppDialogHost from './components/AppDialogHost'
import HoverHintLayer from './components/HoverHintLayer'
import MobileNotice from './components/MobileNotice'
import { marketRoute } from '@/utils/marketRoute'
import { useIsNarrowScreen } from './hooks/useIsNarrowScreen'

// 페이지 전체와 document.body로 포털 렌더링한 메뉴/팝업에 같은 숫자 폭 규칙을 적용한다.
// 공통 스냅샷 날짜·시간도 FONT_BAR_TIME에서 동일한 숫자 폭을 명시한다.
function PageNumberStyle() {
  const { pathname } = useLocation()
  const useTabularNumbers = pathname === '/group' || pathname.startsWith('/group/')
    || pathname === '/custom' || pathname.startsWith('/custom/')

  useLayoutEffect(() => {
    document.body.classList.toggle('tabular-nums', useTabularNumbers)
    return () => document.body.classList.remove('tabular-nums')
  }, [useTabularNumbers])

  return null
}

// 시장이 주소 조각으로 오기 전의 옛 주소(/map?market=KOSPI)를 지금 주소(/map/kospi)로 옮긴다.
// ?market=은 경로 조각보다 먼저 지워지므로 그대로 두면 값이 사라진다 — 시장 값을 경로로 바꾸고, 나머지 쿼리와 해시는 그대로 둔다.
function LegacyMarketRedirect({ basePath }: { basePath: '/map' | '/group' }) {
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
  const groupPath = pathname.replace(/^\/(?:sector|industry)(?=\/|$)/, '/group')
  return <Navigate to={`${groupPath}${search}${hash}`} replace />
}

// 모바일(폭 768px 미만)에서는 화면 대신 안내만 보여 준다. 세션·시세 요청도 보내지 않도록 앱 맨 바깥에서 가린다.
// /privacy는 구글 로그인 동의 화면에 등록된 공개 페이지라 모바일에서도 열린다.
function MobileGate({ children }: { children: ReactNode }) {
  const isNarrow = useIsNarrowScreen()
  const { pathname } = useLocation()
  if (isNarrow && pathname !== '/privacy') return <MobileNotice />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AppDialogHost />
      <HoverHintLayer />
      <MobileGate>
      <LoginGateProvider>
        <PageNumberStyle />
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<MarketSummaryPage />} />
          <Route path="/summary" element={<Navigate to="/home" replace />} />
          <Route path="/map" element={<LegacyMarketRedirect basePath="/map" />} />
          <Route path="/map/kospi" element={<MapPage />} />
          <Route path="/map/kosdaq" element={<MapPage />} />
          <Route path="/map/allstock" element={<MapPage />} />
          <Route path="/group" element={<LegacyMarketRedirect basePath="/group" />} />
          <Route path="/group/kospi" element={<GroupPage />} />
          <Route path="/group/kosdaq" element={<GroupPage />} />
          <Route path="/group/allstock" element={<GroupPage />} />
          <Route path="/sector" element={<LegacyGroupRedirect />} />
          <Route path="/sector/*" element={<LegacyGroupRedirect />} />
          <Route path="/industry" element={<LegacyGroupRedirect />} />
          <Route path="/industry/*" element={<LegacyGroupRedirect />} />
          {/* 커스텀 관리의 주소는 /custom 아래에서 업종·종목 화면으로 나뉜다. */}
          <Route path="/custom" element={<Navigate to="/custom/stock" replace />} />
          <Route path="/custom/sector" element={<CustomPage />} />
          {/* 예전 주소(/custom/industry)로 들어와도 새 주소로 보낸다. */}
          <Route path="/custom/industry" element={<Navigate to="/custom/sector" replace />} />
          <Route path="/custom/category" element={<Navigate to="/custom/sector" replace />} />
          <Route path="/custom/stock" element={<CustomPage />} />
          {/* 기존 링크와 로그인 returnTo 호환을 위해 이전 주소는 새 주소로 보낸다. */}
          <Route path="/admin/sector" element={<Navigate to="/custom/sector" replace />} />
          <Route path="/admin/stock" element={<Navigate to="/custom/stock" replace />} />
          {/* Google OAuth 동의 화면에 등록하는 공개 페이지 — 로그인 여부와 무관하게 누구나 볼 수
              있어야 하고, 세션/시세 등 데이터 API를 호출하지 않는 순수 정적 페이지다. */}
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* 관리자 전용 — 관리자가 아니면 페이지 안에서 홈으로 보낸다. */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </LoginGateProvider>
      </MobileGate>
    </BrowserRouter>
  )
}
