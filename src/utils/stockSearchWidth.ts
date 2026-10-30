import { useEffect, useState } from 'react'
import { estimateSearchRightEdgePx } from '@/utils/stockTableColumns'

const STORAGE_KEY = 'custom.stockSearchWidthPx'
const EVENT_NAME = 'custom-stock-search-width'

export function getStockSearchWidth(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const value = Number(window.sessionStorage.getItem(STORAGE_KEY))
  return Number.isFinite(value) && value > 0 ? value : undefined
}

export function publishStockSearchWidth(width: number) {
  if (typeof window === 'undefined' || !Number.isFinite(width) || width <= 0) return
  window.sessionStorage.setItem(STORAGE_KEY, String(width))
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: width }))
}

export function useStockSearchWidth() {
  const [width, setWidth] = useState<number | undefined>(getStockSearchWidth)
  useEffect(() => {
    const update = (event: Event) => setWidth((event as CustomEvent<number>).detail)
    window.addEventListener(EVENT_NAME, update)
    return () => window.removeEventListener(EVENT_NAME, update)
  }, [])
  return width
}

// 업종 화면용 — 종목 표의 약칭 열 가운데에 맞춘 검색창 너비다. 화면 너비가 바뀌어도 맞도록 지금 위 줄 너비로 어림한다.
// 종목 표와 같은 기준으로, 검색창이 시작하는 위치(툴바)에서 약칭 열 가운데까지의 거리를 돌려준다(표는 위 줄과 같은 왼쪽·너비에서 시작한다).
// 종목 표를 열어 실제로 잰 값이 있어도 옛 너비일 수 있어 쓰지 않는다.
export function useStockSearchWidthEstimate(toolbarContainer: HTMLElement | null | undefined) {
  const [width, setWidth] = useState<number | undefined>(undefined)
  useEffect(() => {
    const row = toolbarContainer?.parentElement
    if (!toolbarContainer || !row) return
    const update = () => {
      const rowRect = row.getBoundingClientRect()
      const edge = rowRect.left + estimateSearchRightEdgePx(rowRect.width)
      setWidth(Math.round(edge - toolbarContainer.getBoundingClientRect().left))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(row)
    observer.observe(toolbarContainer)
    return () => observer.disconnect()
  }, [toolbarContainer])
  return width
}
