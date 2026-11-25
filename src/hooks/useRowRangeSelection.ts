import { useCallback, useEffect, useRef, useState, type Dispatch, type MouseEvent, type RefObject, type SetStateAction } from 'react'

// 표 줄 선택 — 줄을 누르면 토글하고, Shift+클릭으로 직전에 누른 줄부터 범위를 선택하고, 줄을 누른 채 끌면 지나간 줄들을
// 한 번에 선택(또는 해제)한다. 표 위·아래 가장자리에 닿으면 그쪽으로 자동 스크롤한다. 종목 표(StockTable)와 관리자 표가 쓴다.
//
// keys는 화면에 보이는 순서대로의 줄 키 목록이고, 각 <tr>에는 rowProps(index)를 펼쳐 준다(data-row-index가 좌표로 줄을
// 찾는 데 쓰인다).
const EDGE_PX = 40
// 여러 줄 선택 안내 — 드래그나 Shift+클릭을 모른 채 줄을 하나씩 계속 누르는 사용자에게 한 번 알려준다. 페이지를 새로 열 때마다 처음부터 다시 센다(저장하지 않는다).
// 한 번 보여주거나 드래그·Shift를 쓰면 그 표에서는 다시 띄우지 않는다.
const HINT_CLICK_COUNT = 3
const HINT_DURATION_MS = 6000
const MAX_SCROLL_PX = 24

interface DragState {
  anchorIndex: number
  baseline: Set<string>
  selectTo: boolean
  moved: boolean
  lastIndex: number
  pointer: { x: number; y: number }
}

