import client from './client'
import type { DefaultProfiles } from '@/hooks/useDefaultPreferences'

export function getAdminDefaults(signal?: AbortSignal) {
  return client.get<DefaultProfiles>('/admin/default-preferences', { signal }).then(response => response.data)
}

export function saveAdminDefaults(value: DefaultProfiles) {
  return client.put<DefaultProfiles>('/admin/default-preferences', value).then(response => response.data)
}
