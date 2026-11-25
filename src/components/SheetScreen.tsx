import { useEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import { CustomPageBadgeLink, EmptyLogoMessage, EMPTY_MINE_MESSAGE } from '@/components/EmptyMessage'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import MainAreaLoading from '@/components/MainAreaLoading'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import Spinner from '@/components/Spinner'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import ToolbarModeText from '@/components/ToolbarModeText'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { usePageSetting } from '@/hooks/usePageSetting'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { useIsLoggedIn } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import type { MarketDataState } from '@/markets/marketContract'
import { EmptyMessageAreaContext } from '@/utils/emptyMessageArea'
import type { customMenu } from '@/utils/marketMenu'
import { settingDefaultsFor } from '@/utils/settingDefaults'
import { profileSettingKey } from '@/utils/settingsSchema'
import type { TaxonomyKey } from '@/utils/taxonomyNames'

// 표가 화면의 정해진 자리에 그리는 것들. 편집할 수 없으면 설정창 자리는 null이다.
export interface SheetSlots {
  toolbar: HTMLElement | null
  history: HTMLElement | null
  bulk: HTMLElement | null
  excel: HTMLElement | null
  reset: HTMLElement | null
  setCountLabel: (label: string | undefined) => void
}

// 설정창의 편집 항목. 변경 내역은 편집할 수 있으면 늘 있고 나머지는 시장·화면이 고른다.
export type SheetEditItem = 'bulk' | 'excel' | 'reset'

// 모든 시장의 SECTOR·STOCK 화면 틀. 시장 이름을 보고 갈라지지 않고 넘겨받은 값만 그린다.
export default function SheetScreen({ page, label, menu, taxonomy, state, canEdit, editItems, readOnlyNote, publishControls, isCaptureReady, isMineEmpty, mineSetupPath, panel, children }: {
  page: 'SECTOR' | 'STOCK'
  label: string
  menu: ReturnType<typeof customMenu>
  taxonomy: TaxonomyKey
  state: MarketDataState
  canEdit: boolean
  editItems: readonly SheetEditItem[]
  // 읽기 전용 안내 아래에 덧붙일 글(환산 기준 등).
  readOnlyNote: string | null
  // 관리자 탭의 MARKETRY 업데이트·롤백. 없으면 탭도 없다.
  publishControls: ReactNode | null
  isCaptureReady: boolean
  isMineEmpty: boolean
  mineSetupPath: string
  panel: Pick<ComponentProps<typeof SettingsPanel>, 'onSelectTaxonomy' | 'onRequestLogin' | 'snapshotTime' | 'onlyTaxonomy' | 'alsoTaxonomies' | 'withoutMiddle'>
  children: (slots: SheetSlots) => ReactNode
}) {
  const isStock = page === 'STOCK'
  // 내 기준 모드 강조 색(사용자 설정). 번호 배지와 모드 배지가 이 색을 따른다.
  const [mineStrongColor] = usePageSetting(profileSettingKey('mine', 'heatmap.strongIndustryColor'), settingDefaultsFor(useIsLoggedIn(), 'mine').strongIndustryColor)
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null)
  const [history, setHistory] = useState<HTMLDivElement | null>(null)
  const [bulk, setBulk] = useState<HTMLDivElement | null>(null)
  const [excel, setExcel] = useState<HTMLDivElement | null>(null)
  const [reset, setReset] = useState<HTMLDivElement | null>(null)
  const [countLabel, setCountLabel] = useState<string | undefined>()
  // 안내 문구를 본문 영역 전체의 한가운데에 그리기 위한 기준 요소.
  const [emptyMessageArea, setEmptyMessageArea] = useState<HTMLDivElement | null>(null)
  const screenshotRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setEmptyMessageArea(screenshotRef.current) }, [])
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const { target: screenshotTarget, isOpen: isShareOpen, open: openScreenshot, close: closeScreenshot, copy, copyLabel, isCopying } = useScreenshotShare()
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const tabLabel = isStock ? '종목' : '섹터'
  const tabIcon = isStock ? 'stock-single' : 'industry'
  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background" style={{ '--mine-accent': mineStrongColor } as CSSProperties}>
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => openScreenshot(screenshotRef.current)} isScreenshotOpen={isShareOpen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} />} />
      <div className="flex min-h-0 flex-1">
        {/* 캡처는 [툴바+본문] 열만 찍는다 — 설정창은 넣지 않는다. */}
        <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
          <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background text-ui-white">
            <div className="main-toolbar mt-[3px] mb-[8px] flex h-7 w-full shrink-0 items-center justify-between bg-ui-background/70 text-sm font-bold text-ui-white">
              <div className="flex h-full shrink-0 items-center gap-2">
                <ToolbarModeText page={page} label={label} showChevron menu={menu} />
              </div>
              {/* 검색창(과 필터 초기화) — 표가 이 자리에 그린다. */}
              <div ref={setToolbar} className="ml-1 flex h-full min-h-0 min-w-0 flex-1 items-center" />
              <div className={`${FONT_BAR_MODE_STATUS} ml-2 flex min-w-0 items-center justify-end text-ui-muted`}>
                <TaxonomyBadge taxonomy={taxonomy} strongIndustryColor={mineStrongColor} />
              </div>
            </div>
            <EmptyMessageAreaContext.Provider value={emptyMessageArea}>
              <div className="flex min-h-0 flex-1">
                <div
                  className={`flex min-h-0 min-w-0 flex-1 flex-col ${isStock ? '' : 'overflow-y-auto'}`}
                  // 내 기준 업종 표의 번호 배지는 내 기준 모드 색을 쓴다.
                  style={!isStock && taxonomy === 'MINE' ? { '--brand': mineStrongColor, '--brand-surface': `color-mix(in srgb, ${mineStrongColor} 60%, #0a0a0a)`, '--brand-surface-hover': 'color-mix(in srgb, var(--brand-surface) 80%, var(--brand))' } as CSSProperties : undefined}
                >
                  {/* 자료를 기다리는 동안에는 본문 자리에 로딩 원만 보여 주고 툴바와 설정창은 그대로 둔다. */}
                  {state.status === 'loading' ? <MainAreaLoading><Spinner showElapsed /></MainAreaLoading>
                    : state.status === 'error' ? <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={state.retry} /></MainAreaLoading>
                      : children({ toolbar, history, bulk, excel, reset, setCountLabel })}
                </div>
              </div>
            </EmptyMessageAreaContext.Provider>
            <DisclaimerFooter />
          </div>
          <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
            <SettingsPanel
              {...panel}
              strongIndustryColor={mineStrongColor}
              pageLabel={isStock ? 'Stock' : 'Sector'}
              plainTabLabel={tabLabel}
              customTabLabel={tabLabel}
              plainTabIcon={tabIcon}
              customTabIcon={tabIcon}
              // 섹터 화면에는 "n/n업종" 개수를 보이지 않는다(2026-11-15 사용자 결정). 종목 화면만 "n/n종목"을 보인다.
              stockCountLabel={isStock ? countLabel : undefined}
              // 저장·초기화는 기능 검토 전 임시 숨김. 재요청 시 새 버튼을 만들지 말고 이 옵션을 true로 바꿔 기존 버튼을 복원한다.
              showPreferenceActions={false}
              isOpen={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
              isOnLeft={isOnLeft}
              onToggleSide={toggleSide}
              sectionOrder={publishControls === null ? ['custom'] : ['custom', 'adminOps']}
              taxonomyAtBottom
              taxonomy={taxonomy}
            >
              <SettingsPanelGroup section="custom">
                {canEdit ? (
                  <>
                    <div ref={setHistory} className={isStock ? 'settings-item' : undefined} />
                    {editItems.includes('bulk') && <div ref={setBulk} className="settings-item" />}
                    {editItems.includes('excel') && <div ref={setExcel} className="settings-item" />}
                    {editItems.includes('reset') && <div ref={setReset} className="settings-item" />}
                  </>
                ) : (
                  <div className="settings-empty-message"><span className="text-center">읽기 전용<br /><span className="text-ui-muted">[내 기준] 모드만 쓰기 가능{readOnlyNote !== null && <><br />{readOnlyNote}</>}</span></span></div>
                )}
              </SettingsPanelGroup>
              {publishControls !== null && (
                <SettingsPanelGroup section="adminOps">
                  <div className="settings-plain-content">
                    <div className="settings-ops-item h-[180px] text-sm">
                      <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">MARKETRY 분류</h2>
                      <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">내 기준을 MARKETRY로 업데이트·롤백</p>
                      <div className="settings-button-area max-w-full settings-control-inset">{publishControls}</div>
                    </div>
                  </div>
                </SettingsPanelGroup>
              )}
            </SettingsPanel>
          </div>
        </div>
      </div>
      {isShareOpen && (
        <ScreenshotModal
          onClose={closeScreenshot}
          onCopy={copy}
          copyLabel={copyLabel}
          isCopying={isCopying}
          screenshotTarget={screenshotTarget}
          captureReady={isCaptureReady}
          emptyPreview={isMineEmpty ? (
            <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}>
              <CustomPageBadgeLink to={mineSetupPath} onClick={closeScreenshot} />
            </EmptyLogoMessage>
          ) : undefined}
        />
      )}
    </div>
  )
}
