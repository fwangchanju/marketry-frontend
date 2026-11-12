import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { computeStockColumnWidths, type StockColumnWidths } from '@/utils/stockTableColumns'

// 종목 표가 들어가는 영역의 너비로 국내 종목 표의 칸 폭(좌표)을 계산한다. 영역 너비가 바뀌면 다시 계산한다.
// 영역이 처음 그려질 때 없다가 나중에 생기거나 다른 요소로 바뀌어도 따라가도록, 렌더마다 지금 영역이 재던 요소와 같은지 확인한다
// (처음 한 번만 재면 영역이 늦게 생기는 화면에서 기본 너비가 그대로 남아 칸이 비율대로 늘어난다).
export function useStockColumnWidths(containerRef: RefObject<HTMLElement | null>, fallbackWidth = 1130): StockColumnWidths {
  const [widths, setWidths] = useState(() => computeStockColumnWidths(fallbackWidth))
  const observed = useRef<{ element: HTMLElement | null; observer: ResizeObserver | null }>({ element: null, observer: null })
  useLayoutEffect(() => {
    const element = containerRef.current
    if (element === observed.current.element) return
    observed.current.observer?.disconnect()
    observed.current = { element, observer: null }
    if (!element) return
    const update = () => {
      const next = computeStockColumnWidths(element.clientWidth)
      setWidths(previous => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    observed.current.observer = observer
    update()
  })
  // 정리할 때 관찰 기록도 비워 둔다 — 화면이 다시 켜질 때(개발 모드의 재실행 포함) 영역을 다시 관찰하게 한다.
  useEffect(() => () => {
    observed.current.observer?.disconnect()
    observed.current = { element: null, observer: null }
  }, [])
  return widths
}
