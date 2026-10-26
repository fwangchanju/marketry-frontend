import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'

type ScrollMetrics = { trackHeight: number; thumbHeight: number; thumbTop: number }

type DragStart = { pointerId: number; clientY: number; scrollTop: number }

export default function ScrollArea({
  children,
  className = '',
  inert = false,
}: {
  children: ReactNode
  className?: string
  inert?: boolean
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<DragStart | null>(null)
  const [metrics, setMetrics] = useState<ScrollMetrics>({ trackHeight: 0, thumbHeight: 0, thumbTop: 0 })
  const [isScrollable, setIsScrollable] = useState(false)

  const updateMetrics = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const trackHeight = viewport.clientHeight
    const maxScrollTop = Math.max(0, viewport.scrollHeight - trackHeight)
    setIsScrollable(previous => previous === (maxScrollTop > 0) ? previous : maxScrollTop > 0)
    const thumbHeight = maxScrollTop === 0
      ? trackHeight
      : Math.min(trackHeight, Math.max(18, (trackHeight * trackHeight) / viewport.scrollHeight))
    const thumbTop = maxScrollTop === 0
      ? 0
      : (viewport.scrollTop / maxScrollTop) * Math.max(0, trackHeight - thumbHeight)

    setMetrics(previous => (
      previous.trackHeight === trackHeight
      && previous.thumbHeight === thumbHeight
      && previous.thumbTop === thumbTop
        ? previous
        : { trackHeight, thumbHeight, thumbTop }
    ))
  }, [])

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

  return (
    <div className={`relative min-w-0 overflow-hidden ${className}`}>
      <div
        ref={viewportRef}
        inert={inert}
        onScroll={updateMetrics}
        className={`scroll-area-viewport h-full min-h-0 overflow-x-hidden ${isScrollable ? 'overflow-y-scroll pr-2' : 'overflow-y-hidden'}`}
      >
        <div ref={contentRef} className="flex min-h-full flex-col gap-1">{children}</div>
      </div>
      {isScrollable && <div
        aria-hidden="true"
        onPointerDown={handleTrackPointerDown}
        className="absolute inset-y-0 right-0 z-10 w-[6px] cursor-pointer rounded-[3px] bg-ui-white/10"
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
    </div>
  )
}
