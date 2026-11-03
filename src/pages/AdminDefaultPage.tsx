import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAdminDefaults, saveAdminDefaults } from '@/api/adminDefaults'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import PageMainFrame from '@/components/PageMainFrame'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import { InfoPageHeading } from '@/components/InfoDocument'
import TelegramImageSettings from '@/components/TelegramImageSettings'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useMarketValueTiers } from '@/hooks/useMarketValueTiers'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSession } from '@/hooks/useSession'
import type { TelegramImageValues } from '@/hooks/useTelegramImageSetting'
import type { DefaultProfiles } from '@/hooks/useDefaultPreferences'
import { isAdminSession } from '@/utils/adminAccess'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { settingDefaultsFor } from '@/utils/settingDefaults'
import { defaultExcludedTierLabels } from '@/utils/marketValueTier'
import type { MarketValueTierItem } from '@/types/api'

type ProfileSnapshot = {
  values: TelegramImageValues
  tierRangeMinIndex: number
  tierRangeMaxIndex: number
  avgChangeRateUseSimple: boolean
  colorCustomOn: boolean
}

function ProfileReader({
  profile,
  onSnapshot,
}: {
  profile: 'marketry' | 'exchange'
  onSnapshot: (profile: 'marketry' | 'exchange', snapshot: ProfileSnapshot | null) => void
}) {
  const settings = useGlobalSettings(profile === 'marketry'
    ? { readOnlyTelegramSnapshot: true }
    : { defaultTaxonomy: 'KRX', taxonomyStorageKey: 'admin-default-exchange-taxonomy' })

  useEffect(() => {
    if (settings.isError) {
      onSnapshot(profile, null)
      return
    }
    if (settings.isLoading || !settings.isHeatmapSuccess || !settings.isMarketValueTierRangeReady) return
    const excludedSectors = profile === 'marketry'
      ? settings.telegramImageValues.excludedSectors
      : [...settings.excludedSectorNames.values()].map(name => [name, name] as [string, string])
    onSnapshot(profile, {
      values: { ...settings.telegramImageValues, excludedSectors },
      tierRangeMinIndex: settings.settingsModalProps.tierRangeMinIndex,
      tierRangeMaxIndex: settings.settingsModalProps.tierRangeMaxIndex,
      avgChangeRateUseSimple: settings.avgChangeRateUseSimple,
      colorCustomOn: settings.settingsModalProps.colorCustomOn,
    })
  }, [profile, settings, onSnapshot])

  return null
}

function profilePayload(snapshot: ProfileSnapshot, profile: 'marketry' | 'exchange') {
  const preferences = snapshot.values.preferences
  const result: Record<string, unknown> = {
    tierRangeMinIndex: snapshot.tierRangeMinIndex,
    tierRangeMaxIndex: snapshot.tierRangeMaxIndex,
    tierRangeMinValue: preferences['heatmap.tierRangeMinValue'],
    tierRangeMaxValue: preferences['heatmap.tierRangeMaxValue'],
    avgChangeRateUseSimple: snapshot.avgChangeRateUseSimple,
    colorCustomOn: snapshot.colorCustomOn,
  }
  for (const [key, value] of Object.entries(preferences)) {
    if (key.startsWith('heatmap.') && key !== 'heatmap.tierRangeMinValue' && key !== 'heatmap.tierRangeMaxValue') {
      const setting = key.slice('heatmap.'.length)
      if (setting === 'activeDepthMetric' && Array.isArray(value)) {
        result[setting] = value[0] === 0 && value[1] === 1
          ? 'simpleAvgChangeRate'
          : ['weightedAvgChangeRate', 'simpleAvgChangeRate', 'upDownCount', 'marketValue'][Number(value[0])] ?? 'simpleAvgChangeRate'
      } else {
        result[setting] = value
      }
    }
  }
  if (profile === 'marketry') result.excludedSectorKeys = snapshot.values.excludedSectors.map(([key]) => key)
  else result.excludedSectorNames = snapshot.values.excludedSectors.map(([, name]) => name)
  return result
}

