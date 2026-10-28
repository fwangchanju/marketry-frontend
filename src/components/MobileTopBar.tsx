import { Link } from 'react-router-dom'
import MarketryLogo from '@/components/MarketryLogo'

// 좁은 화면(폭 768px 미만)의 상단 로고 줄(48px) — 글 페이지(MobileDocumentShell)와 홈·지도(MobileMarketSummaryPage)가 같이 쓴다.
// 왼쪽은 홈으로 가는 로고, 오른쪽은 페이지 이름이다. 노치가 있는 기기에서는 안전 영역만큼 아래로 내려 그린다.
export default function MobileTopBar({ title, className = '' }: { title: string; className?: string }) {
  return (
    <header className={`z-20 flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-ui-border bg-ui-surface px-4 pt-[env(safe-area-inset-top)] ${className}`}>
      <Link to="/home" aria-label="MARKETRY 홈으로 이동" className="shrink-0">
        {/* PC 상단바와 같은 로고 변형·크기 규칙이라 비율이 같다. */}
        <MarketryLogo layout="horizontalClean" className="h-auto w-[min(13rem,calc(100vw-10rem))]" />
      </Link>
      <span className="text-xs font-bold tracking-[0.12em] text-brand">{title}</span>
    </header>
  )
}
