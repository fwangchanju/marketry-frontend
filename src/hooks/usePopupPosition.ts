import { useEffect, useLayoutEffect, useState } from 'react'

export interface PopupPosition {
  top: number
  left: number
  openUpward: boolean
  alignRight: boolean
  // 트리거 폭(px) — 트리거와 같은 폭으로 펼치는 팝업이 쓴다.
  width: number
}

// 팝업(섹터 검색창/필터 드롭다운) 공통 로직 — 트리거 기준 위치 계산 + 바깥 클릭/스크롤 시 닫기.
export function usePopupPosition(
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  triggerRef: React.RefObject<HTMLElement | null>,
  popupRef: React.RefObject<HTMLElement | null>,
  onOpen?: () => void,
  // 팝업이 아래로 열렸을 때 화면 밖으로 잘리지 않게, 트리거가 화면 세로 기준 몇 % 아래부터 위로 뒤집을지.
  // 팝업이 클수록(예: 섹터 검색 목록) 더 일찍(작은 값) 뒤집어야 한다.
  flipThreshold = 0.8,
  // 트리거가 화면 우측 끝에 붙어있으면(예: 일괄 변경 버튼) 왼쪽으로 열어야 화면 밖으로 안 잘린다.
  alignRight = false,
  closeOnScroll = true,
) {
  const [position, setPosition] = useState<PopupPosition | null>(null)

  useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const openUpward = rect.bottom > window.innerHeight * flipThreshold
      setPosition({
        top: openUpward ? rect.top : rect.bottom,
        left: alignRight ? rect.right : rect.left,
        openUpward,
        alignRight,
        width: rect.width,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref는 안정적이라 open 시점에만 반응하면 된다
  }, [isOpen])

  // 처음 여는 순간엔 이 컴포넌트가 처음 렌더될 때라 position이 아직 null이라 팝업(및 입력창) 자체가
  // DOM에 없다 — 그 상태에서 onOpen(주로 input.focus())을 호출하면 허공에 걸린다. position이 실제로
  // 채워져서 팝업이 DOM에 나타난 뒤에 따로 포커스를 걸어야, 처음 여는 경우에도 커서가 제대로 간다.
  useEffect(() => {
    if (isOpen && position) onOpen?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onOpen은 매 렌더 새 함수라 deps에 넣으면 무한루프
  }, [isOpen, position])

  useEffect(() => {
    if (!isOpen) return

    const close = () => setIsOpen(false)
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // capture 없이 window 자체의 scroll(페이지 스크롤)만 감지 — capture:true였으면
    // 팝업 내부 목록의 overflow-y-auto 스크롤까지 잡혀서 즉시 닫혀버림.
    const settingsScroller = triggerRef.current?.closest('.settings-panel-tab-content')
    if (closeOnScroll) {
      window.addEventListener('scroll', close)
      settingsScroller?.addEventListener('scroll', close)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      if (closeOnScroll) {
        window.removeEventListener('scroll', close)
        settingsScroller?.removeEventListener('scroll', close)
      }
    }
  }, [closeOnScroll, isOpen, setIsOpen, triggerRef, popupRef])

  return position
}
