import type { AdBannerSize } from '@/components/AdBannerSlot'

// 배너 자리(AdBannerSlot)에 끼우는 가짜 광고 — 자리와 간격을 눈으로 보려는 시험용이다. 운영에도 나오며, 안에 "시험용" 표시를 적어 둔다. 실제 광고가 정해지면 지운다.
export default function DevTestBanner({ size }: { size: AdBannerSize }) {
  const isSmall = size.height < 90
  return (
    <div className={`relative flex h-full w-full items-center justify-between rounded bg-[linear-gradient(100deg,#1d3b8b,#3a6ff0_60%,#7fb0ff)] text-white ${isSmall ? 'px-4' : 'px-6'}`}>
      <div>
        <p className={`m-0 font-extrabold leading-tight ${isSmall ? 'text-lg' : 'text-2xl'}`}>첫 거래 수수료 평생 0원</p>
        <p className={`m-0 mt-0.5 font-medium opacity-90 ${isSmall ? 'text-xs' : 'text-sm'}`}>지금 계좌 개설하고 혜택 받기</p>
      </div>
      <span className={`rounded-full bg-white font-bold text-[#1d3b8b] ${isSmall ? 'px-3 py-1.5 text-xs' : 'px-[18px] py-2.5 text-[15px]'}`}>자세히 보기</span>
      <span className="absolute bottom-0.5 right-1 text-[10px] opacity-70">광고 · {size.width}×{size.height} 시험용</span>
    </div>
  )
}
