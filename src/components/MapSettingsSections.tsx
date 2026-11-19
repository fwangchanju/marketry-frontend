import type { ReactNode } from 'react'
import { SettingsSectorChangeSection, SettingsStockChangeSection, SettingsStockChartSection, SettingsStockMoveSection, SettingsStockPopupSection } from '@/components/SettingsPanel'
import type { StockChartTrigger } from '@/hooks/useStockChart'
import { appAlert } from '@/utils/appDialogBus'

type ChangeFilter = 'all' | 'rising' | 'falling'

// 종목 구성 탭의 3·4번 — 종목 등락 방향과 업종 등락 방향. 값은 저장하지 않는다(모드마다 이 탭의 메모리에만 둔다).
// 한국·일본·미국 지도가 같이 쓰고, 지도마다 다른 점(바꿀 때 지도를 처음으로 되돌릴지, 데이터 한계 표시)은 props로 받는다.
export function MapChangeFilterSections({
  stockChangeFilter,
  onChangeStockChangeFilter,
  sectorChangeFilter,
  onChangeSectorChangeFilter,
  sectorChangeDepth,
  onChangeSectorChangeDepth,
  maxSelectableDepth,
  noDataLimited,
}: {
  stockChangeFilter: ChangeFilter
  onChangeStockChangeFilter: (value: ChangeFilter) => void
  sectorChangeFilter: ChangeFilter
  onChangeSectorChangeFilter: (value: ChangeFilter) => void
  sectorChangeDepth: number
  onChangeSectorChangeDepth: (depth: number) => void
  maxSelectableDepth: number
  noDataLimited: boolean
}): ReactNode {
  return (
    <div className="settings-section-plain-items">
      <SettingsStockChangeSection value={stockChangeFilter} onChange={onChangeStockChangeFilter} />
      <SettingsSectorChangeSection
        value={sectorChangeFilter}
        onChange={onChangeSectorChangeFilter}
        depth={sectorChangeDepth}
        onChangeDepth={onChangeSectorChangeDepth}
        maxSelectableDepth={maxSelectableDepth}
        noDataLimited={noDataLimited}
      />
    </div>
  )
}

// 실험 탭 — 종목 정보, 종목 차트, 종목 이동. 종목 이동을 켜면 저장되지 않는다고 알려 준다.
export function MapExperimentSections({
  stockPopupOnHover,
  onChangeStockPopupOnHover,
  stockChartTrigger,
  onChangeStockChartTrigger,
  stockMoveEnabled,
  onChangeStockMoveEnabled,
}: {
  stockPopupOnHover: boolean
  onChangeStockPopupOnHover: (onHover: boolean) => void
  stockChartTrigger: StockChartTrigger
  onChangeStockChartTrigger: (trigger: StockChartTrigger) => void
  stockMoveEnabled: boolean
  onChangeStockMoveEnabled: (enabled: boolean) => void
}): ReactNode {
  return (
    <div className="settings-plain-content">
      <SettingsStockPopupSection stockPopupOnHover={stockPopupOnHover} onChangeStockPopupOnHover={onChangeStockPopupOnHover} />
      <SettingsStockChartSection trigger={stockChartTrigger} onChangeTrigger={onChangeStockChartTrigger} rightClickDisabled={stockPopupOnHover} />
      <SettingsStockMoveSection
        enabled={stockMoveEnabled}
        onChange={enabled => {
          onChangeStockMoveEnabled(enabled)
          if (enabled) void appAlert('종목 이동 기능은 저장되지 않습니다.\n임시로 살펴보시고 커스텀 페이지를 이용바랍니다.', { title: '종목 이동' })
        }}
      />
    </div>
  )
}
