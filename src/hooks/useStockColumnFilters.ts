import { useCallback, useMemo, useState } from 'react'

// 종목 표에서 머리글 필터를 둘 수 있는 열 — 종목코드·종목명·약칭은 위쪽 검색창이, 시가총액은 규모 필터가 대신한다.
export type StockFilterKey = 'sizeTier' | 'market' | 'industry' | 'parentSector' | 'midSector' | 'subSector' | 'nxt'

const STOCK_FILTER_KEYS: readonly StockFilterKey[] = ['sizeTier', 'market', 'industry', 'parentSector', 'midSector', 'subSector', 'nxt']

type ExcludedByKey = Partial<Record<StockFilterKey, ReadonlySet<string>>>

// 종목 표 열 필터 — "기본은 전체 포함, 체크를 풀면 제외"하는 다중 선택이다. 열마다 따로 걸리고, 여러 열을 같이 걸면 모두 만족하는 종목만 남는다.
// rows는 위쪽 검색창을 이미 적용한 종목이고, valueOf는 한 종목의 열 값(없으면 '-')을 돌려준다(매 렌더 새로 만들지 않도록 useCallback으로 넘긴다).
export function useStockColumnFilters<T>(rows: readonly T[], valueOf: (row: T, key: StockFilterKey) => string) {
  const [excluded, setExcluded] = useState<ExcludedByKey>({})

  const passes = useCallback(
    (row: T, skipKey?: StockFilterKey) =>
      STOCK_FILTER_KEYS.every(key => {
        if (key === skipKey) return true
        const set = excluded[key]
        return !set || set.size === 0 || !set.has(valueOf(row, key))
      }),
    [excluded, valueOf],
  )

  const filteredRows = useMemo(() => rows.filter(row => passes(row)), [rows, passes])

  // 그 열의 고를 수 있는 값 — 다른 열 필터를 모두 적용한 종목에서 모은다(그 열 자기 필터는 빼야 풀었다가 다시 고를 수 있다).
  const optionValues = useCallback(
    (key: StockFilterKey): string[] => {
      const values = new Set<string>()
      for (const row of rows) if (passes(row, key)) values.add(valueOf(row, key))
      return [...values]
    },
    [rows, passes, valueOf],
  )

  const toggle = useCallback((key: StockFilterKey, value: string) => {
    setExcluded(prev => {
      const next = new Set(prev[key] ?? [])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [key]: next }
    })
  }, [])
  const selectAll = useCallback((key: StockFilterKey) => setExcluded(prev => ({ ...prev, [key]: new Set() })), [])
  const selectNone = useCallback((key: StockFilterKey, values: readonly string[]) => setExcluded(prev => ({ ...prev, [key]: new Set(values) })), [])
  const clearAll = useCallback(() => setExcluded({}), [])

  const activeKeys = STOCK_FILTER_KEYS.filter(key => (excluded[key]?.size ?? 0) > 0)

  return { excluded, filteredRows, optionValues, toggle, selectAll, selectNone, clearAll, activeCount: activeKeys.length }
}
