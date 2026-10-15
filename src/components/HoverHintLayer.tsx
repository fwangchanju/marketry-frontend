import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'

// 마우스를 올리거나 키보드로 오면 뜨는 설명을 한 곳에서 그린다 — 요소에 data-hint="설명"만 달면 된다(브라우저 기본 title 툴팁 대신 쓴다).
// 규칙은 docs/ui-areas.md "마우스 올림". 앱에 한 번만 둔다.
const SHOW_DELAY_MS = 150
const GAP = 8
const EDGE = 8

// bounds는 설정창 안 요소일 때 그 설정창의 영역이다 — 설명이 설정창 바깥으로 나가지 않게 가로를 이 안에 둔다.
type Hint = { text: string; rect: DOMRect; bounds: DOMRect | null }

function findHintElement(x: number, y: number): HTMLElement | null {
  // 마우스 이벤트를 받지 않는 비활성 버튼에도 설명이 떠야 해서 좌표로 요소를 찾는다.
  return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-hint]') ?? null
}

export default function HoverHintLayer() {
  const [hint, setHint] = useState<Hint | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current: HTMLElement | null = null
    let timer: number | undefined

    const hide = () => {
      window.clearTimeout(timer)
      current = null
      setHint(null)
      setPosition(null)
    }
    const show = (element: HTMLElement, delay: number) => {
      window.clearTimeout(timer)
      current = element
      const text = element.dataset.hint
      if (!text) return
      timer = window.setTimeout(() => setHint({ text, rect: element.getBoundingClientRect(), bounds: element.closest('[data-settings-panel]')?.getBoundingClientRect() ?? null }), delay)
    }

    const handleMouseMove = (event: MouseEvent) => {
      const element = findHintElement(event.clientX, event.clientY)
      if (element === current) return
      hide()
      if (element) show(element, SHOW_DELAY_MS)
    }
    const handleFocusIn = (event: FocusEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-hint]')
      if (element && element.matches(':focus-visible')) show(element, 0)
    }

    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('mousedown', hide, true)
    document.addEventListener('keydown', hide, true)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', hide)
    document.addEventListener('mouseleave', hide)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('blur', hide)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('mousedown', hide, true)
      document.removeEventListener('keydown', hide, true)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('mouseleave', hide)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
    }
  }, [])

  // 요소 아래 가운데에 놓고, 화면 가장자리를 넘으면 안쪽으로 당긴다. 아래가 모자라면 위에 놓는다.
  useLayoutEffect(() => {
    if (!hint || !bubbleRef.current) return
    const { width, height } = bubbleRef.current.getBoundingClientRect()
    const { rect, bounds } = hint
    const minLeft = (bounds?.left ?? 0) + EDGE
    const maxLeft = Math.min(bounds?.right ?? window.innerWidth, window.innerWidth) - width - EDGE
    const left = Math.max(Math.min(rect.left + rect.width / 2 - width / 2, maxLeft), minLeft)
    const below = rect.bottom + GAP
    const top = below + height + EDGE > window.innerHeight ? Math.max(rect.top - GAP - height, EDGE) : below
    setPosition({ left, top })
  }, [hint])

  if (!hint) return null
  return createPortal(
    <div
      ref={bubbleRef}
      role="tooltip"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden', maxWidth: hint.bounds ? hint.bounds.width - EDGE * 2 : undefined }}
      className={`pointer-events-none fixed z-[200] w-max max-w-xs whitespace-pre-line ${HINT_BUBBLE_CLASS}`}
    >
      {hint.text}
    </div>,
    document.body,
  )
}
