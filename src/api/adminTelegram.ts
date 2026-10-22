import { z } from 'zod'
import client from './client'

const TelegramSendSettingSchema = z.object({
  enabled: z.boolean(),
  sectorSendMinute: z.number(),
  sectorSendIntervalMinutes: z.number(),
  // "HH:mm" 문자열 — 마지막 시각은 서버가 그날 정규장 종료 시각으로 대체한다.
  mapSendTimes: z.array(z.string()),
  // 저장된 값이 없으면 꺼짐이고 시각은 서버 기본값이다.
  saved: z.boolean(),
  updatedAt: z.string().nullable(),
  collectIntervalMinutes: z.number(),
  startHour: z.number(),
  endHour: z.number(),
  defaultSectorSendMinute: z.number(),
  defaultSectorSendIntervalMinutes: z.number(),
  defaultMapSendTimes: z.array(z.string()),
})

export type TelegramSendSetting = z.infer<typeof TelegramSendSettingSchema>

export type TelegramSendSettingInput = Pick<
  TelegramSendSetting,
  'enabled' | 'sectorSendMinute' | 'sectorSendIntervalMinutes' | 'mapSendTimes'
>

export function getTelegramSendSetting(signal?: AbortSignal) {
  return client.get('/admin/telegram-settings', { signal }).then(response => TelegramSendSettingSchema.parse(response.data))
}

export function saveTelegramSendSetting(input: TelegramSendSettingInput) {
  return client.put('/admin/telegram-settings', input).then(response => TelegramSendSettingSchema.parse(response.data))
}
