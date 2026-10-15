import { useTradingDayGap } from '@/hooks/useTreemap'

interface Props {
  // 지금 보는 지난 날짜의 스냅샷 시각, 실시간 지도의 스냅샷 시각(ISO).
  viewedSnapshotTime: string | null
  liveSnapshotTime: string | null
}

// 지난 날짜를 볼 때 날짜 옆에 붙는 "N 거래일 전". 거래일 수를 아직 못 받았으면 "종가"만 보인다.
export default function ClosingPriceLabel({ viewedSnapshotTime, liveSnapshotTime }: Props) {
  const { data: tradingDays } = useTradingDayGap(viewedSnapshotTime?.slice(0, 10) ?? null, liveSnapshotTime?.slice(0, 10) ?? null)
  // 날짜와 같은 청록·500 글자로 한 덩어리로 보여 준다("종가 (N거래일 전)"에서 "종가"를 빼고 숫자 뒤를 띄웠다).
  return <span>{tradingDays ? `${tradingDays} 거래일 전` : '종가'}</span>
}
