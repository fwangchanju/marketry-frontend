import { useTradingDayGap } from '@/hooks/useMarketMap'

interface Props {
  // 지금 보는 지난 날짜의 스냅샷 시각, 실시간 지도의 스냅샷 시각(ISO).
  viewedSnapshotTime: string | null
  liveSnapshotTime: string | null
}

// 지난 날짜를 볼 때 날짜 옆에 붙는 "종가 (N거래일 전)". 거래일 수를 아직 못 받았으면 "종가"만 보인다.
export default function ClosingPriceLabel({ viewedSnapshotTime, liveSnapshotTime }: Props) {
  const { data: tradingDays } = useTradingDayGap(viewedSnapshotTime?.slice(0, 10) ?? null, liveSnapshotTime?.slice(0, 10) ?? null)
  // "종가"는 날짜와 같은 청록·500이고, 뒤의 "(N거래일 전)"만 한 단계 가는 400에 옆 거래 세션 글자(text-gray-400)와 같은 회색이다.
  return (
    <span>
      종가
      {tradingDays ? <span className="font-normal">{` (${tradingDays}거래일 전)`}</span> : null}
    </span>
  )
}
