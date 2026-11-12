import { useLayoutEffect, useState, type RefObject } from 'react'
import { computeStockColumnWidths, type StockColumnWidths } from '@/utils/stockTableColumns'

// 종목 표가 들어가는 영역의 너비로 국내 종목 표의 칸 폭(좌표)을 계산한다. 영역 너비가 바뀌면 다시 계산한다.
export function useStockColumnWidths(containerRef: RefObject<HTMLElement | null>, fallbackWidth = 1130): StockColumnWidths {
  const [widths, setWidths] = useState(() => computeStockColumnWidths(fallbackWidth))
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => setWidths(computeStockColumnWidths(container.clientWidth))
    const observer = new ResizeObserver(update)
    observer.observe(container)
    update()
    return () => observer.disconnect()
  }, [containerRef])
  return widths
}
