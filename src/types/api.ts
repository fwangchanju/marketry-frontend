import { z } from 'zod'

const TradingTimeWindowSchema = z.object({ startTime: z.string(), endTime: z.string() })
export const MarketTradingScheduleSchema = z.object({
  date: z.string(),
  status: z.enum(['TRADING_DAY', 'HOLIDAY', 'FAILED']),
  preMarket: TradingTimeWindowSchema.nullable(),
  regularMarket: TradingTimeWindowSchema.nullable(),
  afterMarket: TradingTimeWindowSchema.nullable(),
  nxtOnlyWindows: z.array(TradingTimeWindowSchema),
})
export type MarketTradingSchedule = z.infer<typeof MarketTradingScheduleSchema>

// ─── Enums ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const MarketQuerySchema = z.enum(['KOSPI', 'KOSDAQ', 'ALL_STOCK'])
export type MarketQuery = z.infer<typeof MarketQuerySchema>

export const MarketSchema = z.enum(['KOSPI', 'KOSDAQ'])
export type Market = z.infer<typeof MarketSchema>

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const IntradayInvestorSchema = z.enum([
  'FOREIGNER', 'FOREIGN_COMPANY', 'INSTITUTION',
  'PENSION_FUND', 'TRUST', 'FOREIGN_TOTAL',
])
export type IntradayInvestor = z.infer<typeof IntradayInvestorSchema>

const InvestorSchema = z.enum([
  'PERSONAL', 'FOREIGNER', 'INSTITUTION',
  'FINANCIAL_INVESTMENT', 'TRUST', 'PENSION_FUND',
  'PRIVATE_FUND', 'INSURANCE', 'BANK',
  'OTHER_CORP', 'GOVERNMENT', 'OTHER_FINANCE', 'FOREIGN_COMPANY',
])
export type Investor = z.infer<typeof InvestorSchema>

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const IntradayRankingSchema = z.enum(['NET_BUY', 'NET_SELL'])
export type IntradayRanking = z.infer<typeof IntradayRankingSchema>

export const ProgramRankingSchema = z.enum(['NET_BUY', 'NET_SELL'])
export type ProgramRanking = z.infer<typeof ProgramRankingSchema>

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 타입 추출 전용, 실제 파싱엔 안 씀
const AmtQtySchema = z.enum(['AMOUNT', 'QUANTITY'])
export type AmtQty = z.infer<typeof AmtQtySchema>

const RegisterBySchema = z.enum(['USER', 'HOLDINGS'])

// ─── Generic wrappers ─────────────────────────────────────────────────────────

export const snapshotResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    snapshotTime: z.string().nullable(),
    items: z.array(itemSchema),
  })

export const stockHistoryResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    stockCode: z.string().nullable(),
    snapshotTime: z.string().nullable(),
    items: z.array(itemSchema),
  })

// ─── Dashboard ───────────────────────────────────────────────────────────────

const MarketOverviewItemSchema = z.object({
  market: MarketSchema,
  marketStatus: z.string(),
  indexValue: z.number(),
  changeValue: z.number(),
  changeRate: z.number(),
  tradingValue: z.number(),       // 백만 원
  upperLimitCount: z.number(),
  lowerLimitCount: z.number(),
  advancers: z.number(),
  decliners: z.number(),
  unchangedCount: z.number(),
  snapshotTime: z.string(),
})

const InvestorTradingSummaryItemSchema = z.object({
  market: MarketSchema,
  investor: InvestorSchema,
  buyAmount: z.number(),          // 억 원, 항상 0
  sellAmount: z.number(),         // 억 원, 항상 0
  netBuyAmount: z.number(),       // 억 원
  snapshotTime: z.string(),
})

export const ProgramTradingRankingItemSchema = z.object({
  rank: z.number(),
  stockCode: z.string(),
  stockName: z.string(),
  programBuyAmount: z.number(),    // 백만 원
  programSellAmount: z.number(),   // 백만 원
  programNetBuyAmount: z.number(), // 백만 원
  snapshotTime: z.string(),
})
export type ProgramTradingRankingItem = z.infer<typeof ProgramTradingRankingItemSchema>

