import japanStocks from '@/data/japanStocks.json'
import usaStocks from '@/data/usaStocks.json'
import type { SnapshotMarket } from '@/utils/markets'

type StockSheetDefinition = {
  // 종목의 영어 이름과 시장 분류. 어떤 종목이 있는지는 다른 화면과 같은 목록(useMarketStocks)이 정한다.
  details: readonly { code: string; name: string; englishName?: string; sector: string }[]
  // 시가총액 단위와 원 환산.
  unit: { symbol: string; suffix: string; perEok: number; krwRate: number; rateNote: string }
  // 시장 분류 열 이름.
  sectorColumnLabel: string
}

// STOCK 표에서 시장마다 다른 값. 환산은 실시간 환율을 잇기 전의 임시 기준이다. 종목 파일이 커서 STOCK 화면만 불러온다.
export const SNAPSHOT_STOCK_SHEETS: Readonly<Record<SnapshotMarket, StockSheetDefinition>> = {
  JAPAN: { details: japanStocks, unit: { symbol: '¥', suffix: '엔', perEok: 100_000_000, krwRate: 8.5, rateNote: '100엔 당 850원' }, sectorColumnLabel: '야후 분류' },
  USA: { details: usaStocks, unit: { symbol: '$', suffix: '달러', perEok: 100_000_000, krwRate: 1350, rateNote: '1달러 당 1,350원' }, sectorColumnLabel: 'GICS 분류' },
}
