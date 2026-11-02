import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'

export type TelegramImageValues = {
  preferences: Record<string, unknown>
  excludedSectors: Array<[number, string]>
}

export type TelegramImageSetting = { values: TelegramImageValues | null; updatedAt: string | null }

export function isTelegramMapCapture() {
  return window.location.pathname === '/map/korea' && new URLSearchParams(window.location.search).get('capture') === 'mobile'
}

export function useTelegramCaptureSetting() {
  return useQuery({
    queryKey: ['telegram-image-capture-setting'],
    queryFn: () => client.get<TelegramImageSetting>('/map/telegram-image-setting').then(response => response.data),
    enabled: isTelegramMapCapture(),
    retry: false,
    staleTime: Infinity,
  })
}