export const IndexContributionItemSchema = z.object({
  market: MarketSchema,
  rank: z.number(),
  stockCode: z.string(),
  stockName: z.string(),
  contributionScore: z.number(),
  priceChangeRate: z.number(),
  snapshotTime: z.string(),
})
export type IndexContributionItem = z.infer<typeof IndexContributionItemSchema>

export const WatchStockItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  market: MarketSchema,
  isMain: z.boolean(),
  registerBy: RegisterBySchema,
})

export const IntradayTopItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  netBuyAmount: z.number(),   // 백만 원
  snapshotTime: z.string(),
})
export type IntradayTopItem = z.infer<typeof IntradayTopItemSchema>

export const ProgramTradingHistoryItemSchema = z.object({
  snapshotTime: z.string(),
  programBuyAmount: z.number(),    // 백만 원
  programSellAmount: z.number(),   // 백만 원
  programNetBuyAmount: z.number(), // 백만 원
})
export type ProgramTradingHistoryItem = z.infer<typeof ProgramTradingHistoryItemSchema>

export const ShortSellingHistoryItemSchema = z.object({
  tradeDate: z.string(),
  closePrice: z.number(),
  priceChange: z.number(),
  changeRate: z.number(),
  tradingVolume: z.number(),
  shortVolume: z.number(),
  cumulativeShortVolume: z.number(),
  shortRatio: z.number(),
  shortAmount: z.number(),        // 천 원
  shortAvgPrice: z.number(),
})
export type ShortSellingHistoryItem = z.infer<typeof ShortSellingHistoryItemSchema>

// ─── Market summary (/summary) ─────────────────────────────────────────

export const MarketSummaryResponseSchema = z.object({
  marketOverviews: snapshotResponseSchema(MarketOverviewItemSchema),
  investorTradingSummaries: snapshotResponseSchema(InvestorTradingSummaryItemSchema),
  intradayTopRankings: snapshotResponseSchema(IntradayTopItemSchema),
  programTradingHighlights: snapshotResponseSchema(ProgramTradingRankingItemSchema),
  indexContributionHighlights: snapshotResponseSchema(IndexContributionItemSchema),
  mainShortSellingHistory: stockHistoryResponseSchema(ShortSellingHistoryItemSchema),
  mainProgramTradingHistory: stockHistoryResponseSchema(ProgramTradingHistoryItemSchema),
})

// ─── Stock ───────────────────────────────────────────────────────────────────

export const StockItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  market: MarketSchema,
})

// ─── Program trading (daily) ──────────────────────────────────────────────────

export const ProgramTradingDailyItemSchema = z.object({
  tradeDate: z.string(),
  programBuyAmount: z.number(),    // 백만 원
  programSellAmount: z.number(),   // 백만 원
  programNetBuyAmount: z.number(), // 백만 원
})
export type ProgramTradingDailyItem = z.infer<typeof ProgramTradingDailyItemSchema>

// ─── Market map ────────────────────────────────────────────────────────────────

// 시가총액 구간(초대형주/대형주/...) 정의 — 코드 enum이 아니라 GET /map/value-tiers로 조회한다.
// thresholdValue 오름차순 정렬로 내려온다. isExcludedByDefault는 화면 진입 시 필터 토글의 초기값일 뿐,
// 이후 토글 상태는 프론트가 직접 관리한다(백엔드에 다시 물어보지 않음).
export const MarketValueTierItemSchema = z.object({
  id: z.number(),
  label: z.string(),
  thresholdValue: z.number(),
  isExcludedByDefault: z.boolean(),
})
export type MarketValueTierItem = z.infer<typeof MarketValueTierItemSchema>
export const MarketValueTierListResponseSchema = z.array(MarketValueTierItemSchema)

const MarketMapItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  // 배정된 약칭 — 없으면 null. 박스 라벨 등 alias를 우선해야 하는 표시는 "alias ?? stockName"으로 계산한다.
  alias: z.string().nullable(),
  currentPrice: z.number(),     // 현재가, 원
  lastPrice: z.number(),        // 전일종가, 원
  totalMarketValue: z.number(), // 원
  marketValueTier: z.string(),
  changeRate: z.number(),
  snapshotTime: z.string(),
  // 기간 등락률에서만 프론트가 붙인다(서버는 보내지 않는다) — 종목 팝업의 가격 줄 이름. lastPrice는 기준가, currentPrice는 종료일의 종가(장중이면 현재가)다.
  rangeLabels: z.object({ base: z.string(), end: z.string() }).optional(),
})
export type MarketMapItem = z.infer<typeof MarketMapItemSchema>

export interface MarketMapSectorNode {
  sectorId: number
  sectorName: string
  totalMarketValue: number
  isExcluded: boolean
  children: MarketMapSectorNode[]
  items: MarketMapItem[]
}

const MarketMapSectorNodeSchema: z.ZodType<MarketMapSectorNode> = z.lazy(() =>
  z.object({
    sectorId: z.number(),
    sectorName: z.string(),
    totalMarketValue: z.number(),
    isExcluded: z.boolean(),
    children: z.array(MarketMapSectorNodeSchema),
    items: z.array(MarketMapItemSchema),
  }),
)

// SnapshotResponse<T>를 그대로 안 쓴 이유: marketOverview는 트리 items와 별개인 마켓 전체 단위 값
// 하나라, 여러 엔드포인트가 공유하는 제네릭 래퍼에 이 필드만을 위해 얹을 수 없다(백엔드 MarketMapResponse
// 참고). market이 ALL_STOCK처럼 마켓 여럿을 합친 조회면 단일 지수값이 없어 null.
export const MarketMapResponseSchema = z.object({
  snapshotTime: z.string().nullable(),
  items: z.array(MarketMapSectorNodeSchema),
  marketOverview: MarketOverviewItemSchema.nullable(),
  // 선택한 분류의 갱신 시각: MARKETRY는 올린 업종 정보·종목 배정 수정, 거래소는 종목 정보 동기화.
  taxonomyUpdatedAt: z.string().nullish(),
  afterHoursStart: z.string().nullish(),
})
export type MarketMapResponse = z.infer<typeof MarketMapResponseSchema>

// 박스/범례 등락률 컬러 스케일의 기준값 하나(admin이 개별 CRUD하는 단위) — src/utils/marketMapColorScale.ts 참고.
// side는 별도 필드로 두지 않고 thresholdPercent의 부호로 표현한다(음수=하락, 0=기준, 양수=상승).
// id는 서버가 발급 — 로컬에서 막 추가해서 아직 서버에 반영 안 된 행은 id가 없다(생성 응답으로 받기 전까지).
// colorLabel은 백엔드에서 ColorTone enum(RED/ORANGE/...)이라 대문자로 오는데, 프론트 내부(톤 프리셋
// 버튼 이름 비교 등)는 전부 소문자 기준이라 파싱 시점에 소문자로 변환해서 그 차이를 여기서 흡수한다.
export const MarketMapScaleThresholdSchema = z.object({
  id: z.number(),
  thresholdPercent: z.number(),
  color: z.string(),
  colorLabel: z
    .string()
    .nullable()
    .transform(v => v?.toLowerCase() ?? null),
})
export type MarketMapScaleThreshold = z.infer<typeof MarketMapScaleThresholdSchema>

// GET /map/scale 응답
export const MarketMapScaleResponseSchema = z.object({
  thresholds: z.array(MarketMapScaleThresholdSchema),
})
export type MarketMapScaleResponse = z.infer<typeof MarketMapScaleResponseSchema>

export const ExcludedStockItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
})

