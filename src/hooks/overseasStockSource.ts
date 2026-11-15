import type { OverseasMarket } from '@/utils/markets'

// 해외 시장 종목 표의 한 종목(종목 목록 파일의 모양).
export interface OverseasStock {
  code: string
  name: string
  englishName?: string
  sector: string
}

// 해외 시장 종목(OverseasStockView)이 시장마다 다른 부분을 받는 모양. 시장별 훅(useJapanStockSource·useUsaStockSource)이 이 모양으로 돌려준다.
// 분류·종목명 데이터 주소와 관리자 저장 주소는 시장 목록표의 주소 조각으로 공통 화면이 만든다.
export interface OverseasStockSource {
  market: OverseasMarket
  stocks: readonly OverseasStock[]
  // 시세 — stockCode와 totalMarketValue를 가진 최신 시세.
  quotes: { data: { quotes: { stockCode: string; totalMarketValue: number }[] } | undefined; isLoading: boolean; isError: boolean; refetch: () => unknown }
  // 시가총액의 통화: 머리글 기호(¥·$), 값 뒤 글자(엔·달러), 억 단위 나눗수, 원화 환산 비율과 설정창 안내 문구.
  unit: { symbol: string; suffix: string; perEok: number; krwRate: number; rateNote: string }
  // 시장 분류 열 이름(일본 야후 분류, 미국 GICS 분류).
  sectorColumnLabel: string
  searchAriaLabel: string
  tabStorageName: string
}
