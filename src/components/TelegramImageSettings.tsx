import { useCallback, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTelegramImageLegacySetting } from '@/api/adminTelegram'
import { InfoSection } from '@/components/InfoDocument'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useCustomPreferences } from '@/hooks/useCustomPreferences'
import { useMarketValueTiers } from '@/hooks/useMarketValueTiers'
import type { TelegramImageValues } from '@/hooks/useTelegramImageSetting'
import { appAlert } from '@/utils/appDialogBus'
import { ACCENT_PALETTE } from '@/utils/accentPalette'
import { useSession } from '@/hooks/useSession'
import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import { ChevronDownIcon } from '@/components/icons/AppIcons'
import { legacyTelegramImageValues } from '@/utils/telegramImageSetting'
import { compareKoreanText } from '@/utils/koreanSort'
import marketrySymbol from '@/assets/marketry-symbol.png'

const DEPTHS = ['대분류', '중분류', '소분류']
const TABS: { label: string; icon: SettingsSectionIconName }[] = [
  ...Array.from({ length: 2 }, () => ({ label: '종목 구성', icon: 'composition' as const })),
  ...Array.from({ length: 3 }, () => ({ label: '업종 분류', icon: 'industry' as const })),
  ...Array.from({ length: 3 }, () => ({ label: '종목 박스', icon: 'stock-display' as const })),
  ...Array.from({ length: 2 }, () => ({ label: '색상', icon: 'colors' as const })),
]
const METRICS: Record<string, string> = {
  weightedAvgChangeRate: '시총 가중 등락률', simpleAvgChangeRate: '동일 가중 등락률',
  upDownCount: '상승/하락 종목 수', marketValue: '업종 시가총액 합계',
}
// 배너 페이지 본문 동작 버튼과 같은 크기·여백·포커스 규격.
const ACTION_CLASS = 'flex h-[25px] w-[90px] shrink-0 items-center justify-center gap-1.5 rounded-[4px] border-0 px-1.5 text-[13px]/4 font-semibold text-ui-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35'
const VALUE_CLASS = 'min-h-[25px] min-w-0 rounded-[4px] border border-transparent bg-[var(--ui-control)] px-2 py-1 text-[13px]/4 font-medium text-ui-white'
const LABEL_CLASS = 'flex min-h-[25px] min-w-0 items-center gap-1 px-1 text-[13px]/4 font-medium text-ui-white'

function won(value: number) {
  if (value >= 1e12) return `${(value / 1e12).toLocaleString('ko-KR')}조`
  return `${(value / 1e8).toLocaleString('ko-KR')}억`
}

function ColorValue({ color }: { color: string }) {
  const label = ACCENT_PALETTE.find(option => option.value.toLowerCase() === color.toLowerCase())?.label ?? color
  return <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3.5 rounded-full border border-ui-white/35" style={{ backgroundColor: color }} />{label}</span>
}

function range(values: Record<string, unknown>) {
  const min = Number(values['heatmap.tierRangeMinValue'] ?? 0)
  const max = values['heatmap.tierRangeMaxValue'] as number | null
  if (!min && max == null) return '전체 시가총액'
  if (!min) return `${won(max!)} 미만`
  if (max == null) return `${won(min)} 이상`
  return `${won(max)} 미만 ~ ${won(min)} 이상`
}

function labels(values: TelegramImageValues) {
  const p = values.preferences
  const depth = (v: unknown) => DEPTHS[Number(v)] ?? '-'
  const enabled = (key: string, text: string) => p[key] === false ? '끄기' : text
  const stock = ['끄기', '종목명', '등락률', '종목명 + 등락률'][Number(p['heatmap.stockLabelModeIndex']) || 3] ?? '-'
  const top = `${depth(p['heatmap.topPickDepth'])} · ${Number(p['heatmap.topPickCount']) || 2}개`
  const lastDepth = p['heatmap.selectedMaxDepth'] == null ? '소분류' : depth(Number(p['heatmap.selectedMaxDepth']) - 1)
  const metric = p['heatmap.activeDepthMetric']
  const resolvedMetric = Array.isArray(metric) ? (metric[0] === 0 && metric[1] === 1 ? 'simpleAvgChangeRate' : ['weightedAvgChangeRate', 'simpleAvgChangeRate', 'upDownCount', 'marketValue'][metric[0]] ?? 'simpleAvgChangeRate') : metric === 'avgChangeRate' || metric === null ? 'simpleAvgChangeRate' : String(metric)
  return [
    range(p), '', enabled('heatmap.sectorLevelEnabled', `대분류 ~ ${lastDepth}`),
    enabled('heatmap.depthMetricEnabled', METRICS[resolvedMetric] ?? '-'),
    `${depth(p['heatmap.depthMetricMinIndex'])} ~ ${depth(p['heatmap.depthMetricMaxIndex'])}`,
    `${p['heatmap.boxSizeMarketCapRatio']}%`, enabled('heatmap.stockLabelEnabled', stock),
    ['정수', '소수 첫째자리', '소수 둘째자리'][Number(p['heatmap.decimalPlacesIndex'])] ?? '-',
    String(p['heatmap.strongIndustryColor'] ?? '-'), enabled('heatmap.topPickEnabled', top),
  ]
}

