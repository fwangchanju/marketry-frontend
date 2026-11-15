import OverseasSectorView from '@/pages/OverseasSectorView'
import { useUsaSectorSource } from '@/hooks/useUsaSectorSource'

// 미국 섹터 — 화면 구성은 모든 해외 시장이 같은 공통 섹터(OverseasSectorView)이고, 미국의 종목 목록·시세만 useUsaSectorSource가 맡는다.
export default function UsaSectorPage() {
  return <OverseasSectorView source={useUsaSectorSource()} />
}
