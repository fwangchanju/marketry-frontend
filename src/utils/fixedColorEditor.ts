import { createDefaultColorScale, DEFAULT_ZERO_COLOR, type ColorScaleThreshold } from './heatmapColorScale.ts'

// 한 부호의 구간들을 절댓값이 작은 것부터 정렬해(몇 번째 구간인지 = 순서) 원래 배열의 인덱스와 함께 돌려준다. 등락률 막대의 손잡이 순서이자 상승·하락 거울 짝의 기준이다.
export function sortedSignRows(thresholds: ColorScaleThreshold[], positive: boolean): { threshold: ColorScaleThreshold; index: number }[] {
  return thresholds
    .map((threshold, index) => ({ threshold, index }))
    .filter(({ threshold }) => (positive ? threshold.thresholdPercent > 0 : threshold.thresholdPercent < 0))
    .sort((a, b) => Math.abs(a.threshold.thresholdPercent) - Math.abs(b.threshold.thresholdPercent))
}

// 색상을 바꿀 수 없는 화면(국내 MARKETRY·거래소 분류, 일본 지도)이 보여 주는 기본 색 막대. 조작은 설정창이 막으므로 동작은 비워 둔다.
export function buildFixedColorEditorProps() {
  const fixedColorScale = createDefaultColorScale().thresholds
  const fixedPositiveRows = sortedSignRows(fixedColorScale, true)
  const fixedNegativeRows = sortedSignRows(fixedColorScale, false)
  return {
    bar: {
      positive: fixedPositiveRows.map(row => ({ percent: row.threshold.thresholdPercent, color: row.threshold.color })),
      negative: fixedNegativeRows.map(row => ({ percent: -row.threshold.thresholdPercent, color: row.threshold.color })),
      side: 'up' as const,
      selectedRank: fixedPositiveRows.length - 1,
      zeroColor: fixedColorScale.find(threshold => threshold.thresholdPercent === 0)?.color ?? DEFAULT_ZERO_COLOR,
    },
    onChangeRankPercent: () => {},
    onSelectRank: () => {},
    onSelectZero: () => {},
  }
}
