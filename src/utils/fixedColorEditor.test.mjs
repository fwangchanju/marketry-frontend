import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildFixedColorEditorProps, sortedSignRows } from './fixedColorEditor.ts'
import { createDefaultColorScale } from './heatmapColorScale.ts'

test('상승·하락 구간은 절댓값이 작은 것부터 정렬한다', () => {
  const thresholds = [
    { thresholdPercent: 5, color: 'b' }, { thresholdPercent: -2, color: 'x' }, { thresholdPercent: 2, color: 'a' },
    { thresholdPercent: 0, color: 'z' }, { thresholdPercent: -5, color: 'y' },
  ]
  assert.deepEqual(sortedSignRows(thresholds, true).map(row => row.threshold.thresholdPercent), [2, 5])
  assert.deepEqual(sortedSignRows(thresholds, false).map(row => row.threshold.thresholdPercent), [-2, -5])
})

test('고정 색 막대는 기본 색상 구간을 그대로 보여 주고 조작 동작은 비어 있다', () => {
  const props = buildFixedColorEditorProps()
  const thresholds = createDefaultColorScale().thresholds
  const positive = thresholds.filter(t => t.thresholdPercent > 0).sort((a, b) => a.thresholdPercent - b.thresholdPercent)
  assert.deepEqual(props.bar.positive.map(row => row.percent), positive.map(t => t.thresholdPercent))
  // 하락 구간은 부호를 뒤집은 값(절댓값)으로 담겨 상승 구간과 같은 숫자가 나온다.
  assert.deepEqual(props.bar.negative.map(row => row.percent), positive.map(t => t.thresholdPercent))
  assert.equal(props.bar.side, 'up')
  assert.equal(props.bar.selectedRank, positive.length - 1)
  assert.equal(props.onChangeRankPercent(), undefined)
})