function savedView(profileSettings: Record<string, unknown> | undefined, current: ProfileSnapshot | null, profile: 'marketry' | 'exchange', tiers: MarketValueTierItem[]) {
  const codeDefaults = settingDefaultsFor(true, profile)
  const baseMin = tiers.length ? Math.max(0, tiers.length - 3) : 0
  const baseRange = codeDefaults.tierRange === 'all'
    ? { min: 0, max: null }
    : codeDefaults.tierRange === 'topTwoTiers'
      ? { min: Math.max(0, tiers.length - 2), max: null }
      : codeDefaults.tierRange === 'excludeDefaultTiers'
        ? (() => {
            const included = tiers.map((tier, index) => ({ tier, index })).filter(({ tier }) => !defaultExcludedTierLabels(tiers).has(tier.label))
            return { min: included[0]?.index ?? 0, max: included.at(-1)?.index ?? null }
          })()
        : { min: baseMin, max: null }
  const defaultMin = tiers[baseRange.min]?.thresholdValue ?? 0
  const defaultMax = baseRange.max === null ? null : tiers[baseRange.max + 1]?.thresholdValue ?? null
  const preferences: Record<string, unknown> = {
    'heatmap.tierRangeMinValue': defaultMin,
    'heatmap.tierRangeMaxValue': defaultMax,
    'heatmap.sectorFilterEnabled': codeDefaults.sectorFilterEnabled,
    'heatmap.sectorLevelEnabled': codeDefaults.sectorLevelEnabled,
    'heatmap.selectedMaxDepth': codeDefaults.maxDepth,
    'heatmap.activeDepthMetric': codeDefaults.depthMetric,
    'heatmap.depthMetricEnabled': true,
    'heatmap.depthMetricMinIndex': codeDefaults.depthMetricMinIndex,
    'heatmap.depthMetricMaxIndex': codeDefaults.depthMetricMaxIndex,
    'heatmap.boxSizeMarketCapRatio': codeDefaults.boxSizeMarketCapRatio,
    'heatmap.stockLabelModeIndex': codeDefaults.stockLabelModeIndex,
    'heatmap.stockLabelEnabled': codeDefaults.stockLabelModeIndex !== 0,
    'heatmap.decimalPlacesIndex': codeDefaults.decimalPlacesIndex,
    'heatmap.strongIndustryColor': codeDefaults.strongIndustryColor,
    'heatmap.topPickDepth': codeDefaults.topPickDepth,
    'heatmap.topPickCount': codeDefaults.topPickCount,
    'heatmap.topPickEnabled': codeDefaults.topPickCount !== 0,
  }
  for (const [key, value] of Object.entries(profileSettings ?? {})) {
    if (key === 'excludedSectorKeys' || key === 'excludedSectorNames') continue
    preferences[`heatmap.${key}`] = value
  }
  const exclusionKey = profile === 'marketry' ? 'excludedSectorKeys' : 'excludedSectorNames'
  const savedKeys = new Set(Array.isArray(profileSettings?.[exclusionKey]) ? profileSettings[exclusionKey] as string[] : [])
  const excludedSectors = current?.values.excludedSectors.filter(([key, name]) => savedKeys.has(profile === 'marketry' ? key : name))
    ?? [...savedKeys].map(key => [key, key] as [string, string])
  return { preferences, excludedSectors }
}

