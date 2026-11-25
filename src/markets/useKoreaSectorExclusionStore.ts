import { useEffect, useMemo } from 'react'
import { useTransientSetting } from '@/hooks/useTransientSetting'
import { usePageSetting } from '@/hooks/usePageSetting'
import { useSession } from '@/hooks/useSession'
import { registerExcludedSector, unregisterExcludedSector } from '@/api/heatmap'
import { useTelegramCaptureSetting } from '@/hooks/useTelegramImageSetting'
import { notifySettingsChanged } from '@/utils/settingsDraft'
import { readBrowserSetting, writeBrowserSetting } from '@/utils/browserProfileSettings'
import type { HeatmapResponse, HeatmapSectorNode } from '@/types/api'
import { profileSettingKey } from '@/utils/settingsSchema'
import { useCustomPreferences } from '@/hooks/useCustomPreferences'
import { useDefaultPreferences } from '@/hooks/useDefaultPreferences'
import { excludedNamesForPaths } from '@/utils/excludedSectorPaths'
import { findSectorPath } from '@/utils/sectorExclusion'

// 내 기준 제외 목록을 서버 값으로 채운 상태를 화면 메모리에만 기억한다. 새로고침하면 다시 채운다.
let lastSeededExclusionKey: string | null = null

// 내 기준 제외 목록의 기본값. 예방 조치: 매 렌더 새 Map을 넘기면 useTransientSetting 스냅샷이 계속 바뀌어 무한 렌더가 될 수 있다.
// 실제로 무한 렌더가 재현된 것은 거래소 모드 제외 목록(아래 주석)이고, 이 내 기준 항목은 재현되지 않았다.
// 지우지 말 것: 이 상수는 같은 패턴의 무한 렌더를 막는 예방 장치다. 빈 Map을 다시 인라인으로 넘기지 말 것.
const EMPTY_MINE_EXCLUSIONS = new Map<number, string>()

// sectorId -> "상위 - 하위" 형태의 전체 경로. "이 섹터가 제외 목록에 있는지"만 관리하고,
// 실제로 화면에서 걸러낼지는 별도의 sectorFilterEnabled 마스터 스위치가 결정한다.
function seedExcludedSectorNames(
  nodes: HeatmapSectorNode[],
  ancestors: string[] = [],
  out: Map<number, string> = new Map(),
) {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName]
    if (node.isExcluded) out.set(node.sectorId, path.join(' > '))
    seedExcludedSectorNames(node.children, path, out)
  }
  return out
}

function seedExcludedSectorKeys(nodes: HeatmapSectorNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.isExcluded && node.stableKey) out.push(node.stableKey)
    seedExcludedSectorKeys(node.children, out)
  }
  return out
}

function excludedNamesForStableKeys(nodes: HeatmapSectorNode[], keys: string[]): Map<number, string> {
  const selected = new Set(keys)
  const result = new Map<number, string>()
  const walk = (items: HeatmapSectorNode[], ancestors: string[] = []) => {
    for (const node of items) {
      const path = [...ancestors, node.sectorName]
      if (node.stableKey && selected.has(node.stableKey)) result.set(node.sectorId, path.join(' > '))
      walk(node.children, path)
    }
  }
  walk(nodes)
  return result
}

function stableKeyForSectorId(nodes: HeatmapSectorNode[], sectorId: number): string | null {
  for (const node of nodes) {
    if (node.sectorId === sectorId) return node.stableKey ?? null
    const key = stableKeyForSectorId(node.children, sectorId)
    if (key) return key
  }
  return null
}

