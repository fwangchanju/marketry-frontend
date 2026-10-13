import client from './client'
import {
  MarketMapResponseSchema,
  MarketMapScaleResponseSchema,
  MarketNoticeResponseSchema,
  MarketTradingScheduleSchema,
  MarketValueTierListResponseSchema,
  StockCatalogItemSchema,
  type MarketQuery,
} from '@/types/api'
import { z } from 'zod'
import type { TaxonomySource } from '@/utils/taxonomyNames'


export const getMarketTradingSchedule = (date: string) =>
  client.get('/map/trading-schedule', { params: { date } })
    .then(r => MarketTradingScheduleSchema.parse(r.data))

// 등락률 기준 — daily는 전일 종가 대비 누적(기본), afterHours는 그날 정규장 종가 대비(15:40 이후 오늘 스냅샷에서만 적용된다).
export type ChangeRateMode = 'daily' | 'afterHours'

// 화면 토글의 선택 — 종가는 서버 기준이 아니라 그날 정규장 종가 스냅샷을 골라 보는 것이라 요청에는 daily로 나간다.
export type ChangeRateChoice = ChangeRateMode | 'close'

// source는 어떤 분류로 그릴지다 — krx(거래소), marketry(올린 분류, 로그인 없이 읽는다), mine(내 분류, 로그인 필요).
// nxtOnly는 NXT 거래 종목만 받는다. false일 때는 요청에 싣지 않는다. basis도 afterHours일 때만 요청에 싣는다.
export const getMarketMap = (
  market: MarketQuery,
  source: TaxonomySource,
  snapshotTime?: string,
  nxtOnly = false,
  basis: ChangeRateMode = 'daily',
) =>
  client
    .get('/map', {
      params: {
        market,
        source,
        ...(snapshotTime ? { snapshotTime } : {}),
        ...(nxtOnly ? { nxtOnly } : {}),
        ...(basis === 'afterHours' ? { basis } : {}),
      },
    })
    .then(r => MarketMapResponseSchema.parse(r.data))

// 달력에서 고를 수 있는 날짜 — month는 'yyyy-MM'. 날짜마다 그날 종가 스냅샷 시각이 같이 온다(getMarketMap의 snapshotTime에 그대로 쓴다).
const MarketMapSnapshotDaySchema = z.object({ date: z.string(), snapshotTime: z.string() })
export type MarketMapSnapshotDay = z.infer<typeof MarketMapSnapshotDaySchema>

export const getMarketMapSnapshotDays = (market: MarketQuery, month: string) =>
  client
    .get('/map/snapshot-days', { params: { market, month } })
    .then(r => z.array(MarketMapSnapshotDaySchema).parse(r.data))

// from(포함하지 않음)부터 to(포함)까지의 거래일 수 — 주말·휴장일은 세지 않는다. 날짜는 'yyyy-MM-dd'.
export const getTradingDayGap = (from: string, to: string) =>
  client
    .get('/map/trading-day-gap', { params: { from, to } })
    .then(r => z.object({ tradingDays: z.number() }).parse(r.data).tradingDays)

// 로그인 없이 읽는 종목 공통 정보(시장·NXT 거래 가능 여부·거래소 분류명) — 읽기 전용 시트가 쓴다.
export const getStockCatalog = () =>
  client.get('/map/stock-catalog').then(r => z.array(StockCatalogItemSchema).parse(r.data))

// 오늘 안내할 특수 종목(거래정지 제외 시작·신규 상장). 날짜를 주지 않으면 서버의 오늘이다.
export const getMarketNotices = () =>
  client.get('/map/notices').then(r => MarketNoticeResponseSchema.parse(r.data))

export const getMarketValueTiers = () =>
  client.get('/map/value-tiers').then(r => MarketValueTierListResponseSchema.parse(r.data))

export const getMarketMapScale = () =>
  client.get('/map/scale').then(r => MarketMapScaleResponseSchema.parse(r.data))

// 종목 단위 대신 섹터 단위로 제외한다 — 상태(is_excluded)는 market_map_category에 저장되고,
// 마켓맵 응답의 각 섹터 노드에 isExcluded로 같이 내려온다.
export const registerExcludedSector = (sectorId: number) =>
  client.post(`/map/excluded-sectors/${sectorId}`)

export const unregisterExcludedSector = (sectorId: number) =>
  client.delete(`/map/excluded-sectors/${sectorId}`)
