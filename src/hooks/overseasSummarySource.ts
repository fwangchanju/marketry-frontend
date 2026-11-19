import type { ComponentType, ReactNode } from 'react'
import type { CurrencyUnit } from '@/utils/currencyUnit'
import type { HeatmapSectorNode } from '@/types/api'
import type { JAPAN_MAP_FIXED } from '@/utils/japanMapSettings'
import type { OverseasMarket } from '@/utils/markets'

// 해외 시장 서머리(OverseasSummaryView)가 시장마다 다른 부분을 받는 모양. 시장별 훅(useJapanSummarySource·useUsaSummarySource)이 이 모양으로 돌려준다.
// 새 시장(대만 등)은 같은 모양의 훅 하나를 만들면 된다 — 화면 구성은 공통 화면이 한다.
export interface OverseasSummarySource {
  market: OverseasMarket
  // 툴바 배지 글자(시장 목록표의 배지 글자).
  label: string
  tree: HeatmapSectorNode[]
  snapshotTime: string | null
  liveSnapshotTime: string | null
  selectedTime: string | null
  rangeStart: string | null
  select: (pick: string | null) => void
  selectRange: (start: string, end: string) => void
  rangeExcludedStocks: { stockCode: string; stockName: string }[]
  isLoading: boolean
  isFetching: boolean
  refetchAll: () => Promise<unknown>
  DatePicker: ComponentType<{ snapshotTime: string | null; liveTime: string | null; rangeStart: string | null; holidayColor: string; onSelect: (pick: string | null) => void; onSelectRange: (start: string, end: string) => void }>
  // 장 상태 칩(시세가 아직 없으면 null).
  sessionChip: ReactNode
  refreshHelp: string
  // 설정 화면이 없는 고정 값(색상).
  fixed: { colorScale: (typeof JAPAN_MAP_FIXED)['colorScale']; strongIndustryColor: string }
  tabStorageName: string
  // 종목 구성 탭의 시가총액 범위(지도·그래프와 같은 저장 값)와 금액 단위.
  settingPrefix: string
  currencyUnit: CurrencyUnit
  // 설정창의 "n/m종목"의 n과 m.
  shownCount: number
  totalCount: number
}
