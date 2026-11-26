import type { ClassificationMarket } from '@/utils/markets'
import client from './client'
import {
  SectorItemSchema,
  SectorDeletePreviewSchema,
  SnapshotItemSchema,
  StockSectorListItemSchema,
  BulkAssignResponseSchema,
  snapshotResponseSchema,
  HeatmapScaleThresholdSchema,
  HeatmapScaleResponseSchema,
  MarketValueTierListResponseSchema,
  CustomPreferencesSchema,
  type CustomPreferences,
} from '@/types/api'
import { z } from 'zod'

const sectorListResponseSchema = z.array(SectorItemSchema)
const snapshotListResponseSchema = z.array(SnapshotItemSchema)
const stockSectorListResponseSchema = snapshotResponseSchema(StockSectorListItemSchema)
const classificationUploadResponseSchema = z.object({
  createdSectorCount: z.number(),
  appliedAssignments: z.array(z.object({ path: z.array(z.string()), sectorId: z.number(), stockCodes: z.array(z.string()) })),
  failedStockCodes: z.array(z.string()),
})

// 로그인 사용자 전용(GET /api/custom/**).
// market을 주지 않으면 한국이다. 한국 요청에는 시장을 붙이지 않아 지금 요청과 똑같다.
export const marketParams = (market: ClassificationMarket) => (market === 'KOREA' ? {} : { market })

export const getSectors = (market: ClassificationMarket = 'KOREA') => client.get('/custom/sectors', { params: marketParams(market) }).then(r => sectorListResponseSchema.parse(r.data))

export const resetCustomClassification = (market: ClassificationMarket = 'KOREA') => client.delete('/custom/sectors', { params: marketParams(market) })

export const createSector = (name: string, parentId: number | null, market: ClassificationMarket = 'KOREA') =>
  client.post('/custom/sectors', { name, parentId }, { params: marketParams(market) }).then(r => SectorItemSchema.parse(r.data))

export const renameSector = (id: number, name: string, market: ClassificationMarket = 'KOREA') =>
  client.patch(`/custom/sectors/${id}/name`, { name }, { params: marketParams(market) })

// parentId가 null이면 최상위(루트)로 이동.
export const reparentSector = (id: number, parentId: number | null, market: ClassificationMarket = 'KOREA') =>
  client.patch(`/custom/sectors/${id}/parent`, { parentId }, { params: marketParams(market) })

export const getSectorDeletePreview = (id: number, market: ClassificationMarket = 'KOREA') =>
  client.get(`/custom/sectors/${id}/delete-preview`, { params: marketParams(market) }).then(r => SectorDeletePreviewSchema.parse(r.data))

// expectedMoveCount는 미리보기에서 확인한 이동 종목 수다 — 지금 수와 다르면 서버가 삭제하지 않고 409로 다시 확인하게 한다.
export const deleteSector = (id: number, expectedMoveCount: number, market: ClassificationMarket = 'KOREA') =>
  client.delete(`/custom/sectors/${id}`, { params: { expectedMoveCount, ...marketParams(market) } })

export const getSnapshots = (market: ClassificationMarket = 'KOREA') => client.get('/custom/snapshots', { params: marketParams(market) }).then(r => snapshotListResponseSchema.parse(r.data))

export const getCurrentSnapshot = (market: ClassificationMarket = 'KOREA') =>
  client.get('/custom/snapshots/current', { params: marketParams(market) }).then(r => SnapshotItemSchema.nullable().parse(r.data))

export const saveSnapshot = (label: string, market: ClassificationMarket = 'KOREA') =>
  client.post('/custom/snapshots', { label }, { params: marketParams(market) }).then(r => SnapshotItemSchema.parse(r.data))

export const overwriteSnapshot = (id: number, label: string, market: ClassificationMarket = 'KOREA') =>
  client.patch(`/custom/snapshots/${id}`, { label }, { params: marketParams(market) }).then(r => SnapshotItemSchema.parse(r.data))

export const restoreSnapshot = (id: number, market: ClassificationMarket = 'KOREA') =>
  client.post(`/custom/snapshots/${id}/restore`, undefined, { params: marketParams(market) })

