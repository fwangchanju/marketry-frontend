import { Link } from 'react-router-dom'
import MobileTopBar from '@/components/MobileTopBar'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import MarketryLogo from '@/components/MarketryLogo'

const destinations = [
  { label: 'MAP', path: '/map/korea' },
  { label: 'GRAPH', path: '/graph/korea' },
  { label: 'GUIDE', path: '/info/guide' },
]

export default function MobileHomePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ui-background text-ui-white">
      <MobileTopBar title="" />
      <main className="grid flex-1 grid-rows-[1fr_auto_1fr] justify-items-center px-4 py-6">
      <div className="flex items-end justify-center pb-6">
        <MarketryLogo layout="stacked" className="h-auto w-[min(182px,42vw)]" />
      </div>
      <nav aria-label="페이지 이동" className="flex w-full max-w-[240px] flex-col gap-3">
        {destinations.map(({ label, path }) => (
          <Link key={path} to={path} className="flex min-h-[44px] items-center justify-center rounded-[4px] bg-brand-surface px-4 text-[14px] font-medium text-ui-white">
            {label}
          </Link>
        ))}
      </nav>
      </main>
      <footer className="border-t border-ui-border px-4 py-3"><DisclaimerNotice wrap /></footer>
    </div>
  )
}
