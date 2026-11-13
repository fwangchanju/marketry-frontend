import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLeaveToEntryPage } from '@/hooks/useLeaveToEntryPage'
import { appAlert } from '@/utils/appDialogBus'

// 지도(한국·일본·미국)에서 분류를 한 단계씩 들어가고 나오는 것을 브라우저 기록과 키보드에 이어 준다.
// 한국 지도(MapPage)에 있던 처리를 그대로 옮긴 공통 부품이다 — 세 지도가 같이 쓴다(2026-11-14).
// 정리: path = 지금 들어가 있는 분류 경로, setPath = 경로를 직접 바꾸기, zoomOutRequestDepth = 줌아웃 애니메이션 중인 목표 깊이,
// handleGoToDepth = 위로 가는 줌아웃을 요청하는 함수, isShareOpen = 공유 팝업이 떠 있는지(떠 있으면 백스페이스를 쓰지 않는다).
// 돌려주는 markEntryFromOtherPage는 다른 페이지(그래프)에서 업종을 눌러 들어온 경우 그 칸을 기준 칸으로 삼게 알린다.
export function useMapDrilldownHistory({
  path,
  setPath,
  zoomOutRequestDepth,
  handleGoToDepth,
  isShareOpen,
}: {
  path: string[]
  setPath: (path: string[]) => void
  zoomOutRequestDepth: number | null
  handleGoToDepth: (depth: number) => void
  isShareOpen: boolean
}) {
  // 들어간 단계 = 브라우저 기록 한 칸. 분류에 한 단계 들어갈 때마다 기록에 한 칸씩 쌓아서(직접 깊은 단계로
  // 들어가면 그 단계 수만큼), 브라우저 뒤로가기(⌘[, 트랙패드 스와이프, 마우스 뒤로가기 버튼)를 연달아
  // 눌러도 칸이 있는 만큼 계속 한 단계씩 올라간다. 전체 화면에서 더 누르면 원래대로 사이트 이전 페이지로
  // 나간다. 앞으로가기(⌘])는 들어갔던 단계로 다시 내려간다. 각 칸은 그 시점의 경로(heatmapPath)를 가진다.
  const historyDepthRef = useRef(0) // 지금 브라우저 기록 위치가 가리키는 깊이
  const historyConsumingRef = useRef(false) // 코드가 일으킨 history.go()의 popstate는 무시한다
  const historyPathnameRef = useRef('') // 기록 칸을 쌓은 주소 — 다른 주소로 이동했으면 go()로 정리하지 않는다
  const prevPathLengthRef = useRef(0)
  // 다른 페이지(그룹)에서 업종을 눌러 들어온 칸 — 그 칸이 곧 기준 칸이다. 기준 칸의 깊이(평소 0, 그룹에서 중분류로 들어오면 2)보다 얕은 단계는 기록 칸이 없다.
  const entryFromOtherPageRef = useRef(false)
  const baseDepthRef = useRef(0)
  const pendingBasePathRef = useRef<string[] | null>(null) // history.go()가 끝난 뒤 기준 칸에 적을 경로
  const pendingUpDepthRef = useRef<number | null>(null)

  // 위로 가는 요청 — 줌아웃 애니메이션 중이면 가장 위쪽 목표 깊이만 기억해 뒀다가 끝나면 이어서 처리한다.
  const requestDepth = (target: number) => {
    if (zoomOutRequestDepth !== null) {
      pendingUpDepthRef.current = pendingUpDepthRef.current === null ? target : Math.min(pendingUpDepthRef.current, target)
      return
    }
    handleGoToDepth(target)
  }
  useEffect(() => {
    if (zoomOutRequestDepth !== null || pendingUpDepthRef.current === null) return
    const target = pendingUpDepthRef.current
    pendingUpDepthRef.current = null
    if (target < path.length) handleGoToDepth(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleGoToDepth는 매 렌더 새 함수
  }, [zoomOutRequestDepth, path.length])

  // 경로 길이가 바뀔 때 기록을 맞춘다 — 들어갈 때는 칸을 쌓고, 버튼/백스페이스/시장 전환 등으로 올라올 때는
  // 남은 칸을 history.go()로 정리한다(뒤로가기로 올라온 경우는 이미 칸이 소모돼 있어 할 일이 없다).
  useEffect(() => {
    const depth = path.length
    const previous = prevPathLengthRef.current
    prevPathLengthRef.current = depth
    if (depth > previous) {
      if (entryFromOtherPageRef.current) {
        // 그룹에서 들어온 칸: 새 칸을 쌓지 않고 지금 칸에 경로를 적어 기준 칸으로 삼는다.
        entryFromOtherPageRef.current = false
        window.history.replaceState({ ...(window.history.state ?? {}), heatmapPath: path }, '')
        baseDepthRef.current = depth
        historyDepthRef.current = depth
        historyPathnameRef.current = window.location.pathname
      } else if (depth > historyDepthRef.current) {
        for (let k = historyDepthRef.current + 1; k <= depth; k++) {
          window.history.pushState({ ...(window.history.state ?? {}), heatmapPath: path.slice(0, k) }, '')
        }
        historyDepthRef.current = depth
        historyPathnameRef.current = window.location.pathname
      }
    } else if (depth < previous) {
      // 위로 올라올 때: 기준 칸 위에 쌓인 칸만 history.go()로 정리한다(기준 칸까지 지우면 그룹으로 나가 버린다).
      const floor = Math.max(depth, baseDepthRef.current)
      let consuming = false
      if (floor < historyDepthRef.current) {
        const stale = historyDepthRef.current - floor
        historyDepthRef.current = floor
        if (window.location.pathname === historyPathnameRef.current) {
          historyConsumingRef.current = true
          window.history.go(-stale)
          consuming = true
        }
      }
      // 기준 칸보다 얕은 단계로 올라오면 기준 칸이 그 얕은 경로를 가리키게 고친다(안 그러면 나중에 이 칸으로 돌아왔을 때 처음 깊이로 되돌아간다).
      if (depth < baseDepthRef.current) {
        baseDepthRef.current = depth
        historyDepthRef.current = depth
        if (consuming) pendingBasePathRef.current = path.slice(0, depth)
        else window.history.replaceState({ ...(window.history.state ?? {}), heatmapPath: path.slice(0, depth) }, '')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 길이가 바뀔 때만 반응하면 된다(path 내용은 그때의 값을 쓴다)
  }, [path.length])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (historyConsumingRef.current) {
        historyConsumingRef.current = false
        if (pendingBasePathRef.current !== null) {
          window.history.replaceState({ ...(window.history.state ?? {}), heatmapPath: pendingBasePathRef.current }, '')
          pendingBasePathRef.current = null
        }
        return
      }
      // 이 지도 화면 안에서의 이동만 다룬다 — 다른 페이지로 나가는 뒤로가기는 그대로 둔다.
      if (!window.location.pathname.startsWith('/map')) return
      const target: string[] = Array.isArray(e.state?.heatmapPath) ? e.state.heatmapPath : []
      historyDepthRef.current = target.length
      if (target.length < path.length) requestDepth(target.length)
      else if (target.length > path.length) setPath(target)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestDepth/handleGoToDepth는 매 렌더 새 함수이고 path/zoomOutRequestDepth로 충분히 갱신된다
  }, [path, zoomOutRequestDepth])

  // 백스페이스 = 브라우저 뒤로가기와 같다(한 단계 위로). 돌아가는 버튼이 눈에 잘 안 띄어서 백스페이스를 누르는
  // 경우가 많다. 글자를 입력하는 중(입력창/편집 영역)이거나 수정키가 같이 눌렸거나 공유 팝업이 떠 있거나
  // 이미 전체 화면이면 동작하지 않고, 키를 계속 누르고 있어도(자동 반복) 한 번만 동작한다.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' || e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const target = e.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (isShareOpen || historyDepthRef.current <= 0) return
      e.preventDefault()
      window.history.back()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isShareOpen])

  return {
    markEntryFromOtherPage: (isFromOtherPage: boolean) => {
      entryFromOtherPageRef.current = isFromOtherPage
    },
  }
}


