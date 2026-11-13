import MarketryLogo from '@/components/MarketryLogo'

// 모바일·좁은 브라우저 창(767px 이하)에서는 화면 대신 이 안내만 보여 준다. 브라우저를 좁게 쓰는 사용자도 바로 알 수 있게 창을 키우라고 안내한다.
export default function MobileNotice() {
  return (
    <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-8 bg-ui-background px-8 text-center text-ui-white">
      <MarketryLogo layout="stacked" className="h-auto w-48" />
      <p className="text-base font-medium">브라우저 화면을 크게 해주세요.</p>
    </div>
  )
}
