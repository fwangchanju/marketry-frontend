import KindBadge from '@/components/KindBadge'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { appConfirm } from '@/utils/appDialogBus'

export interface PopupContent {
  title: string
  rows: string[]
  excludeSector?: { id: number; name: string }
  // 우클릭한 섹터/종목 박스를 식별하는 키('sector-<id>' | 'stock-<code>') — 팝업이 떠 있는 동안
  // 해당 박스에만 초록 하이라이트를 붙이는 데 쓴다(Treemap.highlightedKey).
  targetKey: string
  // true면 커서 이동(hover)으로 뜬 임시 팝업 — 마우스 이벤트를 받지 않아서 커서가 팝업 위로 가도
  // 박스의 pointerleave가 튀지 않는다.
  tooltip?: boolean
  // 커서 이동(hover)으로 뜬 팝업이 따라갈 마우스의 뷰포트 좌표. 있으면 박스 가장자리가 아니라 마우스 근처에 놓고 마우스를 따라 움직인다.
  pointer?: { x: number; y: number }
}

// 우클릭한 박스(섹터 전체 박스 혹은 종목 박스)의 뷰포트 기준 rect. 팝업은 마우스 좌표가 아니라
// 이 rect의 가장자리에 스티커 메모처럼 붙는다 — 실제 정렬(오른쪽/왼쪽, 위/아래) 계산은 팝업 자신의
// 렌더된 크기를 알아야 하므로 아래 PopupBody에서 한다.
export interface PopupAnchorRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface PopupState extends PopupContent {
  anchorRect: PopupAnchorRect
  mapBounds: { left: number; right: number; top: number; bottom: number }
}

interface Props {
  popup: PopupState | null
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onClose: () => void
}

export default function Popup({ popup, onExcludeSector, onClose }: Props) {
  // popup이 null이면 PopupBody를 트리에서 아예 뺀다 — 이래야 popup이 바뀔 때마다(닫혔다 다시 열릴
  // 때마다) PopupBody가 실제로 언마운트·재마운트되어 confirming/위치 계산 state가 매번 새로 시작한다.
  // Popup 자신은 부모가 항상 렌더하는 컴포넌트라 여기 직접 훅을 두면 그 state가 다음 팝업까지
  // 이어져버린다.
  if (!popup) return null
  return createPortal(
    <PopupBody popup={popup} onExcludeSector={onExcludeSector} onClose={onClose} />,
    document.body,
  )
}

// 팝업 본체와 우클릭한 박스 사이의 간격.
const POPUP_GAP = 2
// 커서 이동 팝업과 마우스 사이의 간격(오른쪽·아래).
const POINTER_GAP = 14
const POPUP_MARGIN = 8
const POPUP_BACKGROUND = '#fff8e7'

interface PointerBounds {
  minLeft: number
  maxRight: number
  minTop: number
  maxBottom: number
}

// 마우스 오른쪽 아래에 GAP만큼 띄워 놓는다. 지도 경계에 걸리면 마우스 왼쪽·위쪽으로 뒤집고, 그래도 넘치면 경계 안으로 클램프해서
// 지도 밖으로 나가지 않게 한다.
function placeNearPointer(el: HTMLElement, point: { x: number; y: number }, bounds: PointerBounds) {
  const { width, height } = el.getBoundingClientRect()
  let left = point.x + POINTER_GAP
  if (left + width > bounds.maxRight) {
    left = point.x - POINTER_GAP - width
  }
  left = Math.min(Math.max(left, bounds.minLeft), bounds.maxRight - width)
  let top = point.y + POINTER_GAP
  if (top + height > bounds.maxBottom) {
    top = point.y - POINTER_GAP - height
  }
  top = Math.min(Math.max(top, bounds.minTop), bounds.maxBottom - height)
  el.style.left = `${left}px`
  el.style.top = `${top}px`
  el.style.visibility = 'visible'
}

interface PopupBodyProps {
  popup: PopupState
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onClose: () => void
}

