import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  currentNxtOnlyWindow, currentTradingSession, getKstDate,
  isAfterHoursSelectable, shouldShowAfterHoursControls,
} from './tradingWindow.ts'

test('시간외 시작이 늦은 날에는 실제 경계부터 선택할 수 있다', () => {
  const boundary = '2025-11-13T16:40:00'
  assert.equal(isAfterHoursSelectable('2025-11-13T15:40:00', boundary), false)
  assert.equal(isAfterHoursSelectable('2025-11-13T16:35:00', boundary), false)
  assert.equal(isAfterHoursSelectable('2025-11-13T16:40:00', boundary), true)
  assert.equal(isAfterHoursSelectable('2025-11-13T20:00:00', boundary), true)
})

test('경계가 없으면 15:40을 사용하고 가격이 없으면 선택할 수 없다', () => {
  assert.equal(isAfterHoursSelectable('2026-10-08T15:35:00'), false)
  assert.equal(isAfterHoursSelectable('2026-10-08T15:40:00'), true)
  assert.equal(isAfterHoursSelectable(null), false)
})

test('조회 날짜가 다른 비교 스냅샷에는 시간외 기준을 섞지 않는다', () => {
  assert.equal(isAfterHoursSelectable('2025-11-12T20:00:00', '2025-11-13T16:40:00'), false)
})

test('오늘의 지연된 시간외 시작 전에는 버튼을 숨긴다', () => {
  const boundary = '2025-11-13T16:40:00'
  assert.equal(shouldShowAfterHoursControls(new Date('2025-11-13T16:35:00+09:00'), boundary), false)
  assert.equal(shouldShowAfterHoursControls(new Date('2025-11-13T16:40:00+09:00'), boundary), true)
})

test('평일 오전에는 이전 거래일 시간외 스냅샷이 남아 있어도 버튼을 숨긴다', () => {
  const previousBoundary = '2026-10-07T15:40:00'
  assert.equal(shouldShowAfterHoursControls(new Date('2026-10-08T07:59:00+09:00'), previousBoundary), true)
  assert.equal(shouldShowAfterHoursControls(new Date('2026-10-08T08:00:00+09:00'), previousBoundary), false)
  assert.equal(shouldShowAfterHoursControls(new Date('2026-10-08T15:40:00+09:00'), previousBoundary), true)
})

test('주말에는 마지막 거래일의 시간외 데이터를 계속 볼 수 있다', () => {
  assert.equal(shouldShowAfterHoursControls(new Date('2026-10-10T12:00:00+09:00'), '2026-10-08T15:40:00'), true)
})

const windowFor = (date, start, end) => ({ startTime: `${date}T${start}:00`, endTime: `${date}T${end}:00` })
const normal = {
  date: '2026-01-02', status: 'TRADING_DAY',
  preMarket: windowFor('2026-01-02', '08:00', '09:00'),
  regularMarket: windowFor('2026-01-02', '09:00', '15:30'),
  afterMarket: windowFor('2026-01-02', '15:40', '20:00'),
  nxtOnlyWindows: [windowFor('2026-01-02', '08:00', '08:50'), windowFor('2026-01-02', '15:40', '16:00')],
}
const exam = {
  date: '2025-11-13', status: 'TRADING_DAY', preMarket: null,
  regularMarket: windowFor('2025-11-13', '10:00', '16:30'),
  afterMarket: windowFor('2025-11-13', '16:40', '20:00'),
  nxtOnlyWindows: [windowFor('2025-11-13', '16:40', '17:00')],
}
const at = (schedule, time) => new Date(`${schedule.date}T${time}+09:00`)

test('정상 거래일은 기존 문구와 구간을 그대로 사용한다', () => {
  for (const [time, expected] of [
    ['07:59:59', '마켓 종료'], ['08:00:00', '프리 마켓'], ['08:50:00', '프리 마켓'],
    ['09:00:00', '메인 마켓'], ['15:29:59', '메인 마켓'], ['15:30:00', '메인 마켓'],
    ['15:39:59', '메인 마켓'], ['15:40:00', '애프터 마켓'], ['20:00:00', '마켓 종료'],
  ]) assert.equal(currentTradingSession(at(normal, time), normal), expected, time)
})

