import type { ReactNode } from 'react'
import PathBar, { type PathCrumb } from '@/components/PathBar'
import { MOBILE_PATH_CANVAS_ZOOM, mobilePathBarLeftShift } from '@/utils/mobilePathBar'
import { MAP_MOBILE_CAPTURE_FRAME_HEIGHT, SUMMARY_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'

const FRAME_PADDING = 4

// MOBILE 업종 지도 판 — 경로 줄과 지도를 한 판에 담아 스와이프할 때 함께 움직인다.
// 해외 실제 화면과 세 시장의 스와이프 미리보기가 같은 판을 써서 전환 순간 지도가 튀지 않는다.
export default function MobileSectorMapFrame({ scale, crumbs, accentColor, children }: {
  scale: number
  // 로딩 중에는 null을 넘겨 경로 줄을 지도와 함께 나타나게 한다.
  crumbs: PathCrumb[] | null
  accentColor?: string
  children: ReactNode
}) {
  return (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: `${FRAME_PADDING}px`, boxSizing: 'border-box', transform: `scale(${scale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <div className="flex h-full min-h-0 flex-col bg-ui-background p-1">
        {crumbs && (
          <div style={{ zoom: MOBILE_PATH_CANVAS_ZOOM }}>
            <header className="shrink-0 bg-ui-background px-3 py-0" style={{ transform: `translateX(-${mobilePathBarLeftShift(FRAME_PADDING)}px)` }}>
              <PathBar variant="mobile" currentAria="location" accentColor={accentColor} crumbs={crumbs} />
            </header>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
