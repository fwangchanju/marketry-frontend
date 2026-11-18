import type { ComponentType, ReactNode } from 'react'
import type { OverseasSectorExclusion } from '@/hooks/useOverseasSectorExclusion'
import type { HeatmapSectorNode } from '@/types/api'
import type { OverseasTierRange } from '@/hooks/useOverseasTierRange'
import type { CurrencyUnit } from '@/utils/currencyUnit'
import type { JAPAN_MAP_FIXED } from '@/utils/japanMapSettings'
import type { OverseasMarket } from '@/utils/markets'
import type { buildRankChart } from '@/utils/rankChart'

// 해외 시장 그래프(OverseasGraphView)가 시장마다 다른 부분을 받는 모양. 시장별 훅(useJapanGraphSource·useUsaGraphSource)이 이 모양으로 돌려준다.
// 막대 데이터를 어떻게 계산하는지(일본의 N분 전 대비·장중 지수, 미국의 종가 기준)와 설정창의 그래프 묶음은 시장별 훅이 만들고,
// 화면 구성은 공통 화면이 한다. 새 시장(대만 등)은 같은 모양의 훅 하나를 만들면 된다.
export interface OverseasGraphSource {
  market: OverseasMarket
  // 툴바 배지 글자(시장 목록표의 배지 글자).
  label: string
  chart: ReturnType<typeof buildRankChart>
  // 그래프 위 제목("시총 가중 등락률"·"15분 전 대비")과 단위(%·%p), 분류 단계 이름, 고른 단계(1부터).
  titleText: string
  titleUnit: string
  depthNames: readonly string[]
  groupDepth: number
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
  DatePicker: ComponentType<{ snapshotTime: string | null; liveTime: string | null; rangeStart: string | null; holidayColor: string; onSelect: (pick: string | null) => void; onSelectRange: (start: string, end: string) => void }>
  sessionChip: ReactNode
  refreshHelp: string
  fixed: { colorScale: (typeof JAPAN_MAP_FIXED)['colorScale']; strongIndustryColor: string }
  // 내 기준 모드에서만 준다 — MARKETRY 모드 설정은 브라우저에 바로 저장돼 저장 안 한 변경 점이 없다.
  draftKeyMap?: Readonly<Record<string, string>>
  // 종목 구성 탭의 시가총액 범위 — 지도와 같은 저장 값을 쓰며, 막대 계산(chart)에도 이미 반영돼 있다.
  tierRange: OverseasTierRange
  sectorExclusion: OverseasSectorExclusion
  // 제외 업종 목록의 이름·종목 수를 만들 업종 트리(필터 적용 전).
  exclusionTree: HeatmapSectorNode[]
  currencyUnit: CurrencyUnit
  tabStorageName: string
  // 설정창의 "n/m종목"의 m과 n.
  totalCount: number
  shownCount: number
  // 설정창 그래프 묶음의 내용(분류 단계·등락률 기준·비교 시점 등). 시장마다 항목이 다르다.
  graphSettings: ReactNode
}
