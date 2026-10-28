import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import MarketryLogo from '@/components/MarketryLogo'
import { useHideOnScrollDown } from '@/hooks/useHideOnScrollDown'

// 좁은 화면(폭 768px 미만)의 글 페이지 틀 — 설정창과 고정 상단바 없이 본문을 전체 폭으로 보여 준다.
// 상단은 로고 한 줄(48px)이며, 아래로 스크롤하면 숨고 위로 올리면 다시 나타난다(useHideOnScrollDown). 글 내용(heading·children)은 PC와 같은 한 벌을 그대로 쓴다.
export default function MobileDocumentShell({ title, heading, children }: { title: string; heading: ReactNode; children: ReactNode }) {
  const isHeaderHidden = useHideOnScrollDown()
  return (
    <div className="min-h-screen bg-ui-background text-ui-white">
      <header className={`sticky top-0 z-20 flex h-12 items-center justify-between border-b border-ui-border bg-ui-surface px-4 transition-transform duration-200 motion-reduce:transition-none ${isHeaderHidden ? '-translate-y-full' : ''}`}>
        <Link to="/home" aria-label="MARKETRY 홈으로 이동" className="shrink-0">
          <MarketryLogo layout="horizontalClean" className="h-auto w-[9.5rem]" />
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
