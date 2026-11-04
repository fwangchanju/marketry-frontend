import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { InfoSection } from '@/components/InfoDocument'
import type { TelegramImageValues } from '@/hooks/useTelegramImageSetting'
import { ACCENT_PALETTE } from '@/utils/accentPalette'
import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import { ChevronDownIcon } from '@/components/icons/AppIcons'
import { compareKoreanText } from '@/utils/koreanSort'
import marketrySymbol from '@/assets/marketry-symbol.webp'
import krxLogo from '@/assets/krx-logo.png'

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
const ACTION_CLASS = 'flex h-[25px] w-[90px] shrink-0 items-center justify-center gap-1.5 rounded-[4px] border-0 px-1.5 text-[13px]/4 font-semibold text-ui-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-35'
const VALUE_CLASS = 'min-h-[25px] min-w-0 rounded-[4px] border border-transparent bg-[var(--ui-control)] px-2 py-1 text-[13px]/4 font-medium'
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

function labels(values: TelegramImageValues, profileLabel: string) {
  const p = values.preferences
  const depth = (v: unknown) => profileLabel === '거래소' ? '대분류' : DEPTHS[Number(v)] ?? '-'
  const depthRange = (min: unknown, max: unknown) => {
    const first = depth(min)
    const last = depth(max)
    return first === last ? first : `${first} ~ ${last}`
  }
  const enabled = (key: string, text: string) => p[key] === false ? '끄기' : text
  const stock = ['끄기', '종목명', '등락률', '종목명 + 등락률'][Number(p['heatmap.stockLabelModeIndex']) || 3] ?? '-'
  const top = `${depth(p['heatmap.topPickDepth'])} · ${Number(p['heatmap.topPickCount']) || 2}개`
  const lastDepth = profileLabel === '거래소' ? '대분류' : p['heatmap.selectedMaxDepth'] == null ? '소분류' : depth(Number(p['heatmap.selectedMaxDepth']) - 1)
  const metric = p['heatmap.activeDepthMetric']
  const resolvedMetric = Array.isArray(metric) ? (metric[0] === 0 && metric[1] === 1 ? 'simpleAvgChangeRate' : ['weightedAvgChangeRate', 'simpleAvgChangeRate', 'upDownCount', 'marketValue'][metric[0]] ?? 'simpleAvgChangeRate') : metric === 'avgChangeRate' || metric === null ? 'simpleAvgChangeRate' : String(metric)
  return [
    range(p), '', enabled('heatmap.sectorLevelEnabled', lastDepth === '대분류' ? '대분류' : `대분류 ~ ${lastDepth}`),
    enabled('heatmap.depthMetricEnabled', METRICS[resolvedMetric] ?? '-'),
    depthRange(p['heatmap.depthMetricMinIndex'], p['heatmap.depthMetricMaxIndex']),
    `${p['heatmap.boxSizeMarketCapRatio']}%`, enabled('heatmap.stockLabelEnabled', stock),
    ['정수', '소수 첫째자리', '소수 둘째자리'][Number(p['heatmap.decimalPlacesIndex'])] ?? '-',
    String(p['heatmap.strongIndustryColor'] ?? '-'), enabled('heatmap.topPickEnabled', top),
  ]
}

function exclusionNames(value: TelegramImageValues) {
  return value.preferences['heatmap.sectorFilterEnabled'] === false ? [] : value.excludedSectors.map(([, name]) => name).sort(compareKoreanText)
}

function Exclusions({ value }: { value: TelegramImageValues }) {
  const names = exclusionNames(value)
  if (!names.length) return <>없음</>
  return <>{names[0]}{names.length > 1 ? ` 외 ${names.length - 1}개` : ''}</>
}

function SettingValue({ value, index, profileLabel }: { value: TelegramImageValues | null; index: number; profileLabel: string }) {
  if (!value) return <>-</>
  const items = labels(value, profileLabel)
  if (index === 1) return <Exclusions value={value} />
  if (index === 8) return <ColorValue color={items[index]} />
  return <>{items[index]}</>
}

