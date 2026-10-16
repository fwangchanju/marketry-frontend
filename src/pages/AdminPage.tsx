import { useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel from '@/components/SettingsPanel'
import MarketryPublishControls from '@/components/MarketryPublishControls'
import Spinner from '@/components/Spinner'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'

// 관리자 전용 페이지 — 모든 사용자가 보는 MARKETRY 맵을 바꾸는 작업을 일반 작업 화면(Custom)과 떨어뜨려 둔다.
// 다른 페이지처럼 가운데 메인 영역과 옆의 설정창으로 나뉘고, 작업은 설정창에서 한다. 메인 영역에는 로딩 때 보이는 로고 원만 둔다.
// 화면에서 숨기는 것과 별개로 서버도 /api/admin/** 을 ADMIN만 허용한다. 관리자가 아니면 안내 문구만 보여 준다
// (자동으로 홈으로 보내면 로그인이 끝나기 전에 잘못 쫓겨날 수 있다).
export default function AdminPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = session?.authenticated === true && session.role === 'ADMIN'
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => undefined}
            isRefreshing={false}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            onToggleSettings={() => setIsSettingsOpen(previous => !previous)}
            isSettingsOpen={isSettingsOpen}
            showRefresh={false}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        <div ref={settingsRowRef} className="relative z-10 -mt-[10.5px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-black text-white">
          <div data-main-area className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-black text-white">
            {isLoading ? (
              <Spinner showElapsed />
            ) : !isAdmin ? (
              <div className="text-center text-sm text-gray-300">
                <p>관리자만 볼 수 있는 페이지입니다.</p>
                <Link to="/home" className="mt-4 inline-block text-[var(--accent)] underline">홈으로</Link>
              </div>
            ) : (
              // 다른 페이지가 불러오는 동안 보여 주는 것과 같은 로고 원이지만, 돌지도 숫자를 세지도 않는다.
              <Spinner still />
            )}
          </div>
          {isAdmin && (
            <div className={`flex shrink-0 pt-[7px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
              <SettingsPanel
                pageLabel="Admin"
                showPreferenceActions={false}
                fixedSideTab
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                isOnLeft={isSettingsOnLeft}
                onToggleSide={toggleSettingsSide}
                plainContent={
                  <div className="h-[127px] text-sm">
                    <h2 className="settings-plain-title mb-3 text-[15px] font-medium leading-[22px] text-white">맵 서버 업로드</h2>
                    <div className="max-w-[16rem] settings-control-inset">
                      <MarketryPublishControls />
                    </div>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