export const deleteSnapshot = (id: number, market: ClassificationMarket = 'KOREA') =>
  client.delete(`/custom/snapshots/${id}`, { params: marketParams(market) })

export const assignStockSector = (stockCode: string, sectorId: number, market: ClassificationMarket = 'KOREA') =>
  client.put(`/custom/stock-sectors/${stockCode}`, { sectorId }, { params: marketParams(market) })

export const updateStockAlias = (stockCode: string, alias: string | null) =>
  client.patch(`/custom/stock-sectors/${stockCode}/alias`, { alias })

export const bulkAssignStockSector = (stockCodes: string[], sectorId: number, market: ClassificationMarket = 'KOREA') =>
  client
    .patch('/custom/stock-sectors/bulk', { stockCodes, sectorId }, { params: marketParams(market) })
    .then(r => BulkAssignResponseSchema.parse(r.data))

export const uploadClassification = (assignments: { path: string[]; stockCodes: string[] }[], market: ClassificationMarket = 'KOREA') =>
  client.post('/custom/stock-sectors/upload', { assignments }, { params: marketParams(market) }).then(r => classificationUploadResponseSchema.parse(r.data))

// 종목마다 배정된 업종 번호(일본·미국 내 기준 표가 쓴다). 종목 이름·시세는 시장별로 따로 받는다.
export const getStockAssignments = (market: ClassificationMarket) =>
  client.get('/custom/stock-sectors/assignments', { params: marketParams(market) }).then(r => z.record(z.string(), z.number()).parse(r.data))

export const getStockSectors = () =>
  client.get('/custom/stock-sectors').then(r => stockSectorListResponseSchema.parse(r.data))

// 색상 스케일 기준값(threshold) 단건 CRUD — heatmap.ts의 공개 기본값(/map/scale)과 달리 로그인 사용자
// 본인 값을 읽고 고친다. 처음엔 전체 배열을 통째로 PUT하는 full-replace 방식이었으나, 삭제 하나만 하려
// 해도 안 건드린 행까지 매번 다 지웠다 다시 만드는 낭비였고, id를 프론트에 내려준 순간 그 id가 다음
// 저장마다 전부 새로 발급돼버려서 "id로 개별 삭제"가 애초에 불안정해져서 폐기함.
interface ScaleThresholdPayload {
  thresholdPercent: number
  color: string
  // 백엔드는 ColorLabel enum(RED/ORANGE/...) — 프론트 내부는 소문자 기준이라 여기서만 대문자로 변환한다.
  colorLabel: string | null
}
const toScaleThresholdRequestBody = (payload: ScaleThresholdPayload) => ({
  ...payload,
  colorLabel: payload.colorLabel?.toUpperCase() ?? null,
})

export const getCustomScale = () => client.get('/custom/scale').then(r => HeatmapScaleResponseSchema.parse(r.data))

export const createCustomScaleThreshold = (payload: ScaleThresholdPayload) =>
  client.post('/custom/scale', toScaleThresholdRequestBody(payload)).then(r => HeatmapScaleThresholdSchema.parse(r.data))

export const updateCustomScaleThreshold = (id: number, payload: ScaleThresholdPayload) =>
  client
    .put(`/custom/scale/${id}`, toScaleThresholdRequestBody(payload))
    .then(r => HeatmapScaleThresholdSchema.parse(r.data))

export const deleteCustomScaleThreshold = (id: number) => client.delete(`/custom/scale/${id}`)

export const getCustomValueTiers = () =>
  client.get('/custom/value-tiers').then(r => MarketValueTierListResponseSchema.parse(r.data))

// 사용자가 바꾼 값만 담는 sparse JSON. 전체 교체(PUT)만 지원 — 부분 patch API는 없다.
export const getCustomPreferences = () =>
  client.get('/custom/preferences').then(r => CustomPreferencesSchema.parse(r.data))

export const replaceCustomPreferences = (payload: CustomPreferences) => client.put('/custom/preferences', payload)
