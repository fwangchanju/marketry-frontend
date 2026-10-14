import client from './client'
import {
  SectorItemSchema,
  SectorDeletePreviewSchema,
  SnapshotItemSchema,
  StockSectorListItemSchema,
  BulkAssignResponseSchema,
  snapshotResponseSchema,
  TreemapScaleThresholdSchema,
  TreemapScaleResponseSchema,
  MarketValueTierListResponseSchema,
  CustomPreferencesSchema,
  type CustomPreferences,
} from '@/types/api'
import { z } from 'zod'

const sectorListResponseSchema = z.array(SectorItemSchema)
const snapshotListResponseSchema = z.array(SnapshotItemSchema)
const stockSectorListResponseSchema = snapshotResponseSchema(StockSectorListItemSchema)

// 로그인 사용자 전용(GET /api/custom/**) — 가입/로그인 전환 지시서 4·5에 따라 옛 /api/admin/market-map/*
// 를 대체한다. Legacy* 컨트롤러(구 프론트 전용 호환 경로)는 여기서 쓰지 않는다.

export const getSectors = () => client.get('/custom/sectors').then(r => sectorListResponseSchema.parse(r.data))

export const createSector = (name: string, parentId: number | null) =>
  client.post('/custom/sectors', { name, parentId }).then(r => SectorItemSchema.parse(r.data))

export const renameSector = (id: number, name: string) => client.patch(`/custom/sectors/${id}/name`, { name })

// parentId가 null이면 최상위(루트)로 이동.
export const reparentSector = (id: number, parentId: number | null) =>
  client.patch(`/custom/sectors/${id}/parent`, { parentId })

export const getSectorDeletePreview = (id: number) =>
  client.get(`/custom/sectors/${id}/delete-preview`).then(r => SectorDeletePreviewSchema.parse(r.data))

export const deleteSector = (id: number) => client.delete(`/custom/sectors/${id}`)

export const getSnapshots = () => client.get('/custom/snapshots').then(r => snapshotListResponseSchema.parse(r.data))

export const getCurrentSnapshot = () =>
  client.get('/custom/snapshots/current').then(r => SnapshotItemSchema.nullable().parse(r.data))

export const saveSnapshot = (label: string) =>
  client.post('/custom/snapshots', { label }).then(r => SnapshotItemSchema.parse(r.data))

export const overwriteSnapshot = (id: number, label: string) =>
  client.patch(`/custom/snapshots/${id}`, { label }).then(r => SnapshotItemSchema.parse(r.data))

export const restoreSnapshot = (id: number) => client.post(`/custom/snapshots/${id}/restore`)

export const deleteSnapshot = (id: number) => client.delete(`/custom/snapshots/${id}`)

export const assignStockSector = (stockCode: string, sectorId: number) =>
  client.put(`/custom/stock-sectors/${stockCode}`, { sectorId })

export const updateStockAlias = (stockCode: string, alias: string | null) =>
  client.patch(`/custom/stock-sectors/${stockCode}/alias`, { alias })

export const bulkAssignStockSector = (stockCodes: string[], sectorId: number) =>
  client
    .patch('/custom/stock-sectors/bulk', { stockCodes, sectorId })
    .then(r => BulkAssignResponseSchema.parse(r.data))

export const getStockSectors = () =>
  client.get('/custom/stock-sectors').then(r => stockSectorListResponseSchema.parse(r.data))

// 색상 스케일 기준값(threshold) 단건 CRUD — treemap.ts의 공개 기본값(/map/scale)과 달리 로그인 사용자
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

export const getCustomScale = () => client.get('/custom/scale').then(r => TreemapScaleResponseSchema.parse(r.data))

export const createCustomScaleThreshold = (payload: ScaleThresholdPayload) =>
  client.post('/custom/scale', toScaleThresholdRequestBody(payload)).then(r => TreemapScaleThresholdSchema.parse(r.data))

export const updateCustomScaleThreshold = (id: number, payload: ScaleThresholdPayload) =>
  client
    .put(`/custom/scale/${id}`, toScaleThresholdRequestBody(payload))
    .then(r => TreemapScaleThresholdSchema.parse(r.data))

export const deleteCustomScaleThreshold = (id: number) => client.delete(`/custom/scale/${id}`)

export const getCustomValueTiers = () =>
  client.get('/custom/value-tiers').then(r => MarketValueTierListResponseSchema.parse(r.data))

// 사용자가 바꾼 값만 담는 sparse JSON. 전체 교체(PUT)만 지원 — 부분 patch API는 없다.
export const getCustomPreferences = () =>
  client.get('/custom/preferences').then(r => CustomPreferencesSchema.parse(r.data))

export const replaceCustomPreferences = (payload: CustomPreferences) => client.put('/custom/preferences', payload)
