import OverseasSectorView from '@/pages/OverseasSectorView'
import { useJapanSectorSource } from '@/hooks/useJapanSectorSource'

// 일본 섹터 — 화면 구성은 모든 해외 시장이 같은 공통 섹터(OverseasSectorView)이고, 일본의 종목 목록·시세만 useJapanSectorSource가 맡는다.
export default function JapanSectorPage() {
  return <OverseasSectorView source={useJapanSectorSource()} />
}
