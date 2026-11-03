import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'

export type DefaultProfiles = Record<string, Record<string, unknown> | undefined>

export function useDefaultPreferences(enabled = true) {
  return useQuery({
    queryKey: ['default-preferences'],
    queryFn: () => client.get<DefaultProfiles>('/default-preferences').then(response => response.data),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
}
