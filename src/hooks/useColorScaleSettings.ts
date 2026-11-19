import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePageSetting } from './usePageSetting'
import { usePersistedState } from './usePersistedState'
import { useIsLoggedIn, useSession } from './useSession'
import { useHeatmapColorScale } from './useHeatmapColorScale'
import {
  useCreateCustomScaleThreshold as useCreateHeatmapScaleThreshold,
  useUpdateCustomScaleThreshold as useUpdateHeatmapScaleThreshold,
  useDeleteCustomScaleThreshold as useDeleteHeatmapScaleThreshold,
} from './useHeatmapCustom'
import {
  createDefaultColorScale,
  orderThresholdSaves,
  fixedRankColor,
  DEFAULT_MINUS_THRESHOLDS,
  DEFAULT_ZERO_COLOR,
  resolveLegendSwatches,
  type ColorScaleConfig,
  type ColorScaleThreshold,
} from '@/utils/heatmapColorScale'
import { colorScaleDraftSession } from '@/utils/colorScaleDraftSession'
import { updateDraftParticipant, unregisterDraftParticipant, type DraftScope } from '@/utils/settingsDraft'
import queryClient from '@/api/queryClient'
import { customHeatmapKeys } from './queryKeys'
import { clampBetweenNeighbors } from '@/utils/thresholdBar'
import { MEMBER_DEFAULTS, settingDefaultsFor } from '@/utils/settingDefaults'
import { profileSettingKey, type SettingsProfile } from '@/utils/settingsSchema'
import { buildFixedColorEditorProps, sortedSignRows } from '@/utils/fixedColorEditor'

// 조회 실패/로딩 중이거나 "색상 커스텀 사용"이 꺼져있을 때 쓰는 폴백 — thresholds가 비어있으면 어차피
// 기본 프리셋으로 귀결된다(resolveHeatmapColor/resolveLegendSwatches 참고).
const EMPTY_COLOR_SCALE: ColorScaleConfig = { thresholds: [] }
const DEFAULT_STRONG_INDUSTRY_COLOR = MEMBER_DEFAULTS.strongIndustryColor
const LEGACY_STRONG_INDUSTRY_COLOR = '#eab308'

