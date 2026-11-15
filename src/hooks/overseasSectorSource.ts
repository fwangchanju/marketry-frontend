import type { CurrencyUnit } from '@/utils/currencyUnit'
import type { OverseasMarket } from '@/utils/markets'

// 해외 시장 섹터(OverseasSectorView)가 시장마다 다른 부분을 받는 모양. 시장별 훅(useJapanSectorSource·useUsaSectorSource)이 이 모양으로 돌려준다.
// 분류 데이터 주소(/japan/categories 등)와 관리자 분류 주소는 시장 목록표의 주소 조각으로 공통 화면이 만든다.
export interface OverseasSectorSource {
  market: OverseasMarket
  // 이 시장의 모든 종목 코드(분류별 종목 수·시가총액 합을 셀 때 쓴다).
  stockCodes: readonly string[]
  // 종목 목록을 받는 중·오류 상태(종목 목록이 파일에 들어 있는 시장은 늘 false).
  stocksState: { isLoading: boolean; isError: boolean; refetch: () => void }
  // 시세 — stockCode와 totalMarketValue를 가진 최신 시세.
  quotes: { data: { quotes: { stockCode: string; totalMarketValue: number }[] } | undefined; isLoading: boolean; isError: boolean; refetch: () => unknown }
  currency: Exclude<CurrencyUnit, '원'>
  tabStorageName: string
}
