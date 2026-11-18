import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

// 메인 영역의 로딩·오류·정지 원을 놓는 공통 자리.
// 화면마다 메인 영역 안쪽 구조(툴바·표 테두리·아래 줄)가 달라서, 안쪽 부모를 기준으로 가운데에 두면 화면마다 몇 px씩 어긋났다.
// 그래서 원은 안쪽 부모가 아니라 메인 영역(data-main-area) 자체를 기준으로 놓는다. 기준 자리는 지도 화면의 로딩 원이다:
// 메인 영역 위에서 34px, 아래에서 33px 안쪽 틀의 한가운데(2026-11-18 실측, 화면 크기와 무관).
// 원래 자리에는 빈 칸(flex-1)을 남겨 아래 면책 줄 등이 제자리에 있게 한다.
// 메인 영역에 relative가 없는 화면도 있어서 CSS 부모 관계 대신 메인 영역의 화면 좌표를 재서 고정 위치로 그린다.
export const MAIN_AREA_LOADING_TOP_PX = 34
export const MAIN_AREA_LOADING_BOTTOM_PX = 33

type Box = { left: number; top: number; width: number; height: number }

function measureBox(area: HTMLElement): Box {
  const r = area.getBoundingClientRect()
  return { left: r.left, top: r.top + MAIN_AREA_LOADING_TOP_PX, width: r.width, height: Math.max(0, r.height - MAIN_AREA_LOADING_TOP_PX - MAIN_AREA_LOADING_BOTTOM_PX) }
}

function sameBox(a: Box | null | undefined, b: Box) {
  return !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height
}

export default function MainAreaLoading({ children }: { children: ReactNode }) {
  const areaRef = useRef<HTMLElement | null>(null)
  // undefined: 아직 재지 않음, null: 메인 영역이 없는 화면(자리 안 가운데에 그린다)
  const [box, setBox] = useState<Box | null | undefined>(undefined)
  // 자리가 문서에 붙는 순간(화면에 그리기 전) 메인 영역을 찾아 첫 위치를 정한다 — 원이 다른 자리에 한 번 그려졌다가 옮겨지지 않게 한다.
  const slotRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const area = node.closest<HTMLElement>('[data-main-area]')
    areaRef.current = area
    setBox(area ? measureBox(area) : null)
  }, [])
  // 설정창 옮기기·접기, 창 크기 변경처럼 메인 영역이 움직이면 따라간다. 로딩 동안에만 붙어 있으므로 매 프레임 재도 부담이 작다.
  useEffect(() => {
    let frame = 0
    const loop = () => {
      const area = areaRef.current
      if (area) {
        const next = measureBox(area)
        setBox(previous => (sameBox(previous, next) ? previous : next))
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])
  return (
    <div ref={slotRef} className="min-h-0 flex-1">
      {box === null && <div className="flex h-full items-center justify-center">{children}</div>}
      {box && createPortal(
        <div className="pointer-events-none fixed z-10 flex items-center justify-center" style={box}>
          <div className="pointer-events-auto">{children}</div>
        </div>,
        document.body,
      )}
    </div>
  )
}
