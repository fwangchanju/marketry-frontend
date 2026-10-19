import MarketryLogo from '@/components/MarketryLogo'

// 모바일(좁은 화면)에서는 화면 대신 이 안내만 보여 준다.
export default function MobileNotice() {
  return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ui-background px-8 text-center text-ui-white">
      <MarketryLogo layout="stacked" className="h-auto w-48" />
      <p className="text-lg font-medium">현재 페이지는 PC 화면에 최적화되어 있습니다.</p>
    </div>
  )
}
