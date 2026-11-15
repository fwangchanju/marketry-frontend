import OverseasStockView from '@/pages/OverseasStockView'
import { useUsaStockSource } from '@/hooks/useUsaStockSource'

// 미국 종목 — 화면 구성은 모든 해외 시장이 같은 공통 종목 화면(OverseasStockView)이고, 미국의 종목 목록·시세·통화만 useUsaStockSource가 맡는다.
export default function UsaStockPage() {
  return <OverseasStockView source={useUsaStockSource()} />
}
