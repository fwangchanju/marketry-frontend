import { useSyncExternalStore } from 'react'

// 모바일 화면(폭 768px 미만)인지 — 창 크기가 바뀌면 바로 따라간다.
const NARROW_QUERY = '(max-width: 767px)'

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useIsNarrowScreen() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW_QUERY).matches, () => false)
}
