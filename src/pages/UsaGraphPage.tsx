import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import SnapshotMobile from '@/markets/SnapshotMobile'
import OverseasGraphView from '@/pages/OverseasGraphView'
import { useUsaGraphSource } from '@/hooks/useUsaGraphSource'

// 미국 S&P500 그래프 — 화면 구성은 모든 해외 시장이 같은 공통 그래프(OverseasGraphView)이고, 미국의 데이터·설정만 useUsaGraphSource가 맡는다.
// 하루 한 번 저장된 종가로 그리므로 "N분 전 대비"(비교 시점)는 없다.
function PcGraph() {
  return <OverseasGraphView source={useUsaGraphSource()} />
}

export default function UsaGraphPage() {
  return useIsNarrowScreen() ? <SnapshotMobile market="USA" mode="graph" /> : <PcGraph />
}