function Exclusions({ value, open }: { value: TelegramImageValues; open: boolean }) {
  const names = value.preferences['heatmap.sectorFilterEnabled'] === false ? [] : value.excludedSectors.map(([, name]) => name).sort(compareKoreanText)
  if (!names.length) return <>없음</>
  return <div><div>{names[0]}{!open && names.length > 1 ? ` 외 ${names.length - 1}개` : ''}</div>{open && names.slice(1).map((name, i) => <div key={`${name}-${i}`}>{name}</div>)}</div>
}

function SettingValue({ value, index, open, empty }: { value: TelegramImageValues | null | undefined; index: number; open: boolean; empty: string }) {
  if (!value) return <>{empty}</>
  const items = labels(value)
  if (index === 1) return <Exclusions value={value} open={open} />
  if (index === 8) return <ColorValue color={items[index]} />
  return <>{items[index]}</>
}

function hasDifferentValue(saved: TelegramImageValues | null, current: TelegramImageValues | null, index: number) {
  if (!saved || !current) return false
  if (index === 1) {
    const excludedKeys = (value: TelegramImageValues) => value.preferences['heatmap.sectorFilterEnabled'] === false
      ? []
      : value.excludedSectors.map(([key]) => key).sort()
    return JSON.stringify(excludedKeys(saved)) !== JSON.stringify(excludedKeys(current))
  }
  if (index === 8) {
    return String(saved.preferences['heatmap.strongIndustryColor'] ?? '').toLowerCase()
      !== String(current.preferences['heatmap.strongIndustryColor'] ?? '').toLowerCase()
  }
  return labels(saved)[index] !== labels(current)[index]
}

function CurrentSettingsLoader({ onLoad, onError }: { onLoad: (values: TelegramImageValues) => void; onError: () => void }) {
  const { telegramImageValues, isMarketValueTierRangeReady, isLoading, isError, isHeatmapSuccess, isRefetchingHeatmap } = useGlobalSettings({ readOnlyTelegramSnapshot: true })
  const { isLoaded, isError: isPreferenceError } = useCustomPreferences()
  const { isError: isTierError } = useMarketValueTiers()

  useEffect(() => {
    if (isError || isPreferenceError || isTierError) {
      onError()
    } else if (isLoaded && isMarketValueTierRangeReady && isHeatmapSuccess && !isLoading && !isRefetchingHeatmap) {
      onLoad(telegramImageValues)
    }
  }, [isError, isPreferenceError, isTierError, isHeatmapSuccess, isLoaded, isLoading, isMarketValueTierRangeReady, isRefetchingHeatmap, onError, onLoad, telegramImageValues])

  return null
}

export default function TelegramImageSettings() {
  const { data: session } = useSession()
  return <TelegramImageSettingsForUser key={session?.userId ?? 'anonymous'} userId={session?.userId ?? null} />
}

