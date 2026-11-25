// 선택된 업종의 종목은 갱신된 지도 항목에서 매번 가져온다.
export function resolveMobileStockSelection<T>(
  selection: { scope: string; key: string } | null,
  scope: string,
  items: { key: string; stocks: T[] }[],
): T[] | null {
  if (!selection || selection.scope !== scope) return null
  return items.find(item => item.key === selection.key)?.stocks ?? []
}
