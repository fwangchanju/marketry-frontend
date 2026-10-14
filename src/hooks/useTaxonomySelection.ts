import { useSyncExternalStore } from 'react'

export type TaxonomySelection = 'MARKETRY' | 'KRX' | 'MINE'

const STORAGE_KEY = 'treemap.taxonomySelection'
const CHANGE_EVENT = 'marketry:taxonomy-selection'
let memorySelection: TaxonomySelection | null = null
let useMemoryStorage = false

function getSelection(): TaxonomySelection | null {
  if (useMemoryStorage) return memorySelection
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
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
    useMemoryStorage = true
    return memorySelection
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange()
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function setSelection(next: TaxonomySelection) {
  memorySelection = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    useMemoryStorage = false
  } catch {
    useMemoryStorage = true
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

const getServerSelection = () => null

// 지도·그룹·커스텀이 공유하며, 탭을 닫은 뒤에도 이 브라우저에 선택을 저장한다.
export function useTaxonomySelection(defaultSelection: TaxonomySelection = 'MARKETRY'): [TaxonomySelection, (next: TaxonomySelection) => void] {
  const selection = useSyncExternalStore(subscribe, getSelection, getServerSelection)
  return [selection ?? defaultSelection, setSelection]
}
