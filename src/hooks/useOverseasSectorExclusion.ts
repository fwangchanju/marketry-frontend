import { useMemo } from 'react'
import { usePageSetting } from './usePageSetting'

const NO_IDS: number[] = []
const NO_SECTORS = new Set<number>()

// 일본·미국의 "업종 제외" — 지도·요약·그래프가 같은 값을 쓴다(시가총액 범위와 같다). 제외한 업종 id를 계정 설정으로 저장하고,
// 스위치를 끄면 목록은 남기고 적용만 멈춘다. 기본값은 켜짐·빈 목록이라 지금 화면과 같다.
export function useOverseasSectorExclusion(settingPrefix: string) {
  const [enabled, setEnabled] = usePageSetting<boolean>(`${settingPrefix}sectorFilterEnabled`, true)
  const [ids, setIds] = usePageSetting<number[]>(`${settingPrefix}excludedSectorIds`, NO_IDS)
  const excludedSectorIds = useMemo<ReadonlySet<number>>(() => (enabled && ids.length > 0 ? new Set(ids) : NO_SECTORS), [enabled, ids])
  const exclude = (sectorId: number) => setIds(previous => (previous.includes(sectorId) ? previous : [...previous, sectorId]))
  const remove = (sectorId: number) => setIds(previous => previous.filter(id => id !== sectorId))
  const toggle = () => setEnabled(previous => !previous)
  return { enabled, ids, excludedSectorIds, exclude, remove, toggle }
}

export type OverseasSectorExclusion = ReturnType<typeof useOverseasSectorExclusion>
