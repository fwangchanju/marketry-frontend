import MarketryLogo from '@/components/MarketryLogo'

// 모바일(좁은 화면)에서는 화면 대신 이 안내만 보여 준다.
export default function MobileNotice() {
  return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black px-8 text-center text-white">
      <MarketryLogo className="h-auto w-48" />
      <p className="text-lg font-medium">PC에서 접속해 주세요.</p>
      <p className="text-sm text-gray-400">모바일 화면은 지원하지 않습니다.</p>
    </div>
  )
}
