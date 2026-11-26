import { useEffect, type RefObject } from 'react'

// MOBILE 팝업이 떠 있을 때 바깥을 누르면 팝업만 닫히고, 그 손가락이 아래 화면(업종 막대·지도 칸)까지 눌러 이동하지 않게 한다
// (2026-11-27 사용자 제보: 그래프에서 팝업이 뜬 채 업종명을 누르면 닫히면서 하위 업종으로 들어감).
// 팝업은 바깥 누름(pointerdown)에서 닫혀 사라지므로, 뒤따르는 click을 막는 일은 팝업 수명과 무관하게 여기서 한 번만 처리한다.
const SWALLOW_TIMEOUT_MS = 800
let pending: (() => void) | null = null

export function swallowNextClick() {
  pending?.()
  const onClick = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    clear()
  }
  // 누른 채 밀기처럼 click이 오지 않는 경우는 다음 누름이나 시간 초과로 풀어 준다.
  const onNextDown = () => clear()
  const timer = window.setTimeout(() => clear(), SWALLOW_TIMEOUT_MS)
  const clear = () => {
    window.removeEventListener('click', onClick, true)
    window.removeEventListener('pointerdown', onNextDown, true)
    window.clearTimeout(timer)
    if (pending === clear) pending = null
  }
  window.addEventListener('click', onClick, true)
  // 지금 누름(이 함수를 부른 pointerdown) 뒤의 다음 누름부터 센다.
  window.setTimeout(() => { if (pending === clear) window.addEventListener('pointerdown', onNextDown, true) }, 0)
  pending = clear
}

// 팝업이 열려 있는 동안, 팝업(과 여는 버튼) 바깥을 누르면 그 누름의 click을 막는다. 닫는 일은 각 팝업이 지금처럼 한다.
export function useSwallowOutsideTap(enabled: boolean, insideRefs: RefObject<HTMLElement | null>[]) {
  useEffect(() => {
    if (!enabled) return
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && insideRefs.some(ref => ref.current?.contains(target))) return
      swallowNextClick()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
    // insideRefs는 ref 객체라 매번 같은 값이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])
}
