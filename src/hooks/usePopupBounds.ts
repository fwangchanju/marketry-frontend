import { useLayoutEffect, useState } from 'react'

export interface PopupBounds {
  top: number
  left: number
  width: number
  maxHeight: number
  visible: boolean
}

export function usePopupBounds(
  isOpen: boolean,
  positionReady: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  popupRef: React.RefObject<HTMLElement | null>,
  preferredWidth: number,
) {
  const [bounds, setBounds] = useState<PopupBounds | null>(null)

  useLayoutEffect(() => {
    if (!isOpen || !positionReady) return

    const frame = triggerRef.current?.closest<HTMLElement>('[data-page-main-frame]')
    const trigger = triggerRef.current
    const popup = popupRef.current
    if (!frame || !trigger || !popup) return

    const update = () => {
      const frameRect = frame.getBoundingClientRect()
      const triggerRect = trigger.getBoundingClientRect()
      const margin = 8
      const width = Math.max(1, Math.min(preferredWidth, frameRect.width - margin * 2))
      const frameMaxHeight = Math.max(1, frameRect.height - margin * 2)
      const popupHeight = Math.min(popup.getBoundingClientRect().height, frameMaxHeight)
      const roomAbove = Math.max(0, triggerRect.top - frameRect.top - margin)
      const roomBelow = Math.max(0, frameRect.bottom - triggerRect.bottom - margin)
      const openUpward = roomBelow < popupHeight && roomAbove > roomBelow
      const availableHeight = Math.max(1, (openUpward ? roomAbove : roomBelow) - 4)
      const maxHeight = Math.min(frameMaxHeight, availableHeight)
      const boundedPopupHeight = Math.min(popupHeight, maxHeight)
      const rawTop = openUpward
        ? triggerRect.top - boundedPopupHeight - 4
        : triggerRect.bottom + 4
      const top = openUpward
        ? Math.max(frameRect.top + margin, rawTop)
        : Math.min(frameRect.bottom - boundedPopupHeight - margin, rawTop)
      const left = Math.max(frameRect.left + margin, Math.min(triggerRect.left, frameRect.right - width - margin))
      const visible = triggerRect.bottom > frameRect.top && triggerRect.top < frameRect.bottom

      setBounds(previous => previous
        && previous.top === top
        && previous.left === left
        && previous.width === width
        && previous.maxHeight === maxHeight
        && previous.visible === visible
        ? previous
        : { top, left, width, maxHeight, visible })
    }

    update()
    const handleScroll = (event: Event) => {
      const target = event.target
      if (target instanceof Node && popup.contains(target)) return
      update()
    }
    const scrollContainer = trigger.closest('.page-main-scroll')
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    observer.observe(popup)
    document.addEventListener('scroll', handleScroll, true)
    scrollContainer?.addEventListener('scroll', update)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      document.removeEventListener('scroll', handleScroll, true)
      scrollContainer?.removeEventListener('scroll', update)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [isOpen, positionReady, preferredWidth, popupRef, triggerRef])

  return bounds
}
