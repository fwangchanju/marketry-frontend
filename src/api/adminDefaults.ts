import client from './client'
import type { DefaultProfiles } from '@/hooks/useDefaultPreferences'

export function getAdminDefaults(signal?: AbortSignal) {
  return client.get<DefaultProfiles>('/admin/default-preferences', { signal }).then(response => response.data)
}

export function saveAdminDefaults(value: DefaultProfiles) {
  return client.put<DefaultProfiles>('/admin/default-preferences', value).then(response => response.data)
}

// 한 프로필만 저장한다. 다른 프로필의 기본값은 그대로 남는다.
export function saveAdminDefaultProfile(profile: string, settings: Record<string, unknown>) {
  return client.put<DefaultProfiles>(`/admin/default-preferences/${profile}`, settings).then(response => response.data)
}
