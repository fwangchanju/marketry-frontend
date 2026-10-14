import type { ChangeRateMode } from '@/api/treemap'
import type { TaxonomySource } from '@/utils/taxonomyNames'
import type { MarketQuery } from '@/types/api'

export const marketSummaryKeys = {
  all: ['summary'] as const,
  summary: () => [...marketSummaryKeys.all, 'summary'] as const,
}

export const treemapKeys = {
  all: ['map'] as const,
  tradingSchedule: (date: string) => [...treemapKeys.all, 'trading-schedule', date] as const,
  // exclude 필터링이 프론트로 옮겨오면서 백엔드는 항상 전체 트리를 내려주므로, isExclude는 쿼리에서 뺐다.
  // snapshotTime은 달력에서 지난 날짜를 골랐을 때만 있다(없으면 최신).
  map: (
    market: MarketQuery,
    source: TaxonomySource,
    nxtOnly: boolean,
    basis: ChangeRateMode = 'daily',
    snapshotTime: string | null = null,
  ) => [...treemapKeys.all, 'map', market, source, nxtOnly, basis, snapshotTime] as const,
  tradingDayGap: (from: string, to: string) => [...treemapKeys.all, 'trading-day-gap', from, to] as const,
  snapshotDays: (market: MarketQuery, month: string) => [...treemapKeys.all, 'snapshot-days', market, month] as const,
  scale: () => [...treemapKeys.all, 'scale'] as const,
  notices: () => [...treemapKeys.all, 'notices'] as const,
  valueTiers: () => [...treemapKeys.all, 'value-tiers'] as const,
  stockCatalog: () => [...treemapKeys.all, 'stock-catalog'] as const,
  // 섹터 페이지의 now·before 쌍 쿼리 키 — now.snapshotTime이 바뀌면(새 tick) 새 쌍을 받는다.
  // market·source·beforeMinutes가 바뀌면(사용자 조작) 직전 쌍을 placeholder로 쓰지 않는다.
  sectorPair: (
    market: MarketQuery,
    source: TaxonomySource,
    nxtOnly: boolean,
    beforeMinutes: number,
    nowSnapshotTime: string | null,
    basis: ChangeRateMode = 'daily',
    afterHoursStart?: string | null,
  ) => [...treemapKeys.all, 'sectorPair', market, source, nxtOnly, beforeMinutes, nowSnapshotTime, basis, afterHoursStart] as const,
}

export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
}

export const customTreemapKeys = {
  all: ['custom-treemap'] as const,
  sectors: () => [...customTreemapKeys.all, 'sectors'] as const,
  sectorDeletePreview: (id: number) => [...customTreemapKeys.all, 'sector-delete-preview', id] as const,
  snapshots: () => [...customTreemapKeys.all, 'snapshots'] as const,
  currentSnapshot: () => [...customTreemapKeys.all, 'current-snapshot'] as const,
  stockSectors: () => [...customTreemapKeys.all, 'stock-sectors'] as const,
  scale: () => [...customTreemapKeys.all, 'scale'] as const,
  valueTiers: () => [...customTreemapKeys.all, 'value-tiers'] as const,
}

export const customPreferenceKeys = {
  all: ['custom-preferences'] as const,
  preferences: () => [...customPreferenceKeys.all, 'preferences'] as const,
}
