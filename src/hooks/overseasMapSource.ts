import type { ComponentType, ReactNode } from 'react'
import type { FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import type { HeatmapSectorNode } from '@/types/api'
import type { CurrencyUnit } from '@/utils/currencyUnit'
import type { JAPAN_MAP_FIXED, JapanMapPreferences } from '@/utils/japanMapSettings'
import type { OverseasMarket } from '@/utils/markets'

// 해외 시장 지도(OverseasMapView)가 시장마다 다른 부분을 받는 모양. 시장별 훅(useJapanMapSource·useUsaMapSource)이 이 모양으로 돌려준다.
// 새 시장(대만 등)은 같은 모양의 훅 하나를 만들면 된다 — 화면 구성은 공통 화면이 한다.
export interface OverseasMapSource {
  market: OverseasMarket
  // 툴바 배지와 이동 경로 맨 앞 이름(시장 목록표의 배지 글자).
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
  isError: boolean
  isFetching: boolean
  refetchAll: () => Promise<unknown>
  preferences: JapanMapPreferences
  update: (changes: Partial<JapanMapPreferences>) => void
  // 시장마다 다른 날짜 선택 칩과 장 상태 칩.
  DatePicker: ComponentType<{ snapshotTime: string | null; liveTime: string | null; rangeStart: string | null; holidayColor: string; onSelect: (pick: string | null) => void; onSelectRange: (start: string, end: string) => void }>
  sessionChip: ReactNode
  refreshHelp: string
  currencyUnit: CurrencyUnit
  // 분류 단계 이름(이동 경로의 "대분류로 돌아가기" 등)과 상위 업종 강조 기본 단계 수.
  levelLabels: string[]
  defaultMaxDepth: number
  // 설정 화면이 없는 고정 값(색상·박스 글자 기준 등).
  fixed: { boxLabelMinAreaPercent: number; stockPopupOnHover: boolean; strongIndustryColor: string; colorScale: (typeof JAPAN_MAP_FIXED)['colorScale'] }
  draftKeyMap: Readonly<Record<string, string>>
  tabStorageName: string
  // 설정창의 "n/m종목"의 m과, 화면에 그린 종목 수 계산(시장마다 센 기준이 다르다).
  totalCount: number
  countShown: (filteredRootNodes: FilteredHeatmapSectorNode[]) => number
}
