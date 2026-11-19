import type { ComponentType } from 'react'
import OverseasSummaryView from '@/pages/OverseasSummaryView'
import { useJapanSummarySource } from '@/hooks/useJapanSummarySource'
import { useUsaSummarySource } from '@/hooks/useUsaSummarySource'
import type { OverseasMarket } from '@/utils/markets'

// 해외 시장 서머리 — 화면 구성은 모든 해외 시장이 같은 공통 서머리(OverseasSummaryView)이고, 시장의 데이터·설정만 시장별 훅이 맡는다.
// 훅은 조건 없이 불러야 해서 시장마다 얇은 껍데기 컴포넌트를 둔다. 새 시장은 훅 하나와 껍데기 한 줄을 더하면 된다(빠지면 타입 오류가 난다).
function JapanSummary() {
  return <OverseasSummaryView source={useJapanSummarySource()} />
}
function UsaSummary() {
  return <OverseasSummaryView source={useUsaSummarySource()} />
}
const SUMMARY_BY_MARKET: Record<OverseasMarket, ComponentType> = { JAPAN: JapanSummary, USA: UsaSummary }

export default function OverseasSummaryPage({ market }: { market: OverseasMarket }) {
  const Home = SUMMARY_BY_MARKET[market]
  return <Home />
}
