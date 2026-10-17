// 지도 설정 북마크가 가리킬 수 있는 항목 id와 북마크 탭의 실제 표시 순서.
// 항목을 없애거나 이름을 바꾸면 서버에 저장된 북마크 id가 가리킬 곳을 잃으므로, 읽을 때 알려진 id만 남긴다(isSettingsBookmarkId).
export type SettingsBookmarkId =
  | 'depthLevel' | 'depthMetric' | 'depthRange' | 'topPick'
  | 'marketValueRange' | 'stockChange' | 'excludeSector'
  | 'boxSize' | 'boxLabel' | 'decimalPlaces'
  | 'strongColor'

export const BOOKMARK_ORDER: readonly SettingsBookmarkId[] = [
  'marketValueRange', 'excludeSector', 'stockChange',
  'depthLevel', 'depthMetric', 'depthRange',
  'boxSize', 'boxLabel', 'decimalPlaces',
  'strongColor', 'topPick',
]

export function isSettingsBookmarkId(id: unknown): id is SettingsBookmarkId {
  return typeof id === 'string' && (BOOKMARK_ORDER as readonly string[]).includes(id)
}

// 저장된 값(배열이 아니거나 모르는 id가 섞여 있을 수 있다)에서 알려진 id만, 중복 없이 뽑는다.
export function sanitizeBookmarkIds(raw: unknown): SettingsBookmarkId[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter(isSettingsBookmarkId))]
}
