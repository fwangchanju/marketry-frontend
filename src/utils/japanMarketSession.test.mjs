import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { JAPAN_SESSION_GUIDE, japanSessionAt } from './japanMarketSession.ts'

test('세션은 도쿄 시간표로 판정한다', () => {
  const at = clock => japanSessionAt(`2026-11-04T${clock}:00`)
  assert.equal(at('08:59'), '장 마감')
  assert.equal(at('09:00'), '오전 장')
  assert.equal(at('11:29'), '오전 장')
  assert.equal(at('11:30'), '점심 휴장')
  assert.equal(at('12:30'), '오후 장')
  assert.equal(at('15:29'), '오후 장')
  assert.equal(at('15:30'), '장 마감')
  assert.equal(at('20:00'), '장 마감')
})

test('휴장일은 시각과 상관없이 장 마감이다', () => {
  assert.equal(japanSessionAt('2026-11-03T10:00:00'), '장 마감')
})

test('안내 창의 세션은 판정 결과의 네 가지와 같다', () => {
  assert.deepEqual(JAPAN_SESSION_GUIDE.map(row => row.session), ['오전 장', '점심 휴장', '오후 장', '장 마감'])
})

test('한국과 일본 세션은 서로의 이름과 부품을 쓰지 않는다', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  for (const path of ['../components/ToolbarControls.tsx', './tradingWindow.ts']) {
    const source = read(path)
    for (const name of ['오전 장', '점심 휴장', '오후 장', '장 마감', 'japanMarket', 'JapanSession']) assert.equal(source.includes(name), false, `${path}: ${name}`)
  }
  for (const path of ['./japanMarketSession.ts', '../components/JapanSessionChip.tsx', '../pages/JapanMapPage.tsx']) {
    const source = read(path)
    for (const name of ['프리 마켓', '메인 마켓', '애프터 마켓', "'마켓 종료'", 'ToolbarControls', 'tradingWindow', 'useTradingSession']) assert.equal(source.includes(name), false, `${path}: ${name}`)
  }
})

test('일본 지도는 국내 지도의 설정을 읽지 않는다', () => {
  const source = readFileSync(new URL('../pages/JapanMapPage.tsx', import.meta.url), 'utf8')
  for (const name of ['settingDefaults', 'useHeatmapColorScale', 'useGlobalSettings', 'MEMBER_DEFAULTS']) assert.equal(source.includes(name), false, name)
})

test('일본 지도 기본값은 형식이 맞지 않는 값을 코드 기본값으로 되돌린다', async () => {
  const { JAPAN_MAP_DEFAULTS, japanMapManagedDefaults } = await import('./japanMapSettings.ts')
  assert.deepEqual(japanMapManagedDefaults(undefined), JAPAN_MAP_DEFAULTS)
  const stored = japanMapManagedDefaults({ japan: { boxSizeMarketCapRatio: 80, decimalPlaces: '많이', maxDepth: null } })
  assert.equal(stored.boxSizeMarketCapRatio, 80)
  assert.equal(stored.decimalPlaces, JAPAN_MAP_DEFAULTS.decimalPlaces)
  assert.equal(stored.maxDepth, null)
})
