import { useRef, type ReactNode } from 'react'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import Toolbar from '@/components/Toolbar'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'

// PC 화면의 공통 틀 — 상단바·메뉴 줄·오른쪽 버튼 묶음(스크린샷·전체 화면)·툴바 줄·본문·하단 안내를 한곳에서 만든다.
// 새 PC 화면은 이 틀에 toolbar와 본문만 넣는다. 그러면 오른쪽 버튼 묶음이 기본으로 따라오고, 화면마다 빠뜨릴 수 없다.
// 이 화면에 없는 기능만 끈다: 스크린샷을 찍을 수 없으면 noScreenshot을 켠다.
// 설정창이 있는 화면(MAP·GRAPH 등)은 설정 버튼과 설정창 배치가 따로 있어 아직 이 틀을 쓰지 않는다.
export default function PcPageFrame({ toolbar, children, noScreenshot = false, noFooter = false }: {
  toolbar: ReactNode
  children: ReactNode
  noScreenshot?: boolean
  noFooter?: boolean
}) {
  const mainRef = useRef<HTMLElement>(null)
  const { target, isOpen, open, close, copy, copyLabel, isCopying } = useScreenshotShare()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onOpenShare={noScreenshot ? undefined : () => open(mainRef.current)}
            isScreenshotOpen={isOpen}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* 다른 화면과 같은 본문 줄(main-settings-row) — 왼쪽 메뉴 자리만큼 비우고 좌우 4px 여백을 둔다. 스크린샷은 이 메인 영역만 찍는다. */}
        <div className="main-settings-row relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background">
          <main ref={mainRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
            <Toolbar>{toolbar}</Toolbar>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">{children}</div>
            {!noFooter && <DisclaimerFooter />}
          </main>
        </div>
      </div>
      {isOpen && <ScreenshotModal onClose={close} onCopy={copy} copyLabel={copyLabel} isCopying={isCopying} screenshotTarget={target} />}
    </div>
  )
}
