import type { ReactNode } from 'react'

// 신설 정보·계정 페이지 본문 공통 테두리. 툴바 바로 아래에서 시작해 지도·그래프 본문과 같이
// 하단 정보줄 컨테이너 시작점에서 끝난다. 면책 문구 글자와는 4px 떨어진다.
// heading: 제목·요약·구분선 블록. 기본은 본문과 함께 스크롤된다(2026-10-28 고정을 뺐다).
// fixHeading: true면 예전처럼 heading을 본문 위에 고정하고 그 아래만 스크롤한다. 지금 쓰는 페이지는 없지만,
// 일부 페이지에서 고정을 되살릴 수 있게 남겨 둔다(docs/history.md 2026-10-28 항목 참고).
export default function PageMainFrame({ children, className = '', scrollable = true, heading, fixHeading = false }: { children: ReactNode; className?: string; scrollable?: boolean; heading?: ReactNode; fixHeading?: boolean }) {
  const hasHeading = heading !== undefined
  return (
    // main-settings-row가 이미 좌우 4px 여백을 만든다. 여기서 다시 px-4를 주면 SOURCE
    // 외곽선이 본문 안쪽으로 16px 더 밀리므로, 테두리는 메인 영역 가장자리에서 바로 시작한다.
    <div className="min-h-0 flex-1">
      <div data-page-main-frame className={`${hasHeading ? 'flex h-full min-h-0 flex-col overflow-hidden' : scrollable ? 'page-main-scroll h-full overflow-y-auto' : 'flex h-full min-h-0 flex-col overflow-hidden'} border border-ui-border bg-ui-background ${className}`}>
        {hasHeading ? (
          fixHeading ? (
            <>
              <div className="min-w-0 shrink-0 px-6 pt-6">{heading}</div>
              <div className="page-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pt-7 pb-6">{children}</div>
            </>
          ) : (
            <div className="page-main-scroll min-h-0 min-w-0 flex-1 overflow-y-auto px-6 pb-6 pt-6">
              <div className="min-w-0">{heading}</div>
              <div className="min-w-0 pt-7">{children}</div>
            </div>
          )
        ) : children}
      </div>
    </div>
  )
}
