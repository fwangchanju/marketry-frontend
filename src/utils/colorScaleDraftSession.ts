import type { ColorScaleConfig } from './heatmapColorScale'

type Update<T> = T | ((previous: T) => T)

// 페이지 전환으로 컴포넌트가 사라져도 색상 임시값·복원 기준·편집 행을 함께 보존한다.
// 저장소에는 쓰지 않으므로 새로고침하면 서버 저장값부터 다시 시작한다.
export function createColorScaleDraftSession() {
  const emptyState = () => ({
    owner: null as string | null,
    draft: null as ColorScaleConfig | null,
    editIndices: [] as number[],
    snapshotRef: { current: null as ColorScaleConfig | null },
    selectedPercentRef: { current: null as number | null },
  })
  let state = emptyState()
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach(listener => listener())
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    initialize: (owner: string, initial: ColorScaleConfig) => {
      if (state.owner === owner && state.draft !== null) return
      state = {
        ...emptyState(),
        owner,
        draft: { thresholds: initial.thresholds.map(threshold => ({ ...threshold })) },
      }
      notify()
    },
    setDraft: (next: Update<ColorScaleConfig | null>) => {
      state = { ...state, draft: typeof next === 'function' ? next(state.draft) : next }
      notify()
    },
    setEditIndices: (next: Update<number[]>) => {
      state = { ...state, editIndices: typeof next === 'function' ? next(state.editIndices) : next }
      notify()
    },
  }
}

export const colorScaleDraftSession = createColorScaleDraftSession()
