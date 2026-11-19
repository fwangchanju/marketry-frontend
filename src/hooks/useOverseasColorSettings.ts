import { useColorScaleSettings } from './useColorScaleSettings'
import { buildFixedColorEditorProps } from '@/utils/fixedColorEditor'
import { resolveLegendSwatches, type ColorScaleConfig } from '@/utils/heatmapColorScale'
import type { DraftScope } from '@/utils/settingsDraft'

const noop = () => {}

// 일본·미국 화면(지도·그래프·서머리)의 색상 설정. 한국과 같은 훅(useColorScaleSettings)을 쓰고, 내 기준 모드에서만 고칠 수 있다.
// MARKETRY 모드는 예전처럼 고정 색(fixed)을 쓰며 설정창 항목이 잠긴다. 내 기준 모드의 색은 한국 내 기준과 같은 값을 공유한다(2026-11-19 사용자 결정).
// participantScope는 설정창 상단 저장·되돌리기가 이 색을 어느 범위 변경으로 셀지 정한다(지도·그래프는 시장 범위 'japan'·'usa', 서머리는 내 기준 범위 'mine').
export function useOverseasColorSettings({
  isMine,
  fixed,
  participantScope,
}: {
  isMine: boolean
  fixed: { colorScale: ColorScaleConfig; strongIndustryColor: string }
  participantScope: DraftScope
}) {
  const color = useColorScaleSettings({ settingsProfile: isMine ? 'mine' : 'marketry', participantScope })
  const colorScale = isMine ? color.colorScale : fixed.colorScale
  const strongIndustryColor = isMine ? color.strongIndustryColor : fixed.strongIndustryColor
  const legendSwatches = isMine ? color.legendSwatches : resolveLegendSwatches(fixed.colorScale)
  const colorSectionProps = isMine
    ? {
        isCustom: true,
        colorScaleDraft: color.colorScaleDraft,
        colorCustomOn: color.colorCustomOn,
        onChangeColorCustomOn: color.onChangeColorCustomOn,
        onResetColorScale: color.onResetColorScale,
        isResettingColorScale: color.isResettingColorScale,
        colorEditorProps: color.colorEditorPanelProps,
        fixed: false,
      }
    : {
        isCustom: false,
        colorScaleDraft: fixed.colorScale,
        colorCustomOn: true,
        onChangeColorCustomOn: noop,
        onResetColorScale: noop,
        isResettingColorScale: false,
        colorEditorProps: buildFixedColorEditorProps(),
        fixed: true,
      }
  const strongSectionProps = {
    color: strongIndustryColor,
    onChange: isMine ? color.setStrongIndustryColor : noop,
    fixed: !isMine,
  }
  return { colorScale, strongIndustryColor, legendSwatches, colorSectionProps, strongSectionProps }
}
