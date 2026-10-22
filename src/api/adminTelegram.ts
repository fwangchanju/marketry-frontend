import { z } from 'zod'
import client from './client'

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