// 백엔드 /api/admin/market-map/* → /api/custom/* 전환(가입/로그인 지시서)에 맞춰 DTO 필드명도
// category* → sector* 로 바뀌었다. /api/map 응답도 category → sector 정리(instructions-sector-rename.md)로
// 같은 sectorId/sectorName을 쓰게 됐지만, 두 응답은 여전히 별개 계약이다.
export const SectorItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  parentId: z.number().nullable(),
  depth: z.number(),
})
export type SectorItem = z.infer<typeof SectorItemSchema>

// GET /custom/stock-sectors 응답 (백엔드 StockSectorListItem)
export const StockSectorListItemSchema = z.object({
  stockCode: z.string(),
  market: MarketSchema,
  stockName: z.string(),
  // NXT 거래 가능 종목(키움 nxtEnable=Y)인지.
  nxtEnabled: z.boolean(),
  alias: z.string().nullable(),
  totalMarketValue: z.number().nullable(),
  marketValueTier: z.string().nullable(),
  industryName: z.string().nullable(),
  parentSectorName: z.string().nullable(),
  sectorName: z.string().nullable(),
  sectorId: z.number().nullable(),
})
export type StockSectorListItem = z.infer<typeof StockSectorListItemSchema>

// GET /map/stock-catalog 응답 (백엔드 StockCatalogItem) — 로그인 없이 읽는 종목 공통 정보. 회원별 분류·별칭은 없다.
export const StockCatalogItemSchema = z.object({
  stockCode: z.string(),
  market: MarketSchema,
  nxtEnabled: z.boolean(),
  industryName: z.string().nullable(),
})
export type StockCatalogItem = z.infer<typeof StockCatalogItemSchema>

// PATCH /custom/stock-sectors/bulk 응답. failedStockCodes가 비어있으면 전부 반영된 것.
export const BulkAssignResponseSchema = z.object({
  failedStockCodes: z.array(z.string()),
  sectorId: z.number(),
})
export type BulkAssignResponse = z.infer<typeof BulkAssignResponseSchema>

// delete-preview API의 blockingStocks 항목 (백엔드 StockSectorItem — 위 StockSectorListItem과는
// 다른 타입이라 market/totalMarketValue/parentSectorName이 없음)
export const StockSectorItemSchema = z.object({
  stockCode: z.string(),
  stockName: z.string(),
  sectorName: z.string(),
})
export type StockSectorItem = z.infer<typeof StockSectorItemSchema>

export const SectorDeletePreviewSchema = z.object({
  sectorName: z.string(),
  deletable: z.boolean(),
  blockingStocks: z.array(StockSectorItemSchema),
  deletableSectors: z.array(z.string()),
})

export const SnapshotItemSchema = z.object({
  id: z.number(),
  label: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SnapshotItem = z.infer<typeof SnapshotItemSchema>

// ─── Auth ──────────────────────────────────────────────────────────────────

export const AuthRoleSchema = z.enum(['USER', 'ADMIN'])

// GET /auth/session, POST /auth/refresh 응답 — 비로그인이면 authenticated=false에 나머지는 전부 null.
export const AuthSessionResponseSchema = z.object({
  authenticated: z.boolean(),
  userId: z.number().nullable(),
  email: z.string().nullable(),
  role: AuthRoleSchema.nullable(),
  // 프로필 닉네임과 사진 버전(없으면 null). 옛 응답에는 필드가 없을 수 있어 nullish로 받는다.
  nickname: z.string().nullish(),
  profileImageVersion: z.number().nullish(),
})
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>

// GET/PUT /profile/** 응답 — 사진이 있으면 imageVersion(epoch 밀리초)으로 GET /profile/image?v= 주소를 만든다.
export const ProfileResponseSchema = z.object({
  nickname: z.string().nullable(),
  hasImage: z.boolean(),
  imageVersion: z.number().nullable(),
})
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>

// GET/PUT /custom/preferences — 사용자가 바꾼 값만 담는 sparse JSON. 값 형태가 키마다 달라 값 자체는
// 검증하지 않는다.
export const CustomPreferencesSchema = z.record(z.string(), z.unknown())
export type CustomPreferences = z.infer<typeof CustomPreferencesSchema>
