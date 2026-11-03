import { Link } from 'react-router-dom'
import MobileTopBar from '@/components/MobileTopBar'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import MarketryLogo from '@/components/MarketryLogo'

const destinations = [
  { label: '종목 지도', path: '/map/korea' },
  { label: '업종 지도', path: '/home?map' },
  { label: '그룹 등락률', path: '/graph/korea' },
  { label: '가이드', path: '/info/guide' },
]

export default function MobileHomePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-ui-background text-ui-white">
      <MobileTopBar title="" />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-6">
      <div className="flex justify-center pb-6">
        <MarketryLogo layout="stacked" className="h-auto w-[min(182px,42vw)]" />
      </div>
      <nav aria-label="페이지 이동" className="flex w-full max-w-[200px] flex-col gap-3">
        {destinations.map(({ label, path }) => (
          <Link key={path} to={path} className="flex min-h-[38px] items-center justify-center rounded-[4px] bg-brand-surface px-4 text-[16px] font-medium text-ui-on-dark">
            {label}
          </Link>
        ))}
      </nav>
      <p className="pt-6 text-center text-[14px] text-ui-white">
        <span className="block">PC 화면에 최적화된 홈페이지입니다.</span>
        <span className="block">업종 분류는 PC에서만 가능합니다.</span>
      </p>
      </main>
      <footer className="border-t border-ui-border px-4 py-3"><DisclaimerNotice wrap /></footer>
    </div>
  )
}
