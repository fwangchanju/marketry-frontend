import { z } from 'zod'
import client from './client'
import type { TelegramImageSetting, TelegramImageValues } from '@/hooks/useTelegramImageSetting'
import type { MarketValueTierItem } from '@/types/api'

const TelegramSendSettingSchema = z.object({
  enabled: z.boolean(),
  sectorSendMinute: z.number(),
  sectorSendIntervalMinutes: z.number(),
  // 저장된 값이 없으면 꺼짐이고 시각은 서버 기본값이다.
  saved: z.boolean(),
  updatedAt: z.string().nullable(),
  collectIntervalMinutes: z.number(),
  startHour: z.number(),
  endHour: z.number(),
  defaultSectorSendMinute: z.number(),
  defaultSectorSendIntervalMinutes: z.number(),
})

export type TelegramSendSetting = z.infer<typeof TelegramSendSettingSchema>

export type TelegramSendSettingInput = Pick<
  TelegramSendSetting,
  'enabled' | 'sectorSendMinute' | 'sectorSendIntervalMinutes'
>

export function getTelegramSendSetting(signal?: AbortSignal) {
  return client.get('/admin/telegram-settings', { signal }).then(response => TelegramSendSettingSchema.parse(response.data))
}

export function saveTelegramSendSetting(input: TelegramSendSettingInput) {
  return client.put('/admin/telegram-settings', input).then(response => TelegramSendSettingSchema.parse(response.data))
}

export function sendTelegramReportOnce() {
  return client.post('/admin/telegram-settings/send-once').then(() => undefined)
}

export function getTelegramImageSetting(signal?: AbortSignal) {
  return client.get<TelegramImageSetting>('/admin/telegram-image-setting', { signal }).then(response => response.data)
}

export type TelegramImageLegacySetting = { preferences: Record<string, unknown>; excludedSectors: Array<[string, string]>; tiers: MarketValueTierItem[] }

export function getTelegramImageLegacySetting(signal?: AbortSignal) {
  return client.get<TelegramImageLegacySetting>('/admin/telegram-image-setting/legacy', { signal }).then(response => response.data)
}

export function saveTelegramImageSetting(values: TelegramImageValues) {
  return client.put<TelegramImageSetting>('/admin/telegram-image-setting', values).then(response => response.data)
}
