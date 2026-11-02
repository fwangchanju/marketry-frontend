import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getTelegramImageSetting, saveTelegramImageSetting } from '@/api/adminTelegram'
import { InfoSection } from '@/components/InfoDocument'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useCustomPreferences } from '@/hooks/useCustomPreferences'
import type { TelegramImageValues } from '@/hooks/useTelegramImageSetting'
import { appAlert } from '@/utils/appDialogBus'
import { ACCENT_PALETTE } from '@/utils/accentPalette'

const DEPTHS = ['대분류', '중분류', '소분류']
const METRICS: Record<string, string> = {
  weightedAvgChangeRate: '시총 가중 등락률', simpleAvgChangeRate: '동일 가중 등락률',
  upDownCount: '상승/하락 종목 수', marketValue: '업종 시가총액 합계',
}

function won(value: number) {
  if (value >= 1e12) return `${(value / 1e12).toLocaleString('ko-KR')}조`
  return `${(value / 1e8).toLocaleString('ko-KR')}억`
}

function ColorValue({ color }: { color: string }) {
  const label = ACCENT_PALETTE.find(option => option.value.toLowerCase() === color.toLowerCase())?.label ?? color
  return <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: color }} />{label}</span>
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
  const stock = ['끄기', '종목명', '등락률', '종목명 · 등락률'][Number(p['heatmap.stockLabelModeIndex'])] ?? '-'
  const top = `${depth(p['heatmap.topPickDepth'])} · ${p['heatmap.topPickCount']}개`
  const lastDepth = p['heatmap.selectedMaxDepth'] == null ? '소분류' : depth(Number(p['heatmap.selectedMaxDepth']) - 1)
  return [
    range(p), '', enabled('heatmap.sectorLevelEnabled', `대분류 ~ ${lastDepth}`),
    enabled('heatmap.depthMetricEnabled', METRICS[String(p['heatmap.activeDepthMetric'])] ?? '-'),
    `${depth(p['heatmap.depthMetricMinIndex'])} ~ ${depth(p['heatmap.depthMetricMaxIndex'])}`,
    `${p['heatmap.boxSizeMarketCapRatio']}%`, enabled('heatmap.stockLabelEnabled', stock),
    ['0%', '0.0%', '0.00%'][Number(p['heatmap.decimalPlacesIndex'])] ?? '-',
    String(p['heatmap.strongIndustryColor'] ?? '-'), enabled('heatmap.topPickEnabled', top),
  ]
}

function Exclusions({ value }: { value: TelegramImageValues }) {
  const [open, setOpen] = useState(false)
  const names = value.preferences['heatmap.sectorFilterEnabled'] === false ? [] : value.excludedSectors.map(([, name]) => name)
  if (!names.length) return <>없음</>
  return <div><div>{names[0]}</div>{open && names.slice(1).map((name, i) => <div key={`${name}-${i}`}>{name}</div>)}
    {names.length > 1 && <button type="button" className="mt-1 rounded bg-ui-control px-2 py-1 text-xs text-ui-white" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '접기' : `외 ${names.length - 1}개 펼치기`}</button>}
  </div>
}

export default function TelegramImageSettings() {
  const queryClient = useQueryClient()
  const { telegramImageValues: current, isMarketValueTierRangeReady, isLoading, isError } = useGlobalSettings({ readOnlyTelegramSnapshot: true })
  const { isLoaded } = useCustomPreferences()
  const query = useQuery({ queryKey: ['admin-telegram-image-setting'], queryFn: ({ signal }) => getTelegramImageSetting(signal), retry: false })
  const save = useMutation({
    mutationFn: saveTelegramImageSetting,
    onSuccess: result => queryClient.setQueryData(['admin-telegram-image-setting'], result),
    onError: () => { void appAlert('발송 이미지 설정을 저장하지 못했습니다.', { title: '저장 실패' }) },
  })
  const saved = query.data?.values
  const currentLabels = labels(current)
  const savedLabels = saved ? labels(saved) : null
  const names = ['시가총액 범위', '업종 제외', '업종 분류 깊이', '업종 지표', '지표 표시 단계', '박스 크기', '박스 내 표기', '등락률 소수점', '강조 색상', '상위 업종 강조']
  return <InfoSection number="2" title="발송 이미지 설정">
    <div className="mx-auto w-full max-w-3xl space-y-3 text-sm">
      <p className="m-0 text-ui-muted">고정 기준 · 분류: MARKETRY · 등락률 색상: 기본 색상 · 등락률 기준: 종가·별도 자동</p>
      {query.isError || isError ? <p role="alert">설정을 불러오지 못했습니다.</p> : <>
        <p className="m-0 text-right text-xs text-ui-muted">{query.data?.updatedAt ? `${query.data.updatedAt.replace('T', ' ').slice(0, 16)}에 저장` : '저장 전 · 기존 관리자 설정 사용'}</p>
        <div className="grid grid-cols-[minmax(5rem,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-2 px-3 text-ui-muted"><span>항목</span><span>발송값</span><span>현재값</span></div>
        {names.map((name, i) => <div key={name} className="grid grid-cols-[minmax(5rem,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] gap-2 break-words rounded bg-ui-panel px-3 py-2">
          <span className="text-ui-muted">{name}</span>
          <span>{!saved ? '기존 관리자 설정' : i === 1 ? <Exclusions value={saved} /> : i === 8 ? <ColorValue color={savedLabels?.[i] ?? ''} /> : savedLabels?.[i]}</span>
          <span>{i === 1 ? <Exclusions value={current} /> : i === 8 ? <ColorValue color={currentLabels[i]} /> : currentLabels[i]}</span>
        </div>)}
        <button type="button" disabled={!isLoaded || !isMarketValueTierRangeReady || isLoading || query.isPending || save.isPending || query.isError} onClick={() => save.mutate(current)} className="w-full rounded bg-brand px-3 py-2 text-ui-white disabled:opacity-50">현재값 → 발송값</button>
      </>}
    </div>
  </InfoSection>
}