// 그래프에서 업종을 눌러 온 주소(?sector=이름) — 데이터가 준비되면 그 업종을 누른 상태로 열고 주소에서 지운다.
// 못 찾으면 안내하고 닫으면 들어온 곳으로 돌려보낸다. 한국 지도(MapPage)에 있던 처리를 그대로 옮긴 공통 부품이다.
export function useMapSectorEntry({
  filteredRootNodes,
  enterSector,
  pathLength,
  markEntryFromOtherPage,
}: {
  filteredRootNodes: readonly unknown[]
  enterSector: (sectorName: string) => string[] | null
  pathLength: number
  markEntryFromOtherPage: (isFromOtherPage: boolean) => void
}) {
  // 안내창을 닫으면 들어온 곳(Home·Graph)으로 돌려보낸다.
  const leaveToEntryPage = useLeaveToEntryPage()
  const [searchParams, setSearchParams] = useSearchParams()

  // 그룹 페이지에서 업종을 눌러 온 주소(?sector=이름) — 데이터가 준비되면 그 업종을 누른 상태로 열고 주소에서 지운다.
  // 못 찾으면 안내한다. 개발 모드의 효과 두 번 실행에도 안내창이 한 번만 뜨게, 안내한 이름을 기억해 둔다.
  const sectorParam = searchParams.get('sector')
  const noticedSectorRef = useRef<string | null>(null)
  useEffect(() => {
    if (!sectorParam) {
      noticedSectorRef.current = null
      return
    }
    if (filteredRootNodes.length === 0) return
    // 그룹 페이지에서 들어온 칸은 단계별로 기록을 쌓지 않고 그 자체를 기준 칸으로 삼는다 — 뒤로가기를 한 번 누르면 바로 그룹으로 돌아간다.
    // (지금보다 더 깊은 경로로 들어갈 때만 — 깊이가 같거나 얕으면 새 칸이 필요 없다.)
    const entered = enterSector(sectorParam)
    markEntryFromOtherPage(entered !== null && entered.length > pathLength)
    if (entered === null && noticedSectorRef.current !== sectorParam) {
      noticedSectorRef.current = sectorParam
      void appAlert('해당 업종을 찾지 못했습니다.\n이전 화면으로 돌아갑니다.', { title: '이동 실패' }).then(leaveToEntryPage)
    }
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('sector')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 주소 값이 있고 트리가 준비됐을 때만 반응하면 된다(enterSector는 매 렌더 새 함수)
  }, [sectorParam, filteredRootNodes])
}
