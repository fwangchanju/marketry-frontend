export function resolveTelegramPreference<T>(capture: boolean, values: Record<string, unknown> | undefined, key: string, fallback: T): T {
  return capture && values && Object.hasOwn(values, key) ? values[key] as T : fallback
}
