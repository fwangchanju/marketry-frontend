import japanStocks from '@/data/japanStocks.json'
import usaStocks from '@/data/usaStocks.json'
import type { OverseasMarket } from '@/utils/markets'

type StockSheetDefinition = {
  // 종목(영어 이름·시장 분류 포함).
  stocks: readonly { code: string; name: string; englishName?: string; sector: string }[]
  // 시가총액 단위와 원 환산.
  unit: { symbol: string; suffix: string; perEok: number; krwRate: number; rateNote: string }
  // 시장 분류 열 이름.
  sectorColumnLabel: string
}

// STOCK 표에서 시장마다 다른 값. 환산은 실시간 환율을 잇기 전의 임시 기준이다. 종목 파일이 커서 STOCK 화면만 불러온다.
export const SNAPSHOT_STOCK_SHEETS: Readonly<Record<OverseasMarket, StockSheetDefinition>> = {
  JAPAN: { stocks: japanStocks, unit: { symbol: '¥', suffix: '엔', perEok: 100_000_000, krwRate: 8.5, rateNote: '100엔 당 850원' }, sectorColumnLabel: '야후 분류' },
  USA: { stocks: usaStocks, unit: { symbol: '$', suffix: '달러', perEok: 100_000_000, krwRate: 1350, rateNote: '1달러 당 1,350원' }, sectorColumnLabel: 'GICS 분류' },
}
