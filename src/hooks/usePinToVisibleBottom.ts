import { useLayoutEffect, type RefObject } from 'react'
import { phoneViewport } from '@/utils/phoneViewport'

// 두 손가락으로 화면을 확대해도 요소의 보이는 크기를 그대로 두고 보이는 화면 맨 아래에 붙인다.
// 배치(자리)는 바꾸지 않고 transform만 쓰므로 확대 중에도 지도 판 크기가 흔들리지 않는다. 1배에서는 아무것도 하지 않는다.
export function usePinToVisibleBottom(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const place = () => {
      const view = phoneViewport()
      if (view.scale <= 1.01) {
        el.style.transform = ''
        el.style.transformOrigin = ''
        el.style.zIndex = ''
        return
      }
      const x = view.left + el.offsetLeft / view.scale - el.offsetLeft
      const y = view.top + view.height - (el.offsetTop + el.offsetHeight)
      el.style.transformOrigin = 'left bottom'
      el.style.transform = `translate(${x}px, ${y}px) scale(${1 / view.scale})`
      // 확대하면 툴바 줄(z-[70]) 위로 올라올 수 있다. 같은 층이면 뒤에 그리는 이 줄이 위, 팝업(body 끝)은 그 위다.
      el.style.zIndex = '70'
    }
    place()
    const vv = window.visualViewport
    window.addEventListener('resize', place)
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    return () => {
      window.removeEventListener('resize', place)
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
    }
  }, [ref])
}
