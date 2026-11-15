import OverseasMapView from '@/pages/OverseasMapView'
import { useUsaMapSource } from '@/hooks/useUsaMapSource'

// 미국 S&P500 지도 — 화면 구성은 모든 해외 시장이 같은 공통 지도(OverseasMapView)이고, 미국의 데이터·설정만 useUsaMapSource가 맡는다.
// 하루 한 번 저장된 종가로 그린다. 모바일 캡처(?capture=mobile·스크린샷 창의 모바일)도 공통 지도가 한다.
export default function UsaMapPage() {
  return <OverseasMapView source={useUsaMapSource()} />
}