export function useRowRangeSelection(
  keys: readonly string[],
  scrollContainerRef: RefObject<HTMLElement | null>,
  selected: ReadonlySet<string>,
  setSelected: Dispatch<SetStateAction<ReadonlySet<string>>>,
) {
  const keysRef = useRef(keys)
  const selectedRef = useRef(selected)
  useEffect(() => {
    keysRef.current = keys
    selectedRef.current = selected
  }, [keys, selected])

  const dragRef = useRef<DragState | null>(null)
  // 끌기를 마친 직후 따라오는 click이 한 줄을 다시 토글하지 않게 막는 표시.
  const suppressClickRef = useRef(false)
  const lastClickedKeyRef = useRef<string | null>(null)
  const dragFrameRef = useRef<number | null>(null)

  const [isHintOpen, setIsHintOpen] = useState(false)
  const plainClickCountRef = useRef(0)
  const hintShownRef = useRef(false)
  const noteMultiSelectUsed = useCallback(() => {
    hintShownRef.current = true
    setIsHintOpen(false)
  }, [])
  useEffect(() => {
    if (!isHintOpen) return
    const timer = setTimeout(() => setIsHintOpen(false), HINT_DURATION_MS)
    return () => clearTimeout(timer)
  }, [isHintOpen])

  // 마우스 아래의 줄을 좌표로 찾아 선택 범위를 갱신한다. 표가 보이는 줄만 그려서 자동 스크롤 중에는 mouseenter보다
  // 좌표로 찾는 편이 확실하고, 마우스가 표 밖(위·아래)에 있어도 가장자리 줄로 본다.
  const applyDragAtPointer = useCallback(() => {
    const drag = dragRef.current
    const container = scrollContainerRef.current
    if (!drag || !container) return
    const rect = container.getBoundingClientRect()
    const y = Math.min(Math.max(drag.pointer.y, rect.top + 1), rect.bottom - 1)
    const row = document.elementFromPoint(drag.pointer.x, y)?.closest<HTMLElement>('tr[data-row-index]')
    if (!row) return
    const index = Number(row.dataset.rowIndex)
    if (!drag.moved && index === drag.anchorIndex) return
    if (!drag.moved) {
      drag.moved = true
      document.body.style.userSelect = 'none'
    }
    if (index === drag.lastIndex) return
    drag.lastIndex = index
    // baseline에서 매번 다시 계산하므로 마우스를 되돌리면 선택 범위도 줄어든다.
    const next = new Set(drag.baseline)
    const from = Math.min(drag.anchorIndex, index)
    const to = Math.max(drag.anchorIndex, index)
    for (let i = from; i <= to; i++) {
      const key = keysRef.current[i]
      if (key === undefined) continue
      if (drag.selectTo) next.add(key)
      else next.delete(key)
    }
    setSelected(next)
  }, [scrollContainerRef, setSelected])

  useEffect(() => {
    const tick = () => {
      const drag = dragRef.current
      const container = scrollContainerRef.current
      if (!drag || !container) {
        dragFrameRef.current = null
        return
      }
      if (drag.moved) {
        const rect = container.getBoundingClientRect()
        let delta = 0
        if (drag.pointer.y < rect.top + EDGE_PX) {
          delta = -Math.min(MAX_SCROLL_PX, Math.ceil((MAX_SCROLL_PX * (rect.top + EDGE_PX - drag.pointer.y)) / EDGE_PX))
        } else if (drag.pointer.y > rect.bottom - EDGE_PX) {
          delta = Math.min(MAX_SCROLL_PX, Math.ceil((MAX_SCROLL_PX * (drag.pointer.y - (rect.bottom - EDGE_PX))) / EDGE_PX))
        }
        if (delta !== 0) {
          container.scrollTop += delta
          applyDragAtPointer()
        }
      }
      dragFrameRef.current = requestAnimationFrame(tick)
    }
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      drag.pointer = { x: event.clientX, y: event.clientY }
      applyDragAtPointer()
      if (dragFrameRef.current === null) dragFrameRef.current = requestAnimationFrame(tick)
    }
    const stopDrag = () => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      document.body.style.userSelect = ''
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current)
        dragFrameRef.current = null
      }
      if (drag.moved) {
        noteMultiSelectUsed()
        // 끌기가 끝난 직후의 click(같은 줄에서 뗀 경우)은 선택을 다시 뒤집지 않도록 한 번만 무시한다.
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopDrag)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopDrag)
      stopDrag()
    }
  }, [applyDragAtPointer, scrollContainerRef, noteMultiSelectUsed])

  const toggle = useCallback(
    (key: string, shiftKey: boolean) => {
      if (suppressClickRef.current) return
      if (shiftKey) {
        noteMultiSelectUsed()
      } else if (!selectedRef.current.has(key)) {
        // 하나씩 눌러서 선택을 늘리는 횟수만 센다(해제는 세지 않는다).
        plainClickCountRef.current += 1
        if (plainClickCountRef.current >= HINT_CLICK_COUNT && !hintShownRef.current) {
          hintShownRef.current = true
          setIsHintOpen(true)
        }
      }
      const anchorKey = lastClickedKeyRef.current
      lastClickedKeyRef.current = key
      setSelected(previous => {
        const next = new Set(previous)
        if (shiftKey && anchorKey && anchorKey !== key) {
          const anchorIndex = keysRef.current.indexOf(anchorKey)
          const clickedIndex = keysRef.current.indexOf(key)
          // 기준 줄이 검색으로 화면에서 사라졌으면 범위를 알 수 없으니 평소처럼 한 줄만 토글한다.
          if (anchorIndex >= 0 && clickedIndex >= 0) {
            // 범위 전체에 기준 줄의 지금 상태(선택됨/해제됨)를 적용한다 — 탐색기·메일 목록과 같은 방식.
            const select = previous.has(anchorKey)
            const from = Math.min(anchorIndex, clickedIndex)
            const to = Math.max(anchorIndex, clickedIndex)
            for (let i = from; i <= to; i++) {
              const rangeKey = keysRef.current[i]
              if (select) next.add(rangeKey)
              else next.delete(rangeKey)
            }
            return next
          }
        }
        if (!next.delete(key)) next.add(key)
        return next
      })
    },
    [setSelected, noteMultiSelectUsed],
  )

  const rowProps = (index: number) => {
    const key = keys[index]
    return {
      'data-row-index': index,
      onClick: (event: MouseEvent<HTMLTableRowElement>) => toggle(key, event.shiftKey),
      onMouseDown: (event: MouseEvent<HTMLTableRowElement>) => {
        // Shift+클릭이 브라우저의 글자 범위 선택(파란 표시)을 일으키지 않게 한다.
        if (event.shiftKey) {
          event.preventDefault()
          return
        }
        // 고치는 칸(data-no-row-select)에서는 드래그 선택을 시작하지 않는다.
        if (event.button !== 0 || (event.target as HTMLElement).closest('[data-no-row-select]')) return
        // Shift+클릭 범위가 이 줄에서 이어지도록 기준 줄도 같이 기억한다.
        lastClickedKeyRef.current = key
        dragRef.current = {
          anchorIndex: index,
          baseline: new Set(selectedRef.current),
          selectTo: !selectedRef.current.has(key),
          moved: false,
          lastIndex: index,
          pointer: { x: event.clientX, y: event.clientY },
        }
      },
    }
  }

  return { rowProps, selectionHint: { isOpen: isHintOpen, close: () => setIsHintOpen(false) } }
}
