import assert from 'node:assert/strict'
import { test } from 'node:test'
import { USA_SESSION_GUIDE, usaCloseInKst, usaRefreshHelp } from './usaMarketSession.ts'

test('현지 마감은 겨울에 한국 06:00, 서머타임에 05:00이고 모두 다음 날이다', () => {
  assert.deepEqual(usaCloseInKst('2026-11-13'), { time: '06:00', nextDay: true })
  assert.deepEqual(usaCloseInKst('2026-07-15'), { time: '05:00', nextDay: true })
})

test('서머타임이 바뀌는 날도 그날의 현지 마감으로 계산한다', () => {
  assert.deepEqual(usaCloseInKst('2026-03-06'), { time: '06:00', nextDay: true })
  assert.deepEqual(usaCloseInKst('2026-03-09'), { time: '05:00', nextDay: true })
  assert.deepEqual(usaCloseInKst('2026-10-30'), { time: '05:00', nextDay: true })
  assert.deepEqual(usaCloseInKst('2026-11-02'), { time: '06:00', nextDay: true })
})

test('새로고침 안내는 한국 시간 마감을 첫 줄에 두고, 날짜가 없으면 그 줄을 뺀다', () => {
  assert.equal(usaRefreshHelp('2026-11-13T16:00:00').split('\n')[0], '한국 시간으로 다음 날 06:00에 마감됩니다.')
  assert.equal(usaRefreshHelp(null).split('\n')[0], '하루 한 번 갱신됩니다.')
})

test('세션 안내는 한국 칩과 같은 세 시간대 이름을 쓴다', () => {
  assert.deepEqual(USA_SESSION_GUIDE.map(row => row.session), ['프리 마켓', '메인 마켓', '애프터 마켓'])
})
