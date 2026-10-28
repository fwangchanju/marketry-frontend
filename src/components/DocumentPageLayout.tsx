import { useRef, useState, type ReactNode } from 'react'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import type { SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import PageInfoPanel from '@/components/PageInfoPanel'
import PageMainFrame from '@/components/PageMainFrame'
import ScreenshotModal from '@/components/ScreenshotModal'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import MobileDocumentShell from '@/components/MobileDocumentShell'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'

// 공개 문서도 다른 화면과 같은 헤더·계정·메뉴·툴바·하단 정보줄을 쓴다.
export default function DocumentPageLayout({ title, heading, children, panelIcon = 'document', panelDescription = 'MARKETRY 서비스 안내 문서입니다.' }: { title: string; heading: ReactNode; children: ReactNode; panelIcon?: SettingsSectionIconName; panelDescription?: string }) {
  const isNarrow = useIsNarrowScreen()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLElement>(null)
  const handleCopy = async (previewSrc: string | null) => {
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
  // 좁은 화면은 설정창·고정 상단바가 없는 모바일 틀을 쓴다(훅은 모두 위에서 호출해 순서를 지킨다).
  if (isNarrow) return <MobileDocumentShell title={title} heading={heading}>{children}</MobileDocumentShell>
  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => undefined}
            isRefreshing={false}
            showRefresh={false}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            onToggleSettings={() => setIsSettingsOpen(open => !open)}
            isSettingsOpen={isSettingsOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isScreenshotOpen={isShareOpen}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        <div ref={rowRef} className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 gap-[4px] overflow-hidden bg-ui-background">
        <main ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
          <Toolbar>
            <ToolbarModeText page="INFO" label={title} />
          </Toolbar>
          {/* 공통 바깥 프레임 안에서 InfoDocument의 제목·구획·정보 행 양식을 사용한다. */}
          <PageMainFrame
            className="p-0"
            fixedHeader={<div className="mx-auto w-full max-w-4xl">{heading}</div>}
          >
            {children}
          </PageMainFrame>
          <DisclaimerFooter />
        </main>
        {isSettingsOpen && <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <PageInfoPanel title="Info" tabLabel={title} description={panelDescription} icon={panelIcon} isOnLeft={isOnLeft} onToggleSide={toggleSide} />
        </div>}
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