function TelegramImageSettingsForUser({ userId }: { userId: number | null }) {
  const { commitPreferences } = useCustomPreferences()
  const [draft, setDraft] = useState<TelegramImageValues | null>(null)
  const [loadingCurrent, setLoadingCurrent] = useState(false)
  const [exclusionsOpen, setExclusionsOpen] = useState(false)
  const legacy = useQuery({
    queryKey: ['admin-telegram-image-legacy-setting', userId],
    queryFn: ({ signal }) => getTelegramImageLegacySetting(signal),
    enabled: userId !== null,
    staleTime: Infinity,
    retry: false,
  })
  const [saving, setSaving] = useState(false)
  const handleLoaded = useCallback((values: TelegramImageValues) => {
    setDraft(values)
    setLoadingCurrent(false)
  }, [])
  const handleLoadError = useCallback(() => {
    setLoadingCurrent(false)
    void appAlert('현재 설정을 불러오지 못했습니다.', { title: '불러오기 실패' })
  }, [])
  const refresh = async () => {
    // 캐시된 지도는 바로 표시하지 않고 버튼을 누른 시점에 다시 확인한다.
    setLoadingCurrent(true)
  }
  const saved = legacy.data ? legacyTelegramImageValues(legacy.data) : null
  const saveDraft = async () => {
    if (!draft) return
    setSaving(true)
    const scoped = new Set(['heatmap.sectorFilterEnabled', 'heatmap.sectorLevelEnabled', 'heatmap.selectedMaxDepth', 'heatmap.activeDepthMetric', 'heatmap.depthMetricEnabled', 'heatmap.depthMetricMinIndex', 'heatmap.depthMetricMaxIndex', 'heatmap.topPickDepth', 'heatmap.topPickCount', 'heatmap.topPickEnabled'])
    const entries = Object.entries(draft.preferences).map(([key, value]) => [
      scoped.has(key) ? `heatmap.profile.marketry.${key.slice('heatmap.'.length)}` : key,
      value,
    ] as [string, unknown])
    entries.push(['heatmap.profile.marketry.excludedSectorKeys', draft.excludedSectors.map(([key]) => key)])
    try {
      await commitPreferences(entries)
      setDraft(null)
      await legacy.refetch()
    } catch {
      void appAlert('MARKETRY 설정을 저장하지 못했습니다.', { title: '저장 실패' })
    } finally {
      setSaving(false)
    }
  }
  const hasMoreExclusions = [saved, draft].some(value => value && value.preferences['heatmap.sectorFilterEnabled'] !== false && value.excludedSectors.length > 1)
  const names = ['시가총액 범위', '업종 제외', '업종 분류 깊이', '업종 지표', '지표 표시 단계', '박스 크기', '박스 내 표기', '등락률 소수점', '강조 색상', '상위 업종 강조']
  return <InfoSection number="1" title="발송 이미지 설정">
    <div className="mx-auto w-full max-w-[674px] overflow-hidden border border-ui-border bg-ui-panel p-4 text-sm">
      {loadingCurrent && <CurrentSettingsLoader onLoad={handleLoaded} onError={handleLoadError} />}
      {legacy.isError ? <p role="alert">설정을 불러오지 못했습니다.</p> : <>
        <div className="space-y-3">
        <section aria-label="기본" className="rounded-md border border-ui-border bg-ui-background/50 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ui-white"><img src={marketrySymbol} alt="" aria-hidden="true" className="h-4 w-4 shrink-0 object-contain" />기본 <span className="h-px flex-1 bg-ui-border" /></h3>
        {[
          { tab: '설정창 밖', name: '분류 기준', value: 'MARKETRY' },
          { tab: '기본', name: '등락률 기준', value: '종가 → 단독 자동' },
        ].map(item => <div key={item.name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-2 border-t border-ui-border/50 py-2 first:border-0">
          <span className={LABEL_CLASS}>{item.name}</span><span className={VALUE_CLASS}>{item.value}</span><span className={VALUE_CLASS}>고정</span>
        </div>)}
        </section>
        {[0, 2, 5, 8].map((start, groupIndex) => {
          const end = [2, 5, 8, names.length][groupIndex]
          const tab = TABS[start]
          return <section key={tab.label} aria-label={tab.label} className="rounded-md border border-ui-border bg-ui-background/50 p-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ui-white"><SettingsSectionIcon icon={tab.icon} className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{tab.label}<span className="h-px flex-1 bg-ui-border" /></h3>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-x-2 text-center text-xs font-semibold text-ui-muted"><span>항목</span><span>설정값</span><span>현재값</span></div>
          {names.slice(start, end).map((name, offset) => { const i = start + offset; const isDifferent = hasDifferentValue(saved, draft, i); return <div key={name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-2 border-t border-ui-border/50 py-2">
            <span className={LABEL_CLASS}>{name}</span>
            <span className={`${VALUE_CLASS} flex items-start justify-between gap-1`}>
              <span><SettingValue value={saved} index={i} open={exclusionsOpen} empty="불러오는 중" /></span>
              {i === 1 && hasMoreExclusions && <button type="button" aria-label={exclusionsOpen ? '업종 제외 접기' : '업종 제외 펼치기'} aria-expanded={exclusionsOpen} onClick={() => setExclusionsOpen(!exclusionsOpen)} className="inline-flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ui-muted hover:text-ui-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><ChevronDownIcon aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${exclusionsOpen ? 'rotate-180' : ''}`} /></button>}
            </span>
            <span className={`${VALUE_CLASS} ${isDifferent ? 'text-brand' : 'text-ui-white'}`}><SettingValue value={draft} index={i} open={exclusionsOpen} empty="-" /></span>
          </div>})}
          </section>
        })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ui-border pt-3">
          <button type="button" disabled={loadingCurrent || legacy.isLoading} onClick={() => void refresh()} className={`${ACTION_CLASS} bg-ui-control font-medium hover:bg-ui-control-hover focus-visible:outline-brand`}>{loadingCurrent ? '불러오는 중' : '불러오기'}</button>
          <button type="button" disabled={!draft || loadingCurrent || saving || legacy.isLoading} onClick={() => void saveDraft()} className={`${ACTION_CLASS} bg-brand-surface hover:bg-brand-surface-hover focus-visible:outline-brand`}>{saving ? '저장 중' : '저장'}</button>
          {draft && <span role="status" className="text-xs text-ui-muted">저장 전</span>}
        </div>
      </>}
    </div>
  </InfoSection>
}
