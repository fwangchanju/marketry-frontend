import { useCallback, useEffect, useRef, useState } from 'react'
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
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import ScreenshotModal from '@/components/ScreenshotModal'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useHeatmap } from '@/hooks/useHeatmap'
import { useMarketValueTiers } from '@/hooks/useMarketValueTiers'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useSession } from '@/hooks/useSession'
import type { TelegramImageValues } from '@/hooks/useTelegramImageSetting'
import type { DefaultProfiles } from '@/hooks/useDefaultPreferences'
import { isAdminSession } from '@/utils/adminAccess'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { settingDefaultsFor } from '@/utils/settingDefaults'
import { japanMapDisplayValues, japanMapManagedDefaults, japanMapPublishPayload, japanMapSavedValues, type JapanMapPreferences } from '@/utils/japanMapSettings'
import { useCustomPreferences } from '@/hooks/useCustomPreferences'
import { defaultExcludedTierLabels } from '@/utils/marketValueTier'
import { screenshotElementToClipboard, copyDataUrlToClipboard } from '@/utils/screenshotToClipboard'
import type { HeatmapSectorNode, MarketValueTierItem } from '@/types/api'

type DefaultProfile = 'marketry' | 'exchange' | 'japan'

type ProfileSnapshot = {
  values: TelegramImageValues
  tierRangeMinIndex: number
  tierRangeMaxIndex: number
  avgChangeRateUseSimple: boolean
  colorCustomOn: boolean
}

function marketrySectorNames(nodes: HeatmapSectorNode[], ancestors: string[] = [], names = new Map<string, string>()) {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName].join(' > ')
    if (node.stableKey) names.set(node.stableKey, path)
    marketrySectorNames(node.children, [...ancestors, node.sectorName], names)
  }
  return names
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
  result.strongIndustryColor = settingDefaultsFor(true, profile).strongIndustryColor
  return result
}

function savedView(profileSettings: Record<string, unknown> | undefined, current: ProfileSnapshot | null, profile: 'marketry' | 'exchange', tiers: MarketValueTierItem[], sectorNames: Map<string, string>) {
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
    if (key === 'excludedSectorKeys' || key === 'excludedSectorNames' || key === 'strongIndustryColor') continue
    preferences[`heatmap.${key}`] = value
  }
  const exclusionKey = profile === 'marketry' ? 'excludedSectorKeys' : 'excludedSectorNames'
  const savedKeys = new Set(Array.isArray(profileSettings?.[exclusionKey]) ? profileSettings[exclusionKey] as string[] : [])
  const currentNames = new Map(current?.values.excludedSectors ?? [])
  const excludedSectors = [...savedKeys].map(key => [
    key,
    profile === 'marketry' ? currentNames.get(key) ?? sectorNames.get(key) ?? '업종명 확인 중' : key,
  ] as [string, string])
  return { preferences, excludedSectors }
}

