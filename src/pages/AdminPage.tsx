import { Link } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import AdminMembers from '@/components/AdminMembers'
import { useSession } from '@/hooks/useSession'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'

// 관리자 전용 페이지 — 모든 사용자가 보는 MARKETRY 맵을 바꾸는 작업을 일반 작업 화면(Custom)과 떨어뜨려 둔다.
// 메인 영역은 회원 정보 조회. 운영 기능은 Custom, 미사용 설정은 Map의 관리자 전용 탭에 있다.
// 화면에서 숨기는 것과 별개로 서버도 /api/admin/** 을 ADMIN만 허용한다. 관리자가 아니면 안내 문구만 보여 준다
// (자동으로 홈으로 보내면 로그인이 끝나기 전에 잘못 쫓겨날 수 있다).
export default function AdminPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = session?.authenticated === true && session.role === 'ADMIN'
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()

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
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        <div className="main-settings-row relative z-10 -mt-[10.5px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
          <div data-main-area className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-ui-background text-ui-white">
            {isLoading ? (
              <p role="status" className="text-sm text-ui-muted">관리자 권한을 확인하는 중입니다.</p>
            ) : !isAdmin ? (
              <div className="text-center text-sm text-ui-text">
                <p>관리자만 볼 수 있는 페이지입니다.</p>
                <Link to="/home" className="mt-4 inline-block text-[var(--accent)] underline">홈으로</Link>
              </div>
            ) : (
              <AdminMembers key={session.userId} userId={session.userId!} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