test('정상 NXT 필터는 시작을 포함하고 끝은 포함하지 않는다', () => {
  for (const [time, expected] of [
    ['07:59:59', null], ['08:00:00', '08:00 ~ 09:00'], ['08:49:59', '08:00 ~ 09:00'],
    ['08:50:00', '08:00 ~ 09:00'], ['08:59:59', '08:00 ~ 09:00'], ['09:00:00', null], ['15:39:59', null], ['15:40:00', '15:40 ~ 16:00'],
    ['15:59:59', '15:40 ~ 16:00'], ['16:00:00', null],
  ]) assert.equal(currentNxtOnlyWindow(at(normal, time), normal)?.label ?? null, expected, time)
})

test('수능일에는 프리장을 만들지 않고 메인·애프터 시작과 종료가 이동한다', () => {
  for (const [time, expected] of [
    ['08:30:00', '마켓 종료'], ['09:30:00', '마켓 종료'], ['10:00:00', '메인 마켓'],
    ['16:29:59', '메인 마켓'], ['16:30:00', '메인 마켓'], ['16:39:59', '메인 마켓'],
    ['16:40:00', '애프터 마켓'], ['20:00:00', '마켓 종료'],
  ]) assert.equal(currentTradingSession(at(exam, time), exam), expected, time)
})

test('수능일 NXT 필터는 오전에 꺼지고 16:40부터 17:00 직전까지만 켜진다', () => {
  for (const [time, expected] of [
    ['08:30:00', null], ['15:50:00', null], ['16:39:59', null],
    ['16:40:00', '16:40 ~ 17:00'], ['16:59:59', '16:40 ~ 17:00'], ['17:00:00', null],
  ]) assert.equal(currentNxtOnlyWindow(at(exam, time), exam)?.label ?? null, expected, time)
})

test('평일 휴장은 저장된 구간이 있더라도 종료 표시와 필터 끄기가 우선한다', () => {
  const holiday = { ...normal, status: 'HOLIDAY' }
  assert.equal(currentTradingSession(at(normal, '09:00:00'), holiday), '마켓 종료')
  assert.equal(currentNxtOnlyWindow(at(normal, '08:30:00'), holiday), null)
  assert.equal(currentNxtOnlyWindow(at(normal, '15:50:00'), holiday), null)
})

test('FAILED·누락·조회 오류 시 기존 평일 판정을 유지한다', () => {
  for (const schedule of [{ ...normal, status: 'FAILED' }, undefined]) {
    assert.equal(currentTradingSession(at(normal, '08:30:00'), schedule), '프리 마켓')
    assert.equal(currentTradingSession(at(normal, '08:55:00'), schedule), '프리 마켓')
    assert.equal(currentTradingSession(at(normal, '15:35:00'), schedule), '메인 마켓')
    assert.equal(currentTradingSession(at(normal, '15:50:00'), schedule), '애프터 마켓')
    assert.equal(currentNxtOnlyWindow(at(normal, '08:30:00'), schedule)?.label, '08:00 ~ 09:00')
    assert.equal(currentNxtOnlyWindow(at(normal, '08:55:00'), schedule)?.label, '08:00 ~ 09:00')
    assert.equal(currentNxtOnlyWindow(at(normal, '09:00:00'), schedule), null)
    assert.equal(currentNxtOnlyWindow(at(normal, '15:50:00'), schedule)?.label, '15:40 ~ 16:00')
  }
})

test('실패한 주말 시간표는 기존대로 종료 표시하고 필터를 끈다', () => {
  const failed = { ...normal, date: '2026-01-03', status: 'FAILED' }
  assert.equal(currentTradingSession(at(failed, '09:00:00'), failed), '마켓 종료')
  assert.equal(currentNxtOnlyWindow(at(failed, '08:30:00'), failed), null)
})

test('전날 휴장 캐시를 다음 거래일에 적용하지 않는다', () => {
  const previous = { ...normal, date: '2026-01-01', status: 'HOLIDAY' }
  assert.equal(currentTradingSession(at(normal, '09:00:00'), previous), '메인 마켓')
  assert.equal(currentNxtOnlyWindow(at(normal, '08:30:00'), previous)?.label, '08:00 ~ 09:00')
})

test('한국 날짜가 바뀌면 다음 날짜 시간표 키를 사용한다', () => {
  assert.equal(getKstDate(new Date('2026-01-01T14:59:59Z')), '2026-01-01')
  assert.equal(getKstDate(new Date('2026-01-01T15:00:00Z')), '2026-01-02')
})

test('브라우저 기준 날짜·오프셋과 무관하게 한국 시간으로 판정한다', () => {
  assert.equal(currentTradingSession(new Date('2026-01-01T23:30:00Z'), normal), '프리 마켓')
  assert.equal(currentNxtOnlyWindow(new Date('2025-11-13T02:50:00-05:00'), exam)?.label, '16:40 ~ 17:00')
})