function PopupBody({ popup, onExcludeSector, onClose }: PopupBodyProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const minLeft = Math.max(POPUP_MARGIN, popup.mapBounds.left + POPUP_MARGIN)
  const maxRight = Math.min(window.innerWidth - POPUP_MARGIN, popup.mapBounds.right - POPUP_MARGIN)
  const maxWidth = Math.max(1, maxRight - minLeft)
  const minTop = Math.max(POPUP_MARGIN, popup.mapBounds.top + POPUP_MARGIN)
  const maxBottom = Math.min(window.innerHeight - POPUP_MARGIN, popup.mapBounds.bottom - POPUP_MARGIN)
  const pointer = popup.pointer
  // 팝업 크기는 내용(제목/행 목록 vs 삭제 확인 문구+버튼)에 따라 달라서 미리 알 수 없다. 일단
  // 기본 위치(혹은 이전 위치)로 그려보고, 실제 렌더된 크기를 getBoundingClientRect로 잰 뒤
  // 뷰포트를 넘치지 않는 최종 위치를 다시 계산한다 — useLayoutEffect라 이 보정은 브라우저가
  // 화면을 그리기 전에 끝나서 위치가 튀는 게 눈에 보이지 않는다.
  useLayoutEffect(() => {
    const el = elRef.current
    if (!el) return
    if (pointer) {
      placeNearPointer(el, pointer, { minLeft, maxRight, minTop, maxBottom })
      return
    }
    const { width, height } = el.getBoundingClientRect()
    const { anchorRect } = popup

    // X: 지도 영역 안에서 박스 오른쪽 바깥(GAP만큼)에 둔다. 안 들어가면 왼쪽으로 뒤집고,
    // 그마저 안 들어가면 지도 경계 안으로 클램프한다.
    const rightCandidate = anchorRect.right + POPUP_GAP
    const leftCandidate = anchorRect.left - POPUP_GAP - width
    let left: number
    if (rightCandidate + width <= maxRight) {
      left = rightCandidate
    } else if (leftCandidate >= minLeft) {
      left = leftCandidate
    } else {
      left = Math.min(Math.max(rightCandidate, minLeft), maxRight - width)
    }

    // Y: 기본은 박스 위쪽 가장자리에 맞춘다(간격 없음). 화면 아래로 넘치면 박스 아래쪽 가장자리에
    // 맞추고, 그마저 안 들어가면 뷰포트 안쪽으로 클램프한다.
    const topCandidate = anchorRect.top
    const bottomCandidate = anchorRect.bottom - height
    let top: number
    if (topCandidate + height <= window.innerHeight - POPUP_MARGIN && topCandidate >= POPUP_MARGIN) {
      top = topCandidate
    } else if (bottomCandidate >= POPUP_MARGIN && bottomCandidate + height <= window.innerHeight - POPUP_MARGIN) {
      top = bottomCandidate
    } else {
      top = Math.min(Math.max(topCandidate, POPUP_MARGIN), window.innerHeight - POPUP_MARGIN - height)
    }

    el.style.left = `${left}px`
    el.style.top = `${top}px`
    el.style.visibility = 'visible'
  }, [popup, pointer, minLeft, maxRight, minTop, maxBottom])

  // 커서 이동 팝업은 마우스를 따라간다. 지도 전체를 다시 그리지 않도록 상태를 바꾸지 않고 위치만 직접 옮기며, 프레임당 한 번만 갱신한다.
  useEffect(() => {
    const el = elRef.current
    if (!pointer || !el) return
    let frame = 0
    let latest = pointer
    const handlePointerMove = (e: PointerEvent) => {
      latest = { x: e.clientX, y: e.clientY }
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        placeNearPointer(el, latest, { minLeft, maxRight, minTop, maxBottom })
      })
    }
    document.addEventListener('pointermove', handlePointerMove)
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      cancelAnimationFrame(frame)
    }
  }, [pointer, minLeft, maxRight, minTop, maxBottom])

  const excludeSector = popup.excludeSector
  const isSectorPopup = popup.targetKey.startsWith('sector:')

  return (
    <>
      <div
        ref={elRef}
        data-treemap-popup
        className={`invisible fixed z-[9999] w-max break-words border border-[#7a6d55] px-2 py-1 text-left text-base text-black shadow-lg ${popup.tooltip ? 'pointer-events-none' : ''}`}
        style={{ maxWidth, backgroundColor: POPUP_BACKGROUND }}
      >
        <div className="flex items-center justify-between gap-3 font-bold">
          <div className="flex items-center gap-1.5">
            <KindBadge kind={isSectorPopup ? '업종' : '종목'} />
            <span>{popup.title}</span>
          </div>
          {excludeSector && (
            <button
              type="button"
              aria-label={`${excludeSector.name} 제외`}
              title="업종 제외"
              className="flex h-6 w-6 items-center justify-center rounded-md border-0 bg-[var(--panel-gray)] p-0 text-zinc-800 outline-none transition-colors hover:bg-zinc-400"
              onClick={async () => {
                // 확인 창이 뜨는 동안 우클릭 팝업은 먼저 닫는다(두 창이 겹쳐 보이지 않게).
                onClose()
                if (!await appConfirm(`${excludeSector.name}\n트리맵에서 제외하시겠습니까?`, { title: '업종 제외' })) return
                onExcludeSector(excludeSector.id, excludeSector.name)
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7" />
              </svg>
            </button>
          )}
        </div>
        <div className="pl-1 tabular-nums">
          {popup.rows.map((row, index) => (
            <div key={index}>{row}</div>
          ))}
        </div>
      </div>
    </>
  )
}
