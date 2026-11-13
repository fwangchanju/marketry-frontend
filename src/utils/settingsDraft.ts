import { useSyncExternalStore } from 'react'
import type { SettingsProfile } from './settingsSchema'

// 일본·미국 화면(지도·그래프)의 임시값은 국내 분류 세 칸과 따로, 서로도 따로 센다 — 'japan.' 또는 'usa.'로 시작하는 저장 이름이 각자의 범위에 속한다.
export type DraftScope = SettingsProfile | 'common' | 'japan' | 'usa'

// "임시로 써보기" 값 저장소. 설정창에서 바꾼 값은 서버에 바로 올리지 않고 이 화면의 메모리에만 둔다(새로고침하면 사라진다) —
// 저장 버튼을 눌러야 서버로 올라가고(commitDrafts), 초기화 버튼이나 브라우저 종료·새로고침이면 저장값으로 돌아온다(discardDrafts).
// 어떤 키가 설정 값인지는 usePageSetting이 등록한다(같은 sessionStorage의 다른 토글성 값은 건드리지 않기 위해).
const registeredKeys = new Set<string>()
const memoryDrafts = new Map<string, unknown>()
const listeners = new Set<() => void>()
let version = 0

// 별도 API로 저장되는 설정도 상단 저장·되돌리기에 함께 참여한다.
interface DraftParticipant {
  hasChanges: boolean
  save: () => Promise<void>
  discard: () => void
  scope: DraftScope
}
const participants = new Map<string, DraftParticipant>()

export function updateDraftParticipant(
  key: string,
  participant: Omit<DraftParticipant, 'scope'> & { scope?: DraftScope },
) {
  const wasDirty = participants.get(key)?.hasChanges ?? false
  participants.set(key, { ...participant, scope: participant.scope ?? 'common' })
  if (wasDirty !== participant.hasChanges) notify()
}

export function unregisterDraftParticipant(key: string) {
  const wasDirty = participants.get(key)?.hasChanges
  participants.delete(key)
  if (wasDirty) notify()
}

function notify() {
  version += 1
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function registerDraftKey(key: string) {
  registeredKeys.add(key)
}

export function readDraft(key: string): { found: boolean; value?: unknown } {
  return memoryDrafts.has(key) ? { found: true, value: memoryDrafts.get(key) } : { found: false }
}

export function writeDraft(key: string, value: unknown) {
  if (memoryDrafts.has(key) && Object.is(memoryDrafts.get(key), value)) return
  // 임시값을 쓰는 이름은 설정 이름이다. 코드가 다시 불러와져(개발 중 핫 리로드) 등록 목록이 비어도 저장 아이콘·분류 칸의 변경 점이 사라지지 않게 함께 등록한다.
  registeredKeys.add(key)
  memoryDrafts.set(key, value)
  notify()
}

function scopeForKey(key: string): DraftScope {
  if (key.startsWith('japan.')) return 'japan'
  if (key.startsWith('usa.')) return 'usa'
  const match = key.match(/^heatmap\.profile\.(exchange|marketry|mine)\./)
  return match ? match[1] as SettingsProfile : 'common'
}

function inScope(itemScope: DraftScope, scope?: DraftScope): boolean {
  return scope === undefined || itemScope === 'common' || itemScope === scope
}

function activeDraftKeys(scope?: DraftScope): string[] {
  return [...registeredKeys].filter(key => inScope(scopeForKey(key), scope) && readDraft(key).found)
}

export function clearDraft(key: string, notifySubscribers = true) {
  const removed = memoryDrafts.delete(key)
  if (removed && notifySubscribers) notify()
}

export function discardDrafts(scope?: DraftScope) {
  participants.forEach(participant => {
    if (participant.hasChanges && inScope(participant.scope, scope)) participant.discard()
  })
  activeDraftKeys(scope).forEach(key => clearDraft(key, false))
  notify()
}

// 임시값을 저장값으로 올린다. save는 로그인 사용자의 서버 저장 함수(useCustomPreferences의 commitPreferences).
// 저장이 성공한 뒤에만 임시값을 지운다 — 실패하면 던지고 임시값을 그대로 둬서 다시 저장할 수 있다.
export async function commitDrafts(
  save: (entries: Array<[string, unknown]>) => Promise<void>,
  scope?: DraftScope,
) {
  const entries = activeDraftKeys(scope).map(key => [key, readDraft(key).value] as [string, unknown])
  const pending = [...participants.values()].filter(participant => participant.hasChanges && inScope(participant.scope, scope))
  for (const participant of pending) await participant.save()
  if (entries.length > 0) await save(entries)
  // 저장하는 동안 사용자가 다시 바꾼 값은 남겨 둔다.
  entries.forEach(([key, value]) => { if (readDraft(key).value === value) clearDraft(key, false) })
  notify()
}

// 임시값이 하나라도 있으면 true. 값이 바뀔 때마다 다시 그려지게 구독한다.
export function useHasDrafts(scope?: DraftScope): boolean {
  useSyncExternalStore(subscribe, () => version)
  return activeDraftKeys(scope).length > 0 || [...participants.values()].some(
    participant => participant.hasChanges && inScope(participant.scope, scope),
  )
}

// 주어진 저장 이름 중 하나라도 저장값과 다른 임시값이 있으면 true — 설정창 항목 제목 옆 변경 점에 쓴다.
// 별도 API로 저장되는 항목(색상 구간 등)은 참여자 등록 이름으로도 확인한다.
// scope를 주면 그 분류에 속한 참여자의 변경만 본다(내 기준 전용 색상 구간이 다른 분류 항목에 점을 찍지 않게).
export function hasDraftForKeys(keys: readonly string[], scope?: DraftScope): boolean {
  return keys.some(key => {
    if (readDraft(key).found) return true
    const participant = participants.get(key)
    return participant !== undefined && participant.hasChanges && inScope(participant.scope, scope)
  })
}

export function useHasDraftForKeys(keys: readonly string[], scope?: DraftScope): boolean {
  useSyncExternalStore(subscribe, () => version)
  return hasDraftForKeys(keys, scope)
}

// 임시값이 바뀌거나 버려질 때 설정을 쓰는 화면이 다시 그려지게 하는 구독.
export function useDraftVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

// 설정창이 넘긴 변경 점 이름 표(draftKeyMap)가 어느 화면 범위인지 저장 이름의 접두어로 구한다. 표가 비어 있으면 일본으로 본다.
export function draftScopeOfKeyMap(keyMap: Readonly<Record<string, string>>): DraftScope {
  const first = Object.values(keyMap)[0]
  return first === undefined ? 'japan' : scopeForKey(first)
}
