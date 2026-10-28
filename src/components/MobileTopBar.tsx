import { Link } from 'react-router-dom'
import MarketryLogo from '@/components/MarketryLogo'
import { ChevronDownIcon } from '@/components/icons/AppIcons'

// 좁은 화면(폭 768px 미만)의 상단 로고 줄(44px, 로고 폭 148px) — 글 페이지(MobileDocumentShell)와 홈·지도(MobileMarketSummaryPage)가 같이 쓴다.
// 왼쪽은 홈으로 가는 로고, 오른쪽은 페이지 이름이다. 노치가 있는 기기에서는 안전 영역만큼 아래로 내려 그린다.
export default function MobileTopBar({ title, className = '' }: { title: string; className?: string }) {
  return (
    <header className={`z-20 flex h-[calc(44px+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-ui-border bg-ui-surface px-4 pt-[env(safe-area-inset-top)] ${className}`}>
      <Link to="/home" aria-label="MARKETRY 홈으로 이동" className="shrink-0">
        {/* PC 상단바와 같은 로고 변형·크기 규칙이라 비율이 같다. */}
        <MarketryLogo layout="horizontalClean" className="h-auto w-[148px]" />
      </Link>
      <span className="flex items-center gap-1 text-[14px] font-bold tracking-[0.12em] text-brand">{title}{title === 'MAP' && <ChevronDownIcon aria-hidden="true" className="h-4 w-4" />}</span>
    </header>
  )
}
