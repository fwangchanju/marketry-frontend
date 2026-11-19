import { useCallback, useSyncExternalStore } from 'react'
import { canReadSettingsStorage, canWriteSettingsStorage, subscribeSettingsStorageGate } from '@/utils/settingsStorageGate'

export type TaxonomySelection = 'MARKETRY' | 'KRX' | 'MINE'

export const DEFAULT_TAXONOMY_STORAGE_KEY = 'heatmap.taxonomySelection'
const CHANGE_EVENT = 'marketry:taxonomy-selection'
const memorySelections = new Map<string, TaxonomySelection>()
const memoryOnlyKeys = new Set<string>()

function getSelection(storageKey: string): TaxonomySelection | null {
  if (memoryOnlyKeys.has(storageKey)) return memorySelections.get(storageKey) ?? null
  // 비로그인은 저장값을 읽지 않고 이 화면의 메모리에 둔 선택만 쓴다(settingsStorageGate).
  if (!canReadSettingsStorage()) return memorySelections.get(storageKey) ?? null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return null
    let value: unknown
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
    // 예전에 저장된 값(소문자, mymap)도 새 이름으로 읽는다.
    if (typeof value !== 'string') return null
    const key = value.toLowerCase() === 'mymap' ? 'MINE' : value.toUpperCase()
    return key === 'MARKETRY' || key === 'KRX' || key === 'MINE' ? key : null
  } catch {
    memoryOnlyKeys.add(storageKey)
    return memorySelections.get(storageKey) ?? null
  }
}

function setSelection(storageKey: string, next: TaxonomySelection) {
  memorySelections.set(storageKey, next)
  // 로그인한 사용자만 이 브라우저에 저장한다.
  if (canWriteSettingsStorage()) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next))
      memoryOnlyKeys.delete(storageKey)
    } catch {
      memoryOnlyKeys.add(storageKey)
    }
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

const getServerSelection = () => null

// 기본 키는 지도·그룹·커스텀이 공유하며, 로그인한 사용자는 탭을 닫은 뒤에도 이 브라우저에 선택을 저장한다(비로그인은 저장하지 않는다).
// 모바일 지도·그래프는 PC와 선택이 섞이지 않도록 자기 키(storageKey)를 넘긴다.
export function useTaxonomySelection(
  defaultSelection: TaxonomySelection = 'MARKETRY',
  storageKey: string = DEFAULT_TAXONOMY_STORAGE_KEY,
): [TaxonomySelection, (next: TaxonomySelection) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) onChange()
    }
    window.addEventListener(CHANGE_EVENT, onChange)
    window.addEventListener('storage', onStorage)
    // 로그인 여부가 확인되면 저장값을 다시 읽는다(비로그인이면 저장값을 쓰지 않는다).
    const unsubscribeGate = subscribeSettingsStorageGate(onChange)
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onStorage)
      unsubscribeGate()
    }
  }, [storageKey])
  const getSnapshot = useCallback(() => getSelection(storageKey), [storageKey])
  const select = useCallback((next: TaxonomySelection) => setSelection(storageKey, next), [storageKey])
  const selection = useSyncExternalStore(subscribe, getSnapshot, getServerSelection)
  return [selection ?? defaultSelection, select]
}
