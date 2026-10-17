import { useSyncExternalStore } from 'react'

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
}
const participants = new Map<string, DraftParticipant>()

export function updateDraftParticipant(key: string, participant: DraftParticipant) {
  const wasDirty = participants.get(key)?.hasChanges ?? false
  participants.set(key, participant)
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
  memoryDrafts.set(key, value)
  notify()
}

function activeDraftKeys(): string[] {
  return [...registeredKeys].filter(key => readDraft(key).found)
}

function removeDraft(key: string) {
  memoryDrafts.delete(key)
}

export function discardDrafts() {
  participants.forEach(participant => { if (participant.hasChanges) participant.discard() })
  activeDraftKeys().forEach(removeDraft)
  notify()
}

// 임시값을 저장값으로 올린다. save는 로그인 사용자의 서버 저장 함수(useCustomPreferences의 commitPreferences).
// 저장이 성공한 뒤에만 임시값을 지운다 — 실패하면 던지고 임시값을 그대로 둬서 다시 저장할 수 있다.
export async function commitDrafts(save: (entries: Array<[string, unknown]>) => Promise<void>) {
  const entries = activeDraftKeys().map(key => [key, readDraft(key).value] as [string, unknown])
  const pending = [...participants.values()].filter(participant => participant.hasChanges)
  for (const participant of pending) await participant.save()
  if (entries.length > 0) await save(entries)
  // 저장하는 동안 사용자가 다시 바꾼 값은 남겨 둔다.
  entries.forEach(([key, value]) => { if (readDraft(key).value === value) removeDraft(key) })
  notify()
}

// 임시값이 하나라도 있으면 true. 값이 바뀔 때마다 다시 그려지게 구독한다.
export function useHasDrafts(): boolean {
  useSyncExternalStore(subscribe, () => version)
  return activeDraftKeys().length > 0 || [...participants.values()].some(participant => participant.hasChanges)
}

// 임시값이 바뀌거나 버려질 때 설정을 쓰는 화면이 다시 그려지게 하는 구독.
export function useDraftVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
