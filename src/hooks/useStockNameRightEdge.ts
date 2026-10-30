import { useLayoutEffect, useState, type RefObject } from 'react'
import { publishStockSearchWidth } from '@/utils/stockSearchWidth'

// 종목 표 위 검색창의 너비를 아래 열(기본 "종목명")의 오른쪽 줄에 맞추기 위한 값 — 그 열 머리글 칸의 오른쪽 끝이 기준 왼쪽에서 몇 px인지.
// 기준은 표 영역 왼쪽이고, 검색창이 윗줄에 따로 있으면 leftEl(검색창이 시작하는 곳)을 넘겨 거기서부터 잰다.
// 열 폭은 창 너비에 따라 달라지므로 크기가 바뀔 때마다 다시 잰다. 아직 못 쟀으면 undefined(검색창 기본 너비를 쓴다).
export function useStockNameRightEdge(
  rootRef: RefObject<HTMLElement | null>,
  scrollRef: RefObject<HTMLElement | null>,
  { leftEl = null }: { leftEl?: HTMLElement | null } = {},
): number | undefined {
  const [rightEdge, setRightEdge] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const root = rootRef.current
    const scroller = scrollRef.current
    if (!root || !scroller) return
    const measure = () => {
      // 검색창 오른쪽 끝은 약칭 열의 가운데다. 약칭 열이 안 보이는 표(일반 회원)는 종목명 열과 같은 폭이니 종목명 열 오른쪽에서 반 칸 더 간 곳이다.
      const alias = scroller.querySelector<HTMLElement>('th[data-column-key="alias"]')?.getBoundingClientRect()
      const name = scroller.querySelector<HTMLElement>('th[data-column-key="stockName"]')?.getBoundingClientRect()
      const edge = alias ? (alias.left + alias.right) / 2 : name ? name.right + name.width / 2 : undefined
      if (edge === undefined) return
      const width = Math.round(edge - (leftEl ?? root).getBoundingClientRect().left)
      setRightEdge(width)
      publishStockSearchWidth(width)
    }
    measure()
    scroller.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(scroller)
    if (leftEl) observer.observe(leftEl)
    window.addEventListener('resize', measure)
    return () => {
      scroller.removeEventListener('scroll', measure)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [rootRef, scrollRef, leftEl])
  return rightEdge
}
