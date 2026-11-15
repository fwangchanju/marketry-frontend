import { useSyncExternalStore } from 'react'
import type { MarketQuery } from '@/types/api'
import type { OverseasMarket } from '@/utils/markets'

// 달력에서 고른 날짜·기간은 화면(지도·그룹) 안이 아니라 이 저장소에 둔다 — 그룹에서 업종을 눌러 지도로 가거나 메뉴로 지도·그룹을
// 오가도 선택이 풀리지 않게 하기 위해서다. 브라우저를 새로 고치면 풀린다(저장소는 메모리에만 있다).
// 일본·미국 지도·그래프도 같은 저장소를 쓴다. 한국 시장과 날짜 목록이 달라서 다른 시장에서 고른 날짜는 보는 쪽 시장의 종가로 옮긴다.
export type SnapshotMarket = MarketQuery | OverseasMarket

export interface SnapshotPick {
  // 고른 시점의 시장 — 다른 시장에서는 그 시장의 같은 날짜(없으면 이전 거래일) 종가 시각을 다시 찾는다.
  market: SnapshotMarket
  snapshotTime: string
}

interface SnapshotSelectionState {
  // 달력에서 지난 날짜를 골랐을 때의 종가 스냅샷 시각(기간이면 종료일). 없으면 실시간.
  pinned: SnapshotPick | null
  // 기간 등락률의 시작일 스냅샷 시각.
  range: SnapshotPick | null
  // 실시간(최신) 지도의 스냅샷 시각 — 지난 날짜·기간을 보는 동안에도 달력이 오늘을 알아보도록 기억해 둔다.
  liveSnapshotTime: string | null
}

let state: SnapshotSelectionState = { pinned: null, range: null, liveSnapshotTime: null }
const listeners = new Set<() => void>()

const update = (patch: Partial<SnapshotSelectionState>) => {
  state = { ...state, ...patch }
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// 아래 두 함수는 모듈에 하나뿐이라 렌더마다 바뀌지 않는다(효과의 의존 값으로 써도 안전하다).
const setSelection = (pinned: SnapshotPick | null, range: SnapshotPick | null) => update({ pinned, range })
const setLiveSnapshotTime = (liveSnapshotTime: string | null) => {
  if (state.liveSnapshotTime !== liveSnapshotTime) update({ liveSnapshotTime })
}

export function useSnapshotSelection() {
  const current = useSyncExternalStore(subscribe, () => state, () => state)
  return { ...current, setSelection, setLiveSnapshotTime }
}
