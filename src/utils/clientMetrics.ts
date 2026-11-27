import { isCustomPagePath } from './customRoutes.ts'

export type MetricPage = 'HOME' | 'MAP' | 'GRAPH' | 'CUSTOM' | 'CHART'
export type MetricType = 'PAGE_LOAD' | 'CLIENT_ERROR' | 'MAP_MOBILE_CAPTURE' | 'PC_CAPTURE'

export function metricPageFromPath(pathname: string): MetricPage | null {
  if (pathname === '/' || pathname === '/summary' || pathname.startsWith('/summary/')) return 'HOME'
  if (pathname === '/chart' || pathname.startsWith('/chart/')) return 'CHART'
  if (pathname === '/map' || pathname.startsWith('/map/')) return 'MAP'
  if (pathname === '/graph' || pathname.startsWith('/graph/')) return 'GRAPH'
  if (isCustomPagePath(pathname)) return 'CUSTOM'
  return null
}

export function reportClientMetric(page: MetricPage, type: MetricType, durationMs?: number) {
  void fetch('/api/metrics/client-events', {
    method: 'POST',
    credentials: 'omit',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, type, ...(durationMs === undefined ? {} : { durationMs: Math.round(durationMs) }) }),
  }).catch(() => undefined)
}
