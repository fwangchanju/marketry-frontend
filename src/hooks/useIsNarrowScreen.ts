import { useSyncExternalStore } from 'react'

// 모바일 화면인지 — 창 크기가 바뀌면 바로 따라간다. 폭 767px 이하이거나, 손가락으로 쓰는 기기(pointer: coarse)가 높이 500px 이하(가로로 눕힌 폰)일 때다.
// index.css의 모바일 규칙(주간모드 색·글자 선택 막기)도 같은 조건이므로 바꿀 때 함께 바꾼다.
const NARROW_QUERY = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)'

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(NARROW_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function useIsNarrowScreen() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW_QUERY).matches, () => false)
}
