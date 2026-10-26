import type { ReactNode } from 'react'

// 신설 정보·계정 페이지 본문 공통 테두리. 툴바 바로 아래에서 시작해 지도·그래프 본문과 같이
// 하단 정보줄 컨테이너 시작점에서 끝난다. 면책 문구 글자와는 4px 떨어진다.
export default function PageMainFrame({ children, className = '', scrollable = true }: { children: ReactNode; className?: string; scrollable?: boolean }) {
  return (
    // main-settings-row가 이미 좌우 4px 여백을 만든다. 여기서 다시 px-4를 주면 SOURCE
    // 외곽선이 본문 안쪽으로 16px 더 밀리므로, 테두리는 메인 영역 가장자리에서 바로 시작한다.
    <div className="min-h-0 flex-1">
      <div className={`${scrollable ? 'page-main-scroll h-full overflow-y-auto' : 'flex h-full min-h-0 flex-col overflow-hidden'} border border-ui-border bg-ui-background ${className}`}>{children}</div>
    </div>
  )
}
