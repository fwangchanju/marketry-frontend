import { useCallback, useSyncExternalStore } from 'react'

export type TaxonomySelection = 'MARKETRY' | 'KRX' | 'MINE'

export const DEFAULT_TAXONOMY_STORAGE_KEY = 'heatmap.taxonomySelection'
const CHANGE_EVENT = 'marketry:taxonomy-selection'
const memorySelections = new Map<string, TaxonomySelection>()
const memoryOnlyKeys = new Set<string>()

function getSelection(storageKey: string): TaxonomySelection | null {
  if (memoryOnlyKeys.has(storageKey)) return memorySelections.get(storageKey) ?? null
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
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(next))
    memoryOnlyKeys.delete(storageKey)
  } catch {
    memoryOnlyKeys.add(storageKey)
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

const getServerSelection = () => null

// 기본 키는 지도·그룹·커스텀이 공유하며, 탭을 닫은 뒤에도 이 브라우저에 선택을 저장한다.
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
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [storageKey])
  const getSnapshot = useCallback(() => getSelection(storageKey), [storageKey])
  const select = useCallback((next: TaxonomySelection) => setSelection(storageKey, next), [storageKey])
  const selection = useSyncExternalStore(subscribe, getSnapshot, getServerSelection)
  return [selection ?? defaultSelection, select]
}