// 한국의 제외 업종을 저장하고 읽는 곳. 내 기준은 서버의 업종, MARKETRY는 이 브라우저의 고정 키(비로그인은 화면 메모리), 거래소는 화면 메모리다.
export function useKoreaSectorExclusionStore({ data, rootNodes, isCustom, isMarketry, usesCustomTree, isLoggedIn, isHeatmapSuccess, readOnly, isTelegramCapture, sectorFilterEnabled }: {
  data: HeatmapResponse | undefined
  rootNodes: HeatmapSectorNode[]
  isCustom: boolean
  isMarketry: boolean
  usesCustomTree: boolean
  isLoggedIn: boolean
  isHeatmapSuccess: boolean
  readOnly: boolean
  isTelegramCapture: boolean
  sectorFilterEnabled: boolean
}) {
  const { data: session } = useSession()
  const { isLoaded: preferencesLoaded } = useCustomPreferences()
  const defaultPreferences = useDefaultPreferences()
  const telegramCaptureSetting = useTelegramCaptureSetting()
  const [mineExcludedSectorNames, setMineExcludedSectorNames] = useTransientSetting<Map<number, string>>(
    'heatmap.excludedSectorNames.mine', EMPTY_MINE_EXCLUSIONS,
  )
  // 새로 받아온 (market, source) 조합의 데이터가 처음 도착했을 때만 서버 isExcluded로 시드하고,
  // 그 뒤 60초 백그라운드 재조회가 로컬에서 방금 토글한 상태를 덮어쓰지 않게 한다(fire-and-forget 저장이라
  // 서버 반영 전에 재조회가 먼저 도착할 수 있음).
  const defaultExchangeNames = defaultPreferences.data?.exchange?.excludedSectorNames
  // 실제 오류 원인(거래소 모드 섹터 클릭 시 무한 렌더): useTransientSetting은 저장값이 없을 때 이 초기값을 그대로 스냅샷으로 쓴다.
  // 매 렌더 새 Map이면 스냅샷이 계속 바뀌어 "Maximum update depth exceeded"가 난다. 입력이 바뀔 때만 새로 만든다.
  const initialExchangeExclusions = useMemo(() => {
    const defaultExchangeSelection = new Set(Array.isArray(defaultExchangeNames) ? defaultExchangeNames.filter((item): item is string => typeof item === 'string') : [])
    return excludedNamesForPaths(rootNodes, [...defaultExchangeSelection])
  }, [rootNodes, defaultExchangeNames])
  const [exchangeExcludedSectorNames, setExchangeExcludedSectorNames] = useTransientSetting<Map<number, string>>(
    'heatmap.excludedSectorNames.exchange',
    initialExchangeExclusions,
  )

  // 예방 조치: 기본값 배열도 트리가 바뀔 때만 새로 만든다. 매 렌더 새 배열이면 useTransientSetting 스냅샷이 계속 바뀌어 무한 렌더가 될 수 있다(비로그인 MARKETRY 제외).
  // 이 경로는 재현되지 않았고, 실제 재현된 무한 렌더는 거래소 모드(아래 주석)였다.
  // 지우지 말 것: 예방 장치다. useMemo를 빼고 매 렌더 새 배열을 다시 넘기지 말 것.
  const seededMarketryExcludedKeys = useMemo(() => seedExcludedSectorKeys(rootNodes), [rootNodes])
  const [savedMarketryExcludedKeys, setSavedMarketryExcludedKeys] = usePageSetting<string[]>(
    profileSettingKey('marketry', 'heatmap.excludedSectorKeys'), seededMarketryExcludedKeys,
  )
  const [guestMarketryExcludedKeys, setGuestMarketryExcludedKeys] = useTransientSetting<string[]>(
    'heatmap.excludedSectorKeys.marketry.guest', savedMarketryExcludedKeys,
  )
  const marketryExcludedSectorNames = useMemo(
    () => excludedNamesForStableKeys(rootNodes, isLoggedIn ? savedMarketryExcludedKeys : guestMarketryExcludedKeys),
    [rootNodes, isLoggedIn, savedMarketryExcludedKeys, guestMarketryExcludedKeys],
  )
  useEffect(() => {
    if (!isMarketry || !isLoggedIn || !preferencesLoaded || !data || !isHeatmapSuccess || readOnly) return
    // 거래소·MARKETRY 제외 업종은 이 브라우저에 저장한다(서버에 두지 않는다). 브라우저 값을 읽고 브라우저에 쓴다.
    const key = profileSettingKey('marketry', 'heatmap.excludedSectorKeys')
    const stored = readBrowserSetting(key)
    const saved = stored.found ? stored.value : undefined
    if (!Array.isArray(saved)) return
    const available = new Set<string>()
    const collect = (nodes: HeatmapSectorNode[]) => nodes.forEach(node => {
      if (node.stableKey) available.add(node.stableKey)
      collect(node.children)
    })
    collect(data.items)
    const pruned = saved.filter((value): value is string => typeof value === 'string' && available.has(value))
    if (pruned.length === saved.length) return
    writeBrowserSetting(key, pruned)
    notifySettingsChanged()
  }, [isMarketry, isLoggedIn, preferencesLoaded, data, isHeatmapSuccess, readOnly])
  const excludedSectorNames = isMarketry ? marketryExcludedSectorNames : isCustom ? mineExcludedSectorNames : exchangeExcludedSectorNames
  const setExcludedSectorNames = isMarketry
    ? (next: Map<number, string> | ((previous: Map<number, string>) => Map<number, string>)) => {
      const value = typeof next === 'function' ? next(marketryExcludedSectorNames) : next
      const keys = [...value.keys()].map(id => stableKeyForSectorId(rootNodes, id)).filter((key): key is string => key !== null)
      if (isLoggedIn) setSavedMarketryExcludedKeys(keys)
      else setGuestMarketryExcludedKeys(keys)
    }
    : isCustom ? setMineExcludedSectorNames : setExchangeExcludedSectorNames

  useEffect(() => {
    if (!data) return
    if (readOnly) return
    // 비로그인의 거래소 제외 목록은 서버 값이 아니라 이 탭에서 직접 고른 것이라 서버 값으로 다시 채우지 않는다.
    // 내 분류의 서버 isExcluded 값은 분류 데이터가 기준이다. MARKETRY 제외 목록은 stable key로
    // 프로필 설정에 저장하므로 업로드된 트리의 numeric ID를 다시 저장하지 않는다.
    if (!isCustom) return
    const seedKey = `mine:${session?.userId ?? 'anonymous'}`
    try {
      if (lastSeededExclusionKey === seedKey) return
      lastSeededExclusionKey = seedKey
    } catch {
      // 기억하지 못해도 다음 트리 응답 때 서버 값으로 다시 채운다.
    }
    setMineExcludedSectorNames(seedExcludedSectorNames(data.items, []))
  }, [data, isCustom, session?.userId, setMineExcludedSectorNames, readOnly])

  const captureExcluded = telegramCaptureSetting.data?.values?.excludedSectors
  const snapshotExcludedSectorNames = readOnly && data
    ? isTelegramCapture
      ? excludedNamesForStableKeys(data.items, captureExcluded?.map(([key]) => key) ?? seedExcludedSectorKeys(data.items))
      : marketryExcludedSectorNames
    : excludedSectorNames

  // 로그인 사용자의 거래소 분류 트리는 사용자 정의 섹터를 쓰지 않으므로 isExcluded와 제외 목록을 적용하지 않는다.
  // 비로그인은 거래소 분류만 쓰지만 직접 고른 제외 목록을 이 탭에서 적용한다(새로고침하면 초기화).
  // MARKETRY는 읽기 전용이라 이 탭에서만 제외한다.
  const excludedSectorIds = useMemo(
    () => (usesCustomTree || !isLoggedIn) && sectorFilterEnabled
      ? new Set(isTelegramCapture && captureExcluded
        ? excludedNamesForStableKeys(rootNodes, captureExcluded.map(([key]) => key)).keys()
        : excludedSectorNames.keys())
      : new Set<number>(),
    [usesCustomTree, isLoggedIn, sectorFilterEnabled, excludedSectorNames, isTelegramCapture, captureExcluded, rootNodes],
  )
  const exclude = (sectorId: number, sectorName: string) => {
    const path = findSectorPath(rootNodes, sectorId)
    setExcludedSectorNames(prev => new Map(prev).set(sectorId, path ? path.join(' > ') : sectorName))
    // 서버에는 내 분류(본인 데이터)일 때만 저장한다. MARKETRY는 이 브라우저, 비로그인은 이 탭에만 남는다.
    if (isCustom) registerExcludedSector(sectorId).catch(e => console.error('섹터 제외 실패', e))
  }
  const remove = (sectorId: number) => {
    setExcludedSectorNames(prev => {
      const next = new Map(prev)
      next.delete(sectorId)
      return next
    })
    if (isCustom) unregisterExcludedSector(sectorId).catch(e => console.error('섹터 제외 해제 실패', e))
  }
  // 텔레그램 이미지 설정에 남길 [고정 키, 이름].
  const snapshotExcludedSectors = Array.from(snapshotExcludedSectorNames.entries()).flatMap(([id, name]) => {
    const stableKey = stableKeyForSectorId(rootNodes, id)
    return stableKey ? [[stableKey, name] as [string, string]] : []
  })
  return { names: excludedSectorNames, excludedIds: excludedSectorIds, exclude, remove, snapshotExcludedSectors }
}
