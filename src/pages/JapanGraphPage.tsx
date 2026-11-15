import OverseasGraphView from '@/pages/OverseasGraphView'
import { useJapanGraphSource } from '@/hooks/useJapanGraphSource'

// 일본 그래프 — 화면 구성은 모든 해외 시장이 같은 공통 그래프(OverseasGraphView)이고, 일본의 데이터·설정만 useJapanGraphSource가 맡는다.
export default function JapanGraphPage() {
  return <OverseasGraphView source={useJapanGraphSource()} />
}
