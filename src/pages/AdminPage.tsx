import { useState } from 'react'
import { Link } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel, { SettingsPanelGroup, SettingsSectorChangeSection, SettingsTextThresholdSection } from '@/components/SettingsPanel'
import MarketryPublishControls from '@/components/MarketryPublishControls'
import Spinner from '@/components/Spinner'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useTestMemberToggle } from '@/hooks/useTestMemberToggle'
import { isLocalSignupEnabled } from '@/utils/localDevLogin'
import { useBrowserSetting } from '@/utils/browserSetting'
import { MEMBER_DEFAULTS } from '@/utils/settingDefaults'
import type { SectorChangeFilter } from '@/hooks/useFilteredTreemap'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'

const ADMIN_SECTIONS = ['adminOps', 'adminMoved'] as const

// 관리자 전용 페이지 — 모든 사용자가 보는 MARKETRY 맵을 바꾸는 작업을 일반 작업 화면(Custom)과 떨어뜨려 둔다.
// 다른 페이지처럼 가운데 메인 영역과 옆의 설정창으로 나뉘고, 작업은 설정창에서 한다. 메인 영역에는 로딩 때 보이는 로고 원만 둔다.
// 화면에서 숨기는 것과 별개로 서버도 /api/admin/** 을 ADMIN만 허용한다. 관리자가 아니면 안내 문구만 보여 준다
// (자동으로 홈으로 보내면 로그인이 끝나기 전에 잘못 쫓겨날 수 있다).
export default function AdminPage() {
  const { data: session, isLoading } = useSession()
  const [boxLabelMinAreaPercent, setBoxLabelMinAreaPercent] = useBrowserSetting('treemap.boxLabelMinAreaPercent', MEMBER_DEFAULTS.boxLabelMinAreaPercent)
  const [sectorChangeFilter, setSectorChangeFilter] = useBrowserSetting<SectorChangeFilter>('treemap.sectorChangeFilter', MEMBER_DEFAULTS.sectorChangeFilter)
  const [sectorChangeDepth, setSectorChangeDepth] = useBrowserSetting('treemap.sectorChangeDepth', MEMBER_DEFAULTS.sectorChangeDepth)
  const isAdmin = session?.authenticated === true && session.role === 'ADMIN'
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const testMember = useTestMemberToggle()

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
              // 다른 페이지가 불러오는 동안 보여 주는 것과 같은 로고 원이지만, 돌지도 숫자를 세지도 않는다. 숫자가 있던 자리(로고 아래)에는 확인창 제목에 붙는 것과 같은 빨간 ⚠를 둔다.
              <Spinner still stillContent={<span aria-hidden="true" className="text-[11cqw] leading-none text-[#ff4d2e]">⚠</span>} />
            )}
          </div>
          {isAdmin && (
            <div className={`flex shrink-0 pt-[7px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
              <SettingsPanel
                pageLabel="Admin"
                showPreferenceActions={false}
                fixedSideTab
                headerRight={
                  // 지도 설정창 헤더 오른쪽의 아이콘(되돌리기·저장)과 같은 칸 크기(24px)·아이콘 크기(20px)·자리다. 빨간 경고 아이콘만 둔다.
                  <span aria-label="관리자 전용" data-hint="관리자 전용" className="flex h-6 w-6 items-center justify-center text-[#ff4d2e]">
                    <span aria-hidden="true" className="text-[18px] leading-none">⚠</span>
                  </span>
                }
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                isOnLeft={isSettingsOnLeft}
                onToggleSide={toggleSettingsSide}
                sectionOrder={ADMIN_SECTIONS}
              >
                {/* 운영 탭 — 탭 안 항목은 탭 없는 설정창(그룹·커스텀)과 같은 모양이라 settings-plain-content로 감싼다(번호는 이 탭 안에서 1부터). */}
                <SettingsPanelGroup section="adminOps">
                  <div className="settings-plain-content pt-5">
                    <div className="h-[127px] text-sm">
                      <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-white">MARKETRY 분류</h2>
                      <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-gray-300">내 분류를 MARKETRY 분류로 커밋·롤백</p>
                      <div className="mt-4 max-w-[16rem] settings-control-inset">
                        <MarketryPublishControls />
                      </div>
                    </div>
                    {/* 로컬 개발 전용 — 운영 화면에는 나오지 않는다. 누르면 로컬 DB에 새 USER 계정(테스트 회원)으로 바꾼다. 돌아오는 버튼은 계정 메뉴에 있다(테스트 회원은 관리자가 아니라 이 페이지에 못 들어온다). */}
                    {isLocalSignupEnabled() && (
                      <div className="text-sm">
                        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-white">테스트 회원 (로컬 전용)</h2>
                        <p className="settings-description m-0 mt-1 max-w-[16rem] text-xs font-medium text-gray-300">
                          {testMember.isTestMember ? '지금 테스트 회원입니다' : '로컬 DB의 새 일반 계정으로 전환'}
                        </p>
                        <div className="mt-4 max-w-[16rem] settings-control-inset">
                          <button
                            type="button"
                            onClick={testMember.toggle}
                            disabled={testMember.isPending}
                            data-hint="누르면 로컬 DB에 새 USER 계정(테스트 회원)을 만들어 그 계정으로 바꿉니다. 돌아올 때는 오른쪽 위 계정 메뉴를 쓰세요."
                            className="settings-chip-hover h-7 w-full rounded-[5px] border-0 bg-[#4b4b50] text-[13px] font-medium text-white disabled:cursor-wait disabled:opacity-40"
                          >
                            {testMember.isPending ? '전환 중…' : '테스트 회원으로 전환'}
                          </button>
                          {testMember.error && <p role="alert" className="mt-1.5 text-xs text-red-400">{testMember.error}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </SettingsPanelGroup>
                {/* 보관 탭 — 일반 설정창에서 안 쓰는 항목을 옮겨 온 자리다. 값은 서버에 저장하지 않고 이 브라우저에만 둔다. */}
                <SettingsPanelGroup section="adminMoved">
                  <div className="settings-plain-content pt-5">
                    <SettingsTextThresholdSection value={boxLabelMinAreaPercent} onChange={setBoxLabelMinAreaPercent} />
                    <SettingsSectorChangeSection
                      value={sectorChangeFilter}
                      onChange={setSectorChangeFilter}
                      depth={sectorChangeDepth}
                      onChangeDepth={setSectorChangeDepth}
                      maxSelectableDepth={3}
                    />
                  </div>
                </SettingsPanelGroup>
              </SettingsPanel>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
