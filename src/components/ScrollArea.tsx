import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'

type ScrollMetrics = { trackHeight: number; thumbHeight: number; thumbTop: number; trackWidth: number; thumbWidth: number; thumbLeft: number }

type DragStart = { pointerId: number; clientY: number; scrollTop: number }
type HorizontalDragStart = { pointerId: number; clientX: number; scrollLeft: number }

export default function ScrollArea({
  children,
  className = '',
  inert = false,
  overlay = false,
  scrollLabel,
}: {
  children: ReactNode
  className?: string
  inert?: boolean
  overlay?: boolean
  scrollLabel?: string
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<DragStart | null>(null)
  const horizontalDragStartRef = useRef<HorizontalDragStart | null>(null)
  const [metrics, setMetrics] = useState<ScrollMetrics>({ trackHeight: 0, thumbHeight: 0, thumbTop: 0, trackWidth: 0, thumbWidth: 0, thumbLeft: 0 })
  const [isScrollable, setIsScrollable] = useState(false)
  const [isHorizontallyScrollable, setIsHorizontallyScrollable] = useState(false)

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const maxScrollLeft = overlay ? Math.max(0, viewport.scrollWidth - viewport.clientWidth) : 0
    const trackHeight = Math.max(0, viewport.clientHeight - (maxScrollLeft > 0 ? 6 : 0))
    const trackWidth = Math.max(0, viewport.clientWidth - (maxScrollTop > 0 ? 6 : 0))
    setIsScrollable(previous => previous === (maxScrollTop > 0) ? previous : maxScrollTop > 0)
    setIsHorizontallyScrollable(previous => previous === (maxScrollLeft > 0) ? previous : maxScrollLeft > 0)
    const thumbHeight = maxScrollTop === 0
      ? trackHeight
      : Math.min(trackHeight, Math.max(18, (trackHeight * viewport.clientHeight) / viewport.scrollHeight))
    const thumbTop = maxScrollTop === 0
      ? 0
      : (viewport.scrollTop / maxScrollTop) * Math.max(0, trackHeight - thumbHeight)
    const thumbWidth = maxScrollLeft === 0
      ? trackWidth
      : Math.min(trackWidth, Math.max(18, (trackWidth * viewport.clientWidth) / viewport.scrollWidth))
    const thumbLeft = maxScrollLeft === 0
      ? 0
      : (viewport.scrollLeft / maxScrollLeft) * Math.max(0, trackWidth - thumbWidth)

    setMetrics(previous => (
      previous.trackHeight === trackHeight
      && previous.thumbHeight === thumbHeight
      && previous.thumbTop === thumbTop
      && previous.trackWidth === trackWidth
      && previous.thumbWidth === thumbWidth
      && previous.thumbLeft === thumbLeft
        ? previous
        : { trackHeight, thumbHeight, thumbTop, trackWidth, thumbWidth, thumbLeft }
    ))
  }, [overlay])

  useLayoutEffect(() => {
    updateMetrics()
    const observer = new ResizeObserver(updateMetrics)
    if (viewportRef.current) observer.observe(viewportRef.current)
    if (contentRef.current) observer.observe(contentRef.current)
    window.addEventListener('resize', updateMetrics)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateMetrics)
    }
  }, [children, updateMetrics])

  const handleThumbPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !viewportRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientY: event.clientY,
      scrollTop: viewportRef.current.scrollTop,
    }
  }

  const handleThumbPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragStart = dragStartRef.current
    const viewport = viewportRef.current
    if (!dragStart || dragStart.pointerId !== event.pointerId || !viewport) return

    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    const maxThumbTop = Math.max(0, metrics.trackHeight - metrics.thumbHeight)
    if (maxThumbTop === 0) return
    viewport.scrollTop = dragStart.scrollTop + ((event.clientY - dragStart.clientY) / maxThumbTop) * maxScrollTop
  }

  const clearDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current?.pointerId === event.pointerId) dragStartRef.current = null
  }

  const handleTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget || !viewportRef.current) return
    const viewport = viewportRef.current
    const bounds = event.currentTarget.getBoundingClientRect()
    const progress = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    viewport.scrollTop = progress * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  }

  const handleHorizontalThumbPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !viewportRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    horizontalDragStartRef.current = { pointerId: event.pointerId, clientX: event.clientX, scrollLeft: viewportRef.current.scrollLeft }
  }

  const handleHorizontalThumbPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = horizontalDragStartRef.current
    const viewport = viewportRef.current
    if (!start || start.pointerId !== event.pointerId || !viewport) return
    const maxThumbLeft = Math.max(0, metrics.trackWidth - metrics.thumbWidth)
    if (maxThumbLeft === 0) return
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    viewport.scrollLeft = start.scrollLeft + ((event.clientX - start.clientX) / maxThumbLeft) * maxScrollLeft
  }

  const clearHorizontalDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (horizontalDragStartRef.current?.pointerId === event.pointerId) horizontalDragStartRef.current = null
  }

  const handleHorizontalTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget || !viewportRef.current) return
    const viewport = viewportRef.current
    const bounds = event.currentTarget.getBoundingClientRect()
    const progress = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    viewport.scrollLeft = progress * Math.max(0, viewport.scrollWidth - viewport.clientWidth)
  }

  return (
    <div className={`relative min-w-0 overflow-hidden ${className}`}>
      <div
        ref={viewportRef}
        inert={inert}
        role={scrollLabel ? 'region' : undefined}
        aria-label={scrollLabel}
        tabIndex={scrollLabel ? 0 : undefined}
        onScroll={updateMetrics}
        className={`scroll-area-viewport h-full min-h-0 ${overlay ? 'overflow-auto' : `overflow-x-hidden pr-2 ${isScrollable ? 'overflow-y-scroll' : 'overflow-y-hidden'}`}`}
      >
        <div ref={contentRef} className={overlay ? 'min-h-full' : 'flex min-h-full flex-col gap-1'}>{children}</div>
      </div>
      {isScrollable && <div
        aria-hidden="true"
        onPointerDown={handleTrackPointerDown}
        className={`absolute top-0 right-0 z-10 w-[6px] cursor-pointer rounded-[3px] ${overlay ? 'bg-transparent' : 'bg-ui-white/10'}`}
        style={{ bottom: isHorizontallyScrollable ? 6 : 0 }}
      >
        <div
          onPointerDown={handleThumbPointerDown}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={clearDrag}
          onPointerCancel={clearDrag}
          className="absolute left-0 right-0 touch-none rounded-[3px] bg-ui-white/35"
          style={{ height: metrics.thumbHeight, top: metrics.thumbTop }}
        />
      </div>}
      {isHorizontallyScrollable && <div
        aria-hidden="true"
        onPointerDown={handleHorizontalTrackPointerDown}
        className="absolute bottom-0 left-0 z-10 h-[6px] cursor-pointer rounded-[3px] bg-transparent"
        style={{ right: isScrollable ? 6 : 0 }}
      >
        <div
          onPointerDown={handleHorizontalThumbPointerDown}
          onPointerMove={handleHorizontalThumbPointerMove}
          onPointerUp={clearHorizontalDrag}
          onPointerCancel={clearHorizontalDrag}
          className="absolute top-0 bottom-0 touch-none rounded-[3px] bg-ui-white/35"
          style={{ width: metrics.thumbWidth, left: metrics.thumbLeft }}
        />
      </div>}
    </div>
  )
}