export default function AdminDefaultPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = isAdminSession(session)
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const { data: tiers = [] } = useMarketValueTiers()
  const queryClient = useQueryClient()
  const [snapshots, setSnapshots] = useState<Record<'marketry' | 'exchange', ProfileSnapshot | null>>({ marketry: null, exchange: null })
  const [loadVersions, setLoadVersions] = useState({ marketry: 0, exchange: 0 })
  const [loadStates, setLoadStates] = useState<Record<'marketry' | 'exchange', 'idle' | 'loading' | 'ready' | 'error'>>({ marketry: 'idle', exchange: 'idle' })
  const updateSnapshot = useCallback((profile: 'marketry' | 'exchange', snapshot: ProfileSnapshot | null) => {
    setSnapshots(previous => {
      if (JSON.stringify(previous[profile]) === JSON.stringify(snapshot)) return previous
      return { ...previous, [profile]: snapshot }
    })
    const nextState = snapshot ? 'ready' : 'error'
    setLoadStates(previous => previous[profile] === nextState ? previous : { ...previous, [profile]: nextState })
  }, [])
  const defaults = useQuery({
    queryKey: ['admin-default-preferences'],
    queryFn: ({ signal }) => getAdminDefaults(signal),
    enabled: isAdmin,
    retry: false,
  })
  const save = useMutation({
    mutationFn: saveAdminDefaults,
    onSuccess: result => {
      queryClient.setQueryData(['admin-default-preferences'], result)
      queryClient.setQueryData(['default-preferences'], result)
      void appAlert('기본값을 저장했습니다.', { title: '저장 완료' })
    },
    onError: () => void appAlert('기본값을 저장하지 못했습니다.', { title: '저장 실패' }),
  })
  const handleLoad = (profile: 'marketry' | 'exchange') => {
    setSnapshots(previous => ({ ...previous, [profile]: null }))
    setLoadStates(previous => ({ ...previous, [profile]: 'loading' }))
    setLoadVersions(previous => ({ ...previous, [profile]: previous[profile] + 1 }))
  }
  const handleSave = async (profile: 'marketry' | 'exchange') => {
    const snapshot = snapshots[profile]
    if (!snapshot || !defaults.data || save.isPending) return
    if (!await appConfirm(`현재 ${profile === 'marketry' ? 'MARKETRY' : '거래소'} 설정을 기본값으로 저장하시겠습니까?`, { title: '기본값 저장' })) return
    const next: DefaultProfiles = {
      ...defaults.data,
      [profile]: profilePayload(snapshot, profile),
    }
    save.mutate(next)
  }

  return <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
    <NavBar />
    <NavSubBar actions={<NavBarPageActions onRefresh={() => void defaults.refetch()} isRefreshing={defaults.isFetching} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} showRefresh={false} />} />
    <div className="flex min-h-0 flex-1">
      <div className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
        <div data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background text-ui-white">
          {isLoading ? <p role="status" className="m-auto text-base text-ui-text">관리자 권한을 확인하는 중입니다.</p> : !isAdmin ? <p className="m-auto text-center text-base text-ui-text">관리자 전용 페이지입니다.</p> : <>
            <Toolbar><ToolbarModeText page="ADMIN" label="DEFAULT" /></Toolbar>
            <PageMainFrame className="p-0" heading={<div className="mx-auto w-full max-w-4xl"><InfoPageHeading flushBottom title="기본값" summary="MARKETRY와 거래소 기본 설정을 각각 저장합니다." /></div>}>
              {defaults.isError ? <p role="alert" className="m-0 text-sm text-ui-text">기본값을 불러오지 못했습니다.</p> : <article aria-label="기본값" className="mx-auto min-h-full w-full max-w-4xl space-y-5">
                <TelegramImageSettings number="1" title="MARKETRY 모드" profileLabel="MARKETRY" saved={savedView(defaults.data?.marketry, snapshots.marketry, 'marketry', tiers)} current={snapshots.marketry?.values ?? null} loadState={loadStates.marketry} onLoad={() => handleLoad('marketry')} onSave={() => void handleSave('marketry')} />
                <TelegramImageSettings number="2" title="거래소 모드" profileLabel="거래소" saved={savedView(defaults.data?.exchange, snapshots.exchange, 'exchange', tiers)} current={snapshots.exchange?.values ?? null} loadState={loadStates.exchange} onLoad={() => handleLoad('exchange')} onSave={() => void handleSave('exchange')} />
              </article>}
            </PageMainFrame>
          </>}
          <DisclaimerFooter />
        </div>
      </div>
    </div>
    {isAdmin && loadVersions.marketry > 0 && <ProfileReader key={`marketry-${loadVersions.marketry}`} profile="marketry" onSnapshot={updateSnapshot} />}
    {isAdmin && loadVersions.exchange > 0 && <ProfileReader key={`exchange-${loadVersions.exchange}`} profile="exchange" onSnapshot={updateSnapshot} />}
  </div>
}
