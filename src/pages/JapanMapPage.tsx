import OverseasMapView from '@/pages/OverseasMapView'
import { useJapanMapSource } from '@/hooks/useJapanMapSource'

// 일본 지도 — 화면 구성은 모든 해외 시장이 같은 공통 지도(OverseasMapView)이고, 일본의 데이터·설정만 useJapanMapSource가 맡는다.
export default function JapanMapPage() {
  return <OverseasMapView source={useJapanMapSource()} />
}
