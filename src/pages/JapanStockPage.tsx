import OverseasStockView from '@/pages/OverseasStockView'
import { useJapanStockSource } from '@/hooks/useJapanStockSource'

// 일본 종목 — 화면 구성은 모든 해외 시장이 같은 공통 종목 화면(OverseasStockView)이고, 일본의 종목 목록·시세·통화만 useJapanStockSource가 맡는다.
export default function JapanStockPage() {
  return <OverseasStockView source={useJapanStockSource()} />
}