function hasDifferentValue(saved: TelegramImageValues | null, current: TelegramImageValues | null, index: number, profileLabel: string) {
  if (!saved || !current) return false
  if (index === 1) {
    const keys = (value: TelegramImageValues) => value.preferences['heatmap.sectorFilterEnabled'] === false ? [] : value.excludedSectors.map(([key]) => key).sort()
    return JSON.stringify(keys(saved)) !== JSON.stringify(keys(current))
  }
  if (index === 8) return String(saved.preferences['heatmap.strongIndustryColor'] ?? '').toLowerCase() !== String(current.preferences['heatmap.strongIndustryColor'] ?? '').toLowerCase()
  return labels(saved, profileLabel)[index] !== labels(current, profileLabel)[index]
}

export default function TelegramImageSettings({
  number,
  title,
  profileLabel,
  saved,
  current,
  loadState,
  isSaved,
  onLoad,
  onSave,
}: {
  number: string
  title: string
  profileLabel: string
  saved: TelegramImageValues | null
  current: TelegramImageValues | null
  loadState: 'idle' | 'loading' | 'ready' | 'error'
  isSaved: boolean
  onLoad: () => void
  onSave: () => void
}) {
  const [exclusionsOpen, setExclusionsOpen] = useState(false)
  const [exclusionsColumn, setExclusionsColumn] = useState<'saved' | 'current'>('current')
  const [exclusionsRect, setExclusionsRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const savedExclusionsTriggerRef = useRef<HTMLSpanElement>(null)
  const currentExclusionsTriggerRef = useRef<HTMLSpanElement>(null)
  const exclusionsPopupRef = useRef<HTMLDivElement>(null)
  const names = ['시가총액 범위', '업종 제외', '업종 분류 깊이', '업종 지표', '지표 표시 단계', '박스 크기', '박스 내 표기', '등락률 소수점', '강조 색상', '상위 업종 강조']
  const hasMoreExclusions = (value: TelegramImageValues | null) => Boolean(value && value.preferences['heatmap.sectorFilterEnabled'] !== false && value.excludedSectors.length > 0)
  const popupValue = exclusionsColumn === 'saved' ? saved : current
  const popupNames = popupValue ? exclusionNames(popupValue) : []
  useEffect(() => {
    if (!exclusionsOpen) return
    const close = (event: PointerEvent) => {
      const target = event.target as Node
      if (exclusionsPopupRef.current?.contains(target) || savedExclusionsTriggerRef.current?.contains(target) || currentExclusionsTriggerRef.current?.contains(target)) return
      setExclusionsOpen(false)
    }
    const closeOnScroll = () => setExclusionsOpen(false)
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExclusionsOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    document.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [exclusionsOpen])
  const toggleExclusions = (column: 'saved' | 'current') => {
    const triggerRef = column === 'saved' ? savedExclusionsTriggerRef : currentExclusionsTriggerRef
    const rect = triggerRef.current?.getBoundingClientRect()
    if (exclusionsOpen && exclusionsColumn === column) { setExclusionsOpen(false); return }
    if (rect) setExclusionsRect({ top: rect.top, left: rect.left, width: rect.width })
    setExclusionsColumn(column)
    setExclusionsOpen(true)
  }

  return <InfoSection number={number} title={title}>
    <div className="mx-auto w-full max-w-[674px] overflow-hidden border border-ui-border bg-ui-panel p-4 text-sm">
      <div className="space-y-3">
        <section aria-label={profileLabel} className="rounded-md border border-ui-border bg-ui-background/50 px-3 py-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-ui-white"><img src={profileLabel === '거래소' ? krxLogo : marketrySymbol} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" style={profileLabel === '거래소' ? { clipPath: 'circle(44.7% at 53% 50.4%)' } : undefined} />{profileLabel}</h3>
        </section>
        {[0, 2, 5, 8].map((start, groupIndex) => {
          const end = [2, 5, 8, names.length][groupIndex]
          const tab = TABS[start]
          return <section key={tab.label} aria-label={tab.label} className="rounded-md border border-ui-border bg-ui-background/50 p-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ui-white"><SettingsSectionIcon icon={tab.icon} className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{tab.label}<span className="h-px flex-1 bg-ui-border" /></h3>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-x-2 text-center text-xs font-semibold text-ui-muted"><span>항목</span><span>설정값</span><span>현재값</span></div>
            {names.slice(start, end).map((name, offset) => {
              const index = start + offset
              const isDifferent = hasDifferentValue(saved, current, index, profileLabel)
              return <div key={name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-2 border-t border-ui-border/50 py-2">
                <span className={LABEL_CLASS}>{name}</span>
                <span ref={index === 1 && hasMoreExclusions(saved) ? savedExclusionsTriggerRef : undefined} className={`${VALUE_CLASS} flex items-center justify-between gap-1 text-ui-white`}>
                  <span className="min-w-0"><SettingValue value={saved} index={index} profileLabel={profileLabel} /></span>
                  {index === 1 && hasMoreExclusions(saved) && <button type="button" aria-haspopup="dialog" aria-label="설정값 제외 업종 목록 열기" aria-expanded={exclusionsOpen && exclusionsColumn === 'saved'} onClick={() => toggleExclusions('saved')} className="inline-flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ui-muted hover:text-ui-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><ChevronDownIcon aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${exclusionsOpen && exclusionsColumn === 'saved' ? 'rotate-180' : ''}`} /></button>}
                </span>
                <span ref={index === 1 && hasMoreExclusions(current) ? currentExclusionsTriggerRef : undefined} className={`${VALUE_CLASS} flex items-center justify-between gap-1 ${isDifferent ? 'text-brand' : 'text-ui-white'}`}>
                  <span className="min-w-0">{isDifferent && <span className="sr-only">설정값과 다름: </span>}<SettingValue value={current} index={index} profileLabel={profileLabel} /></span>
                  {index === 1 && hasMoreExclusions(current) && <button type="button" aria-haspopup="dialog" aria-label="현재값 제외 업종 목록 열기" aria-expanded={exclusionsOpen && exclusionsColumn === 'current'} onClick={() => toggleExclusions('current')} className="inline-flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ui-muted hover:text-ui-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><ChevronDownIcon aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${exclusionsOpen && exclusionsColumn === 'current' ? 'rotate-180' : ''}`} /></button>}
                </span>
              </div>
            })}
          </section>
        })}
      </div>
      {exclusionsOpen && exclusionsRect && createPortal(
        <div ref={exclusionsPopupRef} role="dialog" aria-label={`${exclusionsColumn === 'saved' ? '설정값' : '현재값'} 제외 업종 목록`}
          style={{ position: 'fixed', top: exclusionsRect.top, left: exclusionsRect.left, width: exclusionsRect.width }}
          className={`${VALUE_CLASS} z-50 flex items-start justify-between gap-1 text-ui-white shadow-xl`}>
          <span className="space-y-2">{popupNames.map(name => <div key={name}>{name}</div>)}</span>
          <button type="button" aria-label="업종 제외 목록 접기" onClick={() => setExclusionsOpen(false)} className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ui-muted hover:text-ui-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            <ChevronDownIcon aria-hidden="true" className="h-3.5 w-3.5 rotate-180" />
          </button>
        </div>, document.body,
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ui-border pt-3">
        <button type="button" disabled={loadState === 'loading'} onClick={onLoad} className={`${ACTION_CLASS} bg-ui-control font-medium hover:bg-ui-control-hover focus-visible:outline-brand`}>{loadState === 'loading' ? '불러오는 중' : '불러오기'}</button>
        <button type="button" disabled={loadState !== 'ready'} onClick={onSave} className={`${ACTION_CLASS} bg-brand-surface hover:bg-brand-surface-hover focus-visible:outline-brand`}>저장</button>
        {loadState === 'ready' && <span role="status" className="text-xs text-ui-muted">{isSaved ? '저장 완료' : '저장 전'}</span>}
      </div>
    </div>
  </InfoSection>
}
