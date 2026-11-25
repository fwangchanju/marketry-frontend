import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { captureIdForFrameTitle, frameCaptureOptionsFor, SUMMARY_FRAME_TITLES } from './summaryFrames.ts'

test('서머리 틀 제목과 캡처 이름이 한 쌍이다', () => {
  assert.deepEqual([...SUMMARY_FRAME_TITLES], ['업종 지도', '그룹 등락률 (%)'])
  assert.equal(captureIdForFrameTitle('업종 지도'), 'market-map')
  assert.equal(captureIdForFrameTitle('그룹 등락률 (%)'), 'group-change-rate')
  assert.equal(captureIdForFrameTitle('없는 제목'), '')
})

test('캡처창 선택지는 틀 순서와 같은 셀렉터 규칙으로 만든다', () => {
  assert.deepEqual(frameCaptureOptionsFor(['업종 지도', '그룹 등락률 (%)']), [
    { id: 'market-map', label: '좌측', selector: '[data-capture-frame="market-map"]', selectedSlot: 0, mode: 'content' },
    { id: 'group-change-rate', label: '우측', selector: '[data-capture-frame="group-change-rate"]', selectedSlot: 1, mode: 'content' },
  ])
  assert.deepEqual(frameCaptureOptionsFor(['그룹 등락률 (%)', '업종 지도']).map(option => option.id), ['group-change-rate', 'market-map'])
})

test('SUMMARY 화면은 틀 제목과 캡처 이름을 직접 적지 않는다', () => {
  const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..')
  for (const name of ['components/SummaryScreen.tsx', 'markets/KoreaSummary.tsx', 'markets/SnapshotSummary.tsx']) {
    const source = readFileSync(join(srcDir, name), 'utf8')
    assert.ok(!source.includes("title: '업종 지도'"), `${name}에서 제목을 직접 적지 않는다`)
    assert.ok(!source.includes("captureId: 'market-map'"), `${name}에서 캡처 이름을 직접 적지 않는다`)
    assert.ok(!source.includes("title === '업종 지도'"), `${name}에서 제목으로 캡처 이름을 추론하지 않는다`)
    assert.ok(!source.includes('safeSummaryFrameOrder.map'), `${name}에서 캡처 선택지를 직접 만들지 않는다`)
    assert.ok(!source.includes('DndContext'), `${name}에서 순서 끌기 조립을 직접 만들지 않는다`)
    assert.ok(!source.includes('data-summary-fixed-capture'), `${name}에서 숨김 캡처판을 직접 만들지 않는다`)
  }
})

test('공통 화면은 시장 이름으로 갈라지지 않는다', () => {
  for (const name of ['../components/SummaryScreen.tsx', '../components/MarketToolbarContent.tsx', '../components/MobileMarketScreen.tsx', '../components/MobileStockHeatmap.tsx']) {
    const source = readFileSync(new URL(name, import.meta.url), 'utf8')
    for (const word of ["'KOREA'", "'JAPAN'", "'USA'", 'Overseas', 'overseas', 'Japan', 'Usa', 'Korea', '/korea', '/japan', '/usa']) assert.equal(source.includes(word), false, `${name}: ${word}`)
  }
})