// 등락률 색상·강조 색상 설정 — 한국·일본·미국이 같은 코드를 쓴다(2026-11-19 사용자 결정: 세 시장이 같은 색을 공유한다).
// 등락률 색상 구간은 계정에 하나만 저장되고 서버 값과 이 화면의 임시값(colorScaleDraftSession)이 시장 화면을 옮겨 다녀도 이어진다.
// 색상 구간은 내 기준(settingsProfile === 'mine')일 때만 고칠 수 있고, 그 밖의 분류에서는 기본 색으로 고정한다.
// participantScope는 상단 저장·되돌리기가 이 색상 구간을 어느 화면 범위의 변경으로 셀지 정한다(한국 'mine', 일본 'japan', 미국 'usa').
export function useColorScaleSettings({
  settingsProfile,
  isTelegramCapture = false,
  participantScope = 'mine',
}: {
  settingsProfile: SettingsProfile
  isTelegramCapture?: boolean
  participantScope?: DraftScope
}) {
  const isLoggedIn = useIsLoggedIn()
  const { data: session, isLoading: isSessionLoading } = useSession()
  const profileDefaults = settingDefaultsFor(isLoggedIn, settingsProfile)
  const profileKey = (key: string) => profileSettingKey(settingsProfile, key)
  const [storedStrongIndustryColor, setStrongIndustryColor] = usePageSetting(
    profileKey('heatmap.strongIndustryColor'),
    profileDefaults.strongIndustryColor,
  )
  const isLegacyStrongIndustryColor = storedStrongIndustryColor.toLowerCase() === LEGACY_STRONG_INDUSTRY_COLOR
  const strongIndustryColor = settingsProfile !== 'mine'
    ? profileDefaults.strongIndustryColor
    : isLegacyStrongIndustryColor ? DEFAULT_STRONG_INDUSTRY_COLOR : storedStrongIndustryColor

  // 스크린샷 렌더러와 로그인 사용자 설정은 저장된 색을 사용한다. 예전 기본 금색 값이 남아 있으면
  // 첫 화면부터 청록색으로 표시하고, sessionStorage 또는 서버 설정에도 새 값을 저장한다.
  useEffect(() => {
    if (settingsProfile === 'mine' && isLegacyStrongIndustryColor) setStrongIndustryColor(DEFAULT_STRONG_INDUSTRY_COLOR)
  }, [isLegacyStrongIndustryColor, setStrongIndustryColor, settingsProfile])

  // 공통 색상 임시값은 페이지가 바뀌어도 저장·되돌리기 전까지 유지한다.
  const colorSession = useSyncExternalStore(colorScaleDraftSession.subscribe, colorScaleDraftSession.getSnapshot)
  const colorOwner = isLoggedIn ? `user:${session?.userId}` : 'guest'
  const colorScaleDraft = colorSession.owner === colorOwner ? colorSession.draft : null
  const colorEditIndices = colorSession.editIndices
  const setColorScaleDraft = colorScaleDraftSession.setDraft
  const setColorEditIndices = colorScaleDraftSession.setEditIndices
  const colorEditSnapshotRef = colorSession.snapshotRef
  const selectedColorPercentRef = colorSession.selectedPercentRef
  const { data: colorScaleServerData } = useHeatmapColorScale()
  const [localColorScale] = usePersistedState<ColorScaleConfig | null>('heatmap.localColorScale', null)
  useEffect(() => {
    if (isSessionLoading || !colorScaleServerData) return
    const initial = !isLoggedIn && localColorScale ? localColorScale : colorScaleServerData
    colorScaleDraftSession.initialize(colorOwner, initial.thresholds.length > 0 ? initial : createDefaultColorScale())
  }, [isSessionLoading, colorScaleServerData, isLoggedIn, localColorScale, colorOwner])
  // "색상 커스텀 사용" 토글 — 순수 로컬(세션스토리지) 상태. draft(=저장 대상)와는 완전히 분리돼 있어서
  // 꺼도 draft에 저장해둔 값은 건드리지 않고, 그냥 실제 지도에 넘기는 값만 빈 스케일(=기본 프리셋)로 바꿔치기한다.
  const [colorCustomOn, setColorCustomOn] = usePageSetting(profileKey('heatmap.colorCustomOn'), profileDefaults.colorCustomOn)
  // 같은 부호/퍼센트에 편집 중인 행이 이미 있는 임계값과 겹치면 편집 중인 값을 우선한다.
  // resolver는 같은 thresholdPercent 중 마지막 값을 유효점으로 삼으므로, 저장 draft의 배열 순서를
  // 바꾸지 않고 렌더링 입력에서만 편집 행을 뒤로 보낸다.
  const editingColorIndexSet = new Set(colorEditIndices)
  const colorScaleDraftForRendering = colorScaleDraft
    ? {
        thresholds: [
          ...colorScaleDraft.thresholds.filter((_, index) => !editingColorIndexSet.has(index)),
          ...colorEditIndices.map(index => colorScaleDraft.thresholds[index]).filter((threshold): threshold is ColorScaleThreshold => threshold !== undefined),
        ],
      }
    : EMPTY_COLOR_SCALE
  // MARKETRY·거래소는 모두 같은 기본 색으로 보여 준다. 사용자가 고친 색은 지우지 않고 내 기준에서만 쓴다.
  const isColorScaleFixed = settingsProfile !== 'mine'
  const usesCustomColorScale = !isTelegramCapture && !isColorScaleFixed && colorCustomOn
  const colorScale = usesCustomColorScale ? colorScaleDraftForRendering : EMPTY_COLOR_SCALE
  const legendSwatches = resolveLegendSwatches(colorScale, {
    // 편집을 시작하기 전부터 비어 있던 부호는 기본 2/5/8 슬롯을 유지한다. 이번 편집으로 처음
    // 비어진 부호만 숨겨 fallback 슬롯이 새로 늘어나는 것을 막는다.
    // 색상 범위 커스텀을 끈 동안에는 지도가 기본 색을 쓰므로 범례도 기본 7칸을 모두 보여준다(흐리게 표시) — 이때는 숨기지 않는다.
    includeFallbacksForEmptySides: !usesCustomColorScale || colorEditIndices.length === 0 || !colorEditSnapshotRef.current
      ? true
      : {
          negative: !colorEditSnapshotRef.current.thresholds.some(threshold => threshold.thresholdPercent < 0),
          positive: !colorEditSnapshotRef.current.thresholds.some(threshold => threshold.thresholdPercent > 0),
        },
  })

  // 설정 사이드바에서 편집 중인 threshold들 — colorScaleDraft.thresholds의 인덱스 목록.
  // edit 모드는 항상 원소 1개, add 모드는 "+"로 여러 개가 될 수 있다. 빈 배열이면 세션 없음.
  const createThresholdMutation = useCreateHeatmapScaleThreshold({ skipGlobalError: true })
  const updateThresholdMutation = useUpdateHeatmapScaleThreshold({ skipGlobalError: true })
  const deleteThresholdMutation = useDeleteHeatmapScaleThreshold({ skipGlobalError: true })
  // 상단 저장이 여러 행의 create/update를 순회하는 비동기 작업이라,
  // 개별 뮤테이션 훅의 isPending 하나만으로는 전체 진행 상태를 못 나타내서 별도로 든다.
  const [isApplyingColorEdit, setIsApplyingColorEdit] = useState(false)

  // 범례 칸·막대 손잡이를 눌러 편집 대상(첫 편집 행)을 바꾼다 — 적용하지 않은 이전 수정은 되돌리지 않고 그대로 두어, 여러 손잡이·상승/하락을 고친 뒤 상단에서 함께 저장하거나 되돌릴 수 있다.
  // 저장된 색이 없는 기본 칸은 그 칸의 기본 값으로 구간을 만들어 편집한다(범례 칸 수는 고정이라 새 칸을 만드는 기능은 없다). 이렇게 채운 기본 칸은 처음 상태(snapshot)에도 같이 넣어 "수정"으로 보지 않는다.
  const handleSelectColorSwatch = (percent: number, color: string) => {
    if (!colorScaleDraft || isApplyingColorEdit) return
    const base = colorEditSnapshotRef.current ?? colorScaleDraft
    colorEditSnapshotRef.current = base
    selectedColorPercentRef.current = percent
    const existingIndex = colorScaleDraft.thresholds.findIndex(threshold => threshold.thresholdPercent === percent)
    const selectFirst = (index: number) => setColorEditIndices(previous => [index, ...previous.filter(item => item !== index)])
    if (existingIndex >= 0) {
      selectFirst(existingIndex)
      return
    }
    const added = { thresholdPercent: percent, color, colorLabel: null }
    colorEditSnapshotRef.current = { ...base, thresholds: [...base.thresholds, added] }
    setColorScaleDraft({ ...colorScaleDraft, thresholds: [...colorScaleDraft.thresholds, added] })
    selectFirst(colorScaleDraft.thresholds.length)
  }
  // 등락률 막대에서 rank번째 구간 경계를 옮긴다 — 상승 구간의 값을 바꾸면 같은 순서의 하락 구간도 같은 값의 거울(-값)로 함께 바뀐다(대칭).
  // 손잡이는 이웃 구간을 넘거나 겹치지 못해서 순서가 밀리거나 같은 값이 생기는 일이 없다. 하락 구간이 아직 없으면 기본 하락 색으로 만든다.
  const handleChangeColorEditRankPercent = (rank: number, wanted: number) => {
    if (!colorScaleDraft || colorEditIndices.length === 0 || isApplyingColorEdit) return
    const positiveRows = sortedSignRows(colorScaleDraft.thresholds, true)
    const negativeRows = sortedSignRows(colorScaleDraft.thresholds, false)
    const target = positiveRows[rank]
    if (!target) return
    const percent = clampBetweenNeighbors(positiveRows.map(row => row.threshold.thresholdPercent), rank, wanted)
    const mirror = negativeRows[rank]
    if (percent === target.threshold.thresholdPercent && mirror?.threshold.thresholdPercent === -percent) return
    let thresholds = colorScaleDraft.thresholds.map((threshold, index) => {
      if (index === target.index) return { ...threshold, thresholdPercent: percent }
      if (index === mirror?.index) return { ...threshold, thresholdPercent: -percent }
      return threshold
    })
    let mirrorIndex = mirror?.index
    if (mirrorIndex === undefined) {
      const fallback = DEFAULT_MINUS_THRESHOLDS[Math.min(rank, DEFAULT_MINUS_THRESHOLDS.length - 1)]
      mirrorIndex = thresholds.length
      thresholds = [...thresholds, { thresholdPercent: -percent, color: fallback.color, colorLabel: fallback.colorLabel }]
    }
    // 색은 정해져 있다 — 상승은 빨강·하락은 파랑의 순서별 명도로 맞춘다(전에 저장된 다른 색도 손잡이를 옮기면 정해진 색이 된다).
    const recolored = thresholds.map(threshold => threshold)
    for (const side of ['up', 'down'] as const) {
      sortedSignRows(recolored, side === 'up').forEach((row, order) => {
        recolored[row.index] = { ...recolored[row.index], ...fixedRankColor(side, order) }
      })
    }
    thresholds = recolored
    setColorScaleDraft({ ...colorScaleDraft, thresholds })
    setColorEditIndices(previous => Array.from(new Set([...previous, target.index, mirrorIndex])))
    const selectedIndex = colorEditIndices[0]
    if (selectedIndex === target.index) selectedColorPercentRef.current = percent
    else if (selectedIndex === mirrorIndex) selectedColorPercentRef.current = -percent
  }
  // 등락률 막대의 손잡이를 눌러 선택만 바꾼다. 미저장 변경은 유지한다.
  // side는 상승/하락 중 어느 쪽 구간의 색을 편집할지 정한다. 막대의 값은 상승 기준이고 하락은 같은 값의 거울이다.
  const handleSelectColorRank = (rank: number, side: 'up' | 'down') => {
    if (!colorScaleDraft) return
    const row = sortedSignRows(colorScaleDraft.thresholds, side === 'up')[rank]
    if (row) handleSelectColorSwatch(row.threshold.thresholdPercent, row.threshold.color)
  }
  const handleSaveColorScale = async () => {
    if (!colorScaleDraft) {
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
      return
    }
    if (!isLoggedIn) throw new Error('로그인이 필요합니다.')
    setIsApplyingColorEdit(true)
    try {
      // 같은 signed percentage가 편집 행과 나머지 draft에 모두 있으면, 사용자가 방금 편집한 값을
      // 남기고 기존 행은 제거한다. 그 외에도 이미 중복된 draft 값은 한 지점으로 정리한다.
      const sessionIndexSet = new Set(colorEditIndices)
      const candidatesByThreshold = new Map<number, { entry: ColorScaleThreshold; edited: boolean }[]>()
      colorScaleDraft.thresholds.forEach((entry, index) => {
        const candidates = candidatesByThreshold.get(entry.thresholdPercent) ?? []
        candidates.push({ entry, edited: sessionIndexSet.has(index) })
        candidatesByThreshold.set(entry.thresholdPercent, candidates)
      })

      const resolvedGroups = Array.from(candidatesByThreshold, ([thresholdPercent, candidates]) => {
        const editedCandidates = candidates.filter(candidate => candidate.edited)
        const winner = editedCandidates.at(-1) ?? candidates.at(-1)!
        // 새 draft 행이 기존 값과 겹치면 기존 id를 재사용해 update한다. 사용자가 수정한 기존 행의
        // id가 있으면 그 id를 유지하고, 겹친 나머지 id는 삭제 대상으로 모은다.
        const savedId = winner.entry.id ?? candidates.find(candidate => candidate.entry.id !== undefined)?.entry.id
        const losingIds = candidates
          .map(candidate => candidate.entry.id)
          .filter((id): id is number => id !== undefined && id !== savedId)
        const saved = savedId === undefined ? undefined : colorEditSnapshotRef.current?.thresholds.find(entry => entry.id === savedId)
        return {
          entry: { ...winner.entry, id: savedId },
          // 선택한 칸뿐 아니라 함께 보정된 색과 아직 저장하지 않은 기본 칸도 저장한다.
          needsSave: !saved || saved.thresholdPercent !== thresholdPercent
            || saved.color !== winner.entry.color || saved.colorLabel !== winner.entry.colorLabel,
          losingIds,
        }
      })
      const retainedIds = new Set(resolvedGroups.map(group => group.entry.id))
      const removedIds = (colorEditSnapshotRef.current?.thresholds ?? [])
        .map(entry => entry.id)
        .filter((id): id is number => id !== undefined && !retainedIds.has(id))
      const idsToDelete = Array.from(new Set([...removedIds, ...resolvedGroups.flatMap(group => group.losingIds)]))
      const entriesToSave = orderThresholdSaves(
        resolvedGroups.filter(group => group.needsSave).map(group => group.entry),
        colorEditSnapshotRef.current?.thresholds ?? [],
        idsToDelete,
      )

      // 같은 thresholdPercent는 백엔드에서 중복 불가이므로, 충돌 행 삭제를 완료한 다음에 저장한다.
      await Promise.all(idsToDelete.map(id => deleteThresholdMutation.mutateAsync(id)))
      // 일부 요청이 성공한 뒤 실패해도 발급받은 id를 임시값에 남겨 재시도 시 중복 생성을 막는다.
      const savedByThreshold = new Map<number, ColorScaleThreshold>()
      try {
        for (const entry of entriesToSave) {
          const payload = { thresholdPercent: entry.thresholdPercent, color: entry.color, colorLabel: entry.colorLabel }
          const saved = entry.id !== undefined
            ? await updateThresholdMutation.mutateAsync({ id: entry.id, payload })
            : await createThresholdMutation.mutateAsync(payload)
          savedByThreshold.set(entry.thresholdPercent, saved)
        }
      } finally {
        setColorScaleDraft({
          thresholds: resolvedGroups.map(group => savedByThreshold.get(group.entry.thresholdPercent) ?? group.entry),
        })
      }
      const savedScale = {
        thresholds: resolvedGroups.map(group => savedByThreshold.get(group.entry.thresholdPercent) ?? group.entry),
      }
      // 다음 페이지에서도 방금 저장한 값을 시드하고, 상단 되돌리기도 이 값을 기준으로 한다.
      queryClient.setQueryData(customHeatmapKeys.scale(), savedScale)
      colorEditSnapshotRef.current = savedScale
      setColorEditIndices([])
    } finally {
      setIsApplyingColorEdit(false)
    }
  }
  const handleDiscardColorScale = () => {
    selectedColorPercentRef.current = colorEditSnapshotRef.current?.thresholds[colorEditIndices[0]]?.thresholdPercent ?? null
    if (colorEditSnapshotRef.current) setColorScaleDraft(colorEditSnapshotRef.current)
    setColorEditIndices([])
  }
  const colorEditThresholds = colorScaleDraft
    ? colorEditIndices.map(i => colorScaleDraft.thresholds[i]).filter((t): t is ColorScaleThreshold => t !== undefined)
    : []
  // 편집 영역을 항상 열어두기 위해, 편집 중인 칸이 없으면(처음, 저장·되돌리기 직후) 마지막으로 보던 칸을 다시 연다.
  useEffect(() => {
    if (!usesCustomColorScale || !colorScaleDraft || colorEditIndices.length > 0 || isApplyingColorEdit) return
    // 처음에는 가장 큰 상승 칸(기본 +12%)을 편집 대상으로 연다.
    const swatch = legendSwatches.find(item => Number.parseFloat(item.label) === selectedColorPercentRef.current)
      ?? legendSwatches.at(-1)
      ?? legendSwatches[0]
    if (swatch) handleSelectColorSwatch(Number.parseFloat(swatch.label), swatch.color)
  })
  // 초기화도 임시 변경이다. 상단 저장 전에는 서버 값을 지우지 않는다.
  const handleResetColorScale = () => {
    if (!colorScaleDraft || isApplyingColorEdit) return
    colorEditSnapshotRef.current ??= colorScaleDraft
    setColorScaleDraft(createDefaultColorScale())
    setColorEditIndices([])
  }
  // 끄더라도 편집 중인 작업은 취소하지 않는다 — 편집 영역이 흐려진 채로 남았다가 다시 켜면 이어서 할 수 있다.
  const handleChangeColorCustomOn = (on: boolean) => {
    setColorCustomOn(on)
  }

  const barPositiveRows = colorScaleDraft ? sortedSignRows(colorScaleDraft.thresholds, true) : []
  const barNegativeRows = colorScaleDraft ? sortedSignRows(colorScaleDraft.thresholds, false) : []
  // 편집 중인 칸이 상승/하락/0% 중 어디인지와, 상승·하락 구간 중 몇 번째인지(0%면 null).
  const selectedBar = (() => {
    const selectedIndex = colorEditIndices[0]
    const selectedThreshold = colorScaleDraft?.thresholds[selectedIndex]
    // 선택된 칸이 없거나 0% 칸이면 상승 쪽으로 보여 준다(0% 칸은 고칠 값이 없어 선택하지 않는다).
    if (!colorScaleDraft || !selectedThreshold || selectedThreshold.thresholdPercent === 0) return { side: 'up' as const, rank: null }
    const up = selectedThreshold.thresholdPercent > 0
    const rank = (up ? barPositiveRows : barNegativeRows).findIndex(row => row.index === selectedIndex)
    return { side: up ? ('up' as const) : ('down' as const), rank: rank < 0 ? null : rank }
  })()
  // 저장값(snapshot)과 지금 draft의 구간·색이 하나라도 다르면 "미저장 변경"이 있는 것이다(여러 손잡이·상승/하락을 고친 경우 포함).
  const thresholdSignature = (thresholds: ColorScaleThreshold[] | undefined) =>
    (thresholds ?? []).map(threshold => `${threshold.thresholdPercent}:${threshold.color.toLowerCase()}`).sort().join('|')
  const colorEditHasChanges = colorEditSnapshotRef.current !== null
    && thresholdSignature(colorEditSnapshotRef.current.thresholds) !== thresholdSignature(colorScaleDraft?.thresholds)

  useEffect(() => {
    // 색상 구간은 내 기준 모드에서만 고칠 수 있다(isColorScaleFixed). 다른 분류의 변경 점·저장·되돌리기에 섞이지 않게 내 기준 전용으로 등록한다.
    updateDraftParticipant('heatmap.colorScale', {
      hasChanges: colorEditHasChanges,
      save: handleSaveColorScale,
      discard: handleDiscardColorScale,
      scope: participantScope,
    })
  })
  useEffect(() => () => unregisterDraftParticipant('heatmap.colorScale'), [])

  // 고정 모드는 사용자가 고친 값 대신 기본 색 막대를 어둡게 보여 준다. 조작은 설정창이 막으므로 동작은 비워 둔다.
  const colorEditorPanelProps = isColorScaleFixed
    ? buildFixedColorEditorProps()
    : colorEditThresholds.length > 0
      ? {
          bar: {
            positive: barPositiveRows.map(row => ({ percent: row.threshold.thresholdPercent, color: row.threshold.color })),
            negative: barNegativeRows.map(row => ({ percent: -row.threshold.thresholdPercent, color: row.threshold.color })),
            side: selectedBar.side,
            selectedRank: selectedBar.rank,
            zeroColor: colorScaleDraft?.thresholds.find(threshold => threshold.thresholdPercent === 0)?.color ?? DEFAULT_ZERO_COLOR,
          },
          onChangeRankPercent: handleChangeColorEditRankPercent,
          onSelectRank: handleSelectColorRank,
        }
      : null

  return {
    strongIndustryColor,
    setStrongIndustryColor,
    colorScaleDraft,
    colorCustomOn,
    onChangeColorCustomOn: handleChangeColorCustomOn,
    onSelectColorSwatch: handleSelectColorSwatch,
    onResetColorScale: handleResetColorScale,
    isResettingColorScale: isApplyingColorEdit,
    legendSwatches,
    colorScale,
    usesCustomColorScale,
    isColorScaleFixed,
    colorEditorPanelProps,
  }
}