export default function AdminDefaultPage() {
  const { data: session, isLoading } = useSession()
  const isAdmin = isAdminSession(session)
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide } = useSettingsPanelSide()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLDivElement>(null)
  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !screenshotRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (screenshotRef.current) await screenshotElementToClipboard(screenshotRef.current)
      setCopyStatus('copied')
    } catch { setCopyStatus('error') }
    finally { setTimeout(() => setCopyStatus('idle'), 2000) }
  }
  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const { data: tiers = [] } = useMarketValueTiers()
  const queryClient = useQueryClient()
  const [snapshots, setSnapshots] = useState<Record<'marketry' | 'exchange', ProfileSnapshot | null>>({ marketry: null, exchange: null })
  const [loadVersions, setLoadVersions] = useState({ marketry: 0, exchange: 0 })
  const [loadStates, setLoadStates] = useState<Record<'marketry' | 'exchange', 'idle' | 'loading' | 'ready' | 'error'>>({ marketry: 'idle', exchange: 'idle' })
  const [savedSnapshots, setSavedSnapshots] = useState<Record<DefaultProfile, string | null>>({ marketry: null, exchange: null, japan: null })
  // 일본 지도는 이 계정에 저장된 일본 지도 설정을 불러와 기본값으로 저장한다(국내와 같은 불러오기 → 저장 순서).
  const [japanSnapshot, setJapanSnapshot] = useState<JapanMapPreferences | null>(null)
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
  const marketryExcludedKeys = defaults.data?.marketry?.excludedSectorKeys
  const hasMarketryExclusions = Array.isArray(marketryExcludedKeys) && marketryExcludedKeys.length > 0
  const marketryMap = useHeatmap('ALL_STOCK', 'MARKETRY', false, { enabled: isAdmin && hasMarketryExclusions })
  const marketryNames = marketrySectorNames(marketryMap.data?.items ?? [])
  const save = useMutation({
    mutationFn: ({ value }: { value: DefaultProfiles; profile: DefaultProfile; snapshot: string }) => saveAdminDefaults(value),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(['admin-default-preferences'], result)
      queryClient.setQueryData(['default-preferences'], result)
      setSavedSnapshots(previous => ({ ...previous, [variables.profile]: variables.snapshot }))
      void appAlert('기본값을 저장했습니다.', { title: '저장 완료' })
    },
    onError: () => void appAlert('기본값을 저장하지 못했습니다.', { title: '저장 실패' }),
  })
  const handleLoad = (profile: 'marketry' | 'exchange') => {
    setSavedSnapshots(previous => ({ ...previous, [profile]: null }))
    setSnapshots(previous => ({ ...previous, [profile]: null }))
    setLoadStates(previous => ({ ...previous, [profile]: 'loading' }))
    setLoadVersions(previous => ({ ...previous, [profile]: previous[profile] + 1 }))
  }
  const japanManaged = japanMapManagedDefaults(defaults.data)
  const { data: ownPreferences } = useCustomPreferences()
  const handleLoadJapan = () => {
    setSavedSnapshots(previous => ({ ...previous, japan: null }))
    setJapanSnapshot({ ...japanManaged, ...japanMapSavedValues(ownPreferences) })
  }
  const handleSaveJapan = async () => {
    if (!japanSnapshot || !defaults.data || save.isPending) return
    if (!await appConfirm('[일본 지도] 설정을 기본값으로 저장하시겠습니까?', { title: '기본값 저장' })) return
    save.mutate({ value: { ...defaults.data, japan: japanMapPublishPayload(japanSnapshot) }, profile: 'japan', snapshot: JSON.stringify(japanSnapshot) })
  }
  const handleSave = async (profile: 'marketry' | 'exchange') => {
    const snapshot = snapshots[profile]
    if (!snapshot || !defaults.data || save.isPending) return
    if (!await appConfirm(`[${profile === 'marketry' ? 'MARKETRY' : '거래소'}] 설정을 기본값으로 저장하시겠습니까?`, { title: '기본값 저장' })) return
    const next: DefaultProfiles = {
      ...defaults.data,
      [profile]: profilePayload(snapshot, profile),
    }
    save.mutate({ value: next, profile, snapshot: JSON.stringify(snapshot) })
  }

  return <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
    <NavBar />
    <NavSubBar actions={<NavBarPageActions onRefresh={() => void defaults.refetch()} isRefreshing={defaults.isFetching} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} showRefresh={false} onToggleSettings={() => setIsSettingsOpen(previous => !previous)} isSettingsOpen={isSettingsOpen} onOpenShare={() => setIsShareOpen(true)} isScreenshotOpen={isShareOpen} />} />
    <div className="flex min-h-0 flex-1">
      <div className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
        <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background text-ui-white">
          {isLoading ? <p role="status" className="m-auto text-base text-ui-text">관리자 권한을 확인하는 중입니다.</p> : !isAdmin ? <p className="m-auto text-center text-base text-ui-text">관리자 전용 페이지입니다.</p> : <>
            <Toolbar><ToolbarModeText page="ADMIN" label="DEFAULT" /></Toolbar>
            <PageMainFrame className="p-0" heading={<div className="mx-auto w-full max-w-4xl"><InfoPageHeading flushBottom title="기본값" summary="MARKETRY, 거래소, 일본 지도 기본 설정을 각각 저장합니다." /></div>}>
              {defaults.isError ? <p role="alert" className="m-0 text-sm text-ui-text">기본값을 불러오지 못했습니다.</p> : <article aria-label="기본값" className="mx-auto min-h-full w-full max-w-4xl space-y-5">
                <TelegramImageSettings number="1" title="MARKETRY 모드" profileLabel="MARKETRY" saved={savedView(defaults.data?.marketry, snapshots.marketry, 'marketry', tiers, marketryNames)} current={snapshots.marketry?.values ?? null} loadState={loadStates.marketry} isSaved={savedSnapshots.marketry !== null && savedSnapshots.marketry === JSON.stringify(snapshots.marketry)} onLoad={() => handleLoad('marketry')} onSave={() => void handleSave('marketry')} />
                <TelegramImageSettings number="2" title="거래소 모드" profileLabel="거래소" saved={savedView(defaults.data?.exchange, snapshots.exchange, 'exchange', tiers, marketryNames)} current={snapshots.exchange?.values ?? null} loadState={loadStates.exchange} isSaved={savedSnapshots.exchange !== null && savedSnapshots.exchange === JSON.stringify(snapshots.exchange)} onLoad={() => handleLoad('exchange')} onSave={() => void handleSave('exchange')} />
                <TelegramImageSettings number="3" title="일본 지도" profileLabel="일본" saved={japanMapDisplayValues(japanManaged)} current={japanSnapshot ? japanMapDisplayValues(japanSnapshot) : null} loadState={japanSnapshot ? 'ready' : 'idle'} isSaved={savedSnapshots.japan !== null && savedSnapshots.japan === JSON.stringify(japanSnapshot)} onLoad={handleLoadJapan} onSave={() => void handleSaveJapan()} />
              </article>}
            </PageMainFrame>
          </>}
          <DisclaimerFooter />
        </div>
        {isAdmin && <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel pageLabel="Default" showPreferenceActions={false} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isSettingsOnLeft} onToggleSide={toggleSettingsSide} sectionOrder={['adminManage']} sectionLabelOverrides={{ adminManage: '기본값' }}>
            <SettingsPanelGroup section="adminManage"><div className="settings-plain-content"><div className="settings-ops-item flex h-[180px] items-center justify-center text-center text-sm text-ui-muted">기본값은 메인 영역에서 설정합니다.</div></div></SettingsPanelGroup>
          </SettingsPanel>
        </div>}
      </div>
    </div>
    {isAdmin && loadVersions.marketry > 0 && <ProfileReader key={`marketry-${loadVersions.marketry}`} profile="marketry" onSnapshot={updateSnapshot} />}
    {isAdmin && loadVersions.exchange > 0 && <ProfileReader key={`exchange-${loadVersions.exchange}`} profile="exchange" onSnapshot={updateSnapshot} />}
    {isShareOpen && <ScreenshotModal onClose={() => setIsShareOpen(false)} onCopy={handleCopy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
  </div>
}
