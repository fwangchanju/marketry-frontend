import { useEffect, useState } from 'react'

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
