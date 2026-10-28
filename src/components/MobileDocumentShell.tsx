import { useLayoutEffect, type ReactNode } from 'react'
import { Link, useNavigationType } from 'react-router-dom'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import MarketryLogo from '@/components/MarketryLogo'

// 좁은 화면(폭 768px 미만)의 글 페이지 틀 — 설정창 없이 본문을 전체 폭으로 보여 준다.
// 상단은 로고 한 줄(48px)이며 스크롤해도 항상 보인다. 글 내용(heading·children)은 PC와 같은 한 벌을 그대로 쓴다.
export default function MobileDocumentShell({ title, heading, children }: { title: string; heading: ReactNode; children: ReactNode }) {
  // 글 페이지는 창 스크롤을 쓰므로, 새 페이지로 이동하면 이전 페이지의 스크롤 위치가 남아 아래쪽부터 열린다.
  // 링크로 들어온 이동(PUSH·REPLACE)은 맨 위부터 보여 주고, 뒤로 가기(POP)는 브라우저가 복원하게 둔다.
  const navigationType = useNavigationType()
  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [navigationType])
  return (
    <div className="min-h-screen bg-ui-background text-ui-white">
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-ui-border bg-ui-surface px-4">
        <Link to="/home" aria-label="MARKETRY 홈으로 이동" className="shrink-0">
          {/* PC 상단바와 같은 로고 변형·크기 규칙이라 비율이 같다. */}
          <MarketryLogo layout="horizontalClean" className="h-auto w-[min(13rem,calc(100vw-10rem))]" />
        </Link>
        <span className="text-xs font-bold tracking-[0.12em] text-brand">{title}</span>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-6 pt-6">
        <div>{heading}</div>
        <div className="pt-7">{children}</div>
      </main>
      <footer className="border-t border-ui-border px-4 py-3">
        <DisclaimerNotice wrap />
      </footer>
    </div>
  )
}
