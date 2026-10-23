import { useEffect, useRef, type RefObject } from 'react'

// 홈 화면 항목 끌기(PointerSensor)와 같은 시작 거리다.
const DRAG_START_DISTANCE = 5
// 홈 화면 항목 끌기와 같은 효과 — 끄는 동안 끌리는 항목이 반투명(60%)으로 맨 위에 떠서 포인터를 따라 움직인다.
const DRAG_OPACITY = '0.6'

export interface StockDrop {
  stockCode: string
  stockName: string
  targetSectorId: number
  targetSectorName: string
}

// 실험 탭의 "종목 이동" — 종목 박스(data-stock-code)를 눌러 끌어서 다른 업종 박스(data-sector-id)에 놓으면 onDrop을 부른다.
// 이동 결과를 어디에 두는지는 부르는 쪽이 정한다(이 훅은 저장하지 않는다). 끄는 동안에는 홈 화면 항목 끌기처럼 종목 박스 모양의 복제본이 반투명으로 포인터를 따라 움직이고
// (원래 박스는 제자리에 둔다), 놓을 업종에 테두리를 쳐서 보여 준다. 켜져 있는 동안 종목 박스에서는 잡는 손 커서가 보인다(index.css의 stock-move-enabled).
export function useStockDrag(containerRef: RefObject<HTMLElement | null>, enabled: boolean, onDrop: (drop: StockDrop) => void) {
  const onDropRef = useRef(onDrop)
  useEffect(() => {
    onDropRef.current = onDrop
  })

  useEffect(() => {
    const container = containerRef.current
    if (!enabled || !container) return

    let session: {
      code: string
      name: string
      sourceSectorId: number
      startX: number
      startY: number
      started: boolean
      source: HTMLElement
      ghost: HTMLElement | null
      target: HTMLElement | null
    } | null = null

    const findSector = (x: number, y: number): HTMLElement | null => {
      for (const element of document.elementsFromPoint(x, y)) {
        const sector = element.closest<HTMLElement>('[data-sector-id]')
        if (sector && container.contains(sector)) return sector
      }
      return null
    }
    const clearTarget = () => {
      if (!session?.target) return
      session.target.style.outline = ''
      session.target.style.outlineOffset = ''
      session.target = null
    }
    const finish = () => {
      clearTarget()
      session?.ghost?.remove()
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
    }
    function handleMove(event: PointerEvent) {
      if (!session) return
      if (!session.started) {
        if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < DRAG_START_DISTANCE) return
        session.started = true
        // 종목 박스와 같은 크기·색·글자의 복제본을 화면 맨 위(fixed)에 올린다 — 업종 박스가 가장자리를 잘라도 영향을 받지 않는다.
        const rect = session.source.getBoundingClientRect()
        const ghost = session.source.cloneNode(true) as HTMLElement
        ghost.removeAttribute('data-stock-code')
        ghost.removeAttribute('data-stock-name')
        ghost.style.position = 'fixed'
        ghost.style.left = `${rect.left}px`
        ghost.style.top = `${rect.top}px`
        ghost.style.width = `${rect.width}px`
        ghost.style.height = `${rect.height}px`
        ghost.style.margin = '0'
        ghost.style.zIndex = '2000'
        ghost.style.opacity = DRAG_OPACITY
        ghost.style.pointerEvents = 'none'
        ghost.style.transition = 'none'
        ghost.style.boxShadow = '0 4px 14px rgba(0,0,0,0.55)'
        document.body.append(ghost)
        session.ghost = ghost
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
      }
      if (session.ghost) {
        session.ghost.style.transform = `translate(${event.clientX - session.startX}px, ${event.clientY - session.startY}px)`
      }
      const sector = findSector(event.clientX, event.clientY)
      const sectorId = sector ? Number(sector.dataset.sectorId) : null
      const next = sector && sectorId !== session.sourceSectorId ? sector : null
      if (next !== session.target) {
        clearTarget()
        if (next) {
          next.style.outline = '2px solid var(--brand)'
          next.style.outlineOffset = '-2px'
          session.target = next
        }
      }
    }
    function handleUp(event: PointerEvent) {
      if (!session) return
      const finished = session
      const sector = finished.started ? findSector(event.clientX, event.clientY) : null
      finish()
      session = null
      if (!finished.started) return
      // 끌기가 끝난 직후의 클릭(업종 헤더 클릭으로 들어가기 등)은 한 번 막는다.
      const swallowClick = (clickEvent: MouseEvent) => {
        clickEvent.stopPropagation()
        clickEvent.preventDefault()
      }
      window.addEventListener('click', swallowClick, { capture: true, once: true })
      window.setTimeout(() => window.removeEventListener('click', swallowClick, { capture: true }), 0)
      const targetSectorId = sector ? Number(sector.dataset.sectorId) : null
      if (!sector || targetSectorId === null || Number.isNaN(targetSectorId) || targetSectorId === finished.sourceSectorId) return
      const targetSectorName = sector.dataset.sectorName ?? ''
      onDropRef.current({ stockCode: finished.code, stockName: finished.name, targetSectorId, targetSectorName })
    }
    function handleCancel() {
      finish()
      session = null
    }
    const handleDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return
      const stock = event.target.closest<HTMLElement>('[data-stock-code]')
      const sector = stock?.closest<HTMLElement>('[data-sector-id]')
      if (!stock || !sector || !container.contains(stock)) return
      session = {
        code: stock.dataset.stockCode ?? '',
        name: stock.dataset.stockName ?? '',
        sourceSectorId: Number(sector.dataset.sectorId),
        startX: event.clientX,
        startY: event.clientY,
        started: false,
        source: stock,
        ghost: null,
        target: null,
      }
      window.addEventListener('pointermove', handleMove)
      window.addEventListener('pointerup', handleUp)
      window.addEventListener('pointercancel', handleCancel)
    }
    container.classList.add('stock-move-enabled')
    container.addEventListener('pointerdown', handleDown)
    return () => {
      container.classList.remove('stock-move-enabled')
      container.removeEventListener('pointerdown', handleDown)
      finish()
      session = null
    }
  }, [containerRef, enabled])
}
