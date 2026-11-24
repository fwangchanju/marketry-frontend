import KindBadge from '@/components/KindBadge'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { appConfirm } from '@/utils/appDialogBus'
import { PHONE_POPUP_SCALE } from '@/utils/phonePopupScale'

export interface PopupContent {
  title: string
  rows: string[]
  // 숫자 줄 아래에 괄호와 회색(NXT 안내의 두 번째 줄과 같은 양식)으로 붙이는 보충 설명.
  note?: string
  excludeSector?: { id: number; name: string }
  // 종목 팝업이 가리키는 종목 — Popup에 onOpenChart가 있을 때만 제목 줄 오른쪽에 차트 아이콘을 둔다(업종의 휴지통 자리와 같은 방식).
  chartStock?: { code: string; name: string }
  // 우클릭한 섹터/종목 박스를 식별하는 키('sector-<id>' | 'stock-<code>') — 팝업이 떠 있는 동안
  // 해당 박스에만 초록 하이라이트를 붙이는 데 쓴다(Heatmap.highlightedKey).
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
  onOpenChart?: (stock: { code: string; name: string }) => void
  onClose: () => void
  // 실제 폰 화면에서만 true. 툴바 줄 팝업과 같은 배율·클램프로 키운다. 캡처·미리보기·PC는 false.
  phoneEnlarged?: boolean
}

export default function Popup({ popup, onExcludeSector, onOpenChart, onClose, phoneEnlarged = false }: Props) {
  // popup이 null이면 PopupBody를 트리에서 아예 뺀다 — 이래야 popup이 바뀔 때마다(닫혔다 다시 열릴
  // 때마다) PopupBody가 실제로 언마운트·재마운트되어 confirming/위치 계산 state가 매번 새로 시작한다.
  // Popup 자신은 부모가 항상 렌더하는 컴포넌트라 여기 직접 훅을 두면 그 state가 다음 팝업까지
  // 이어져버린다.
  if (!popup) return null
  return createPortal(
    <PopupBody popup={popup} onExcludeSector={onExcludeSector} onOpenChart={onOpenChart} onClose={onClose} phoneEnlarged={phoneEnlarged} />,
    document.body,
  )
}

// 팝업 본체와 우클릭한 박스 사이의 간격.
const POPUP_GAP = 2
// 커서 이동 팝업과 마우스 사이의 간격(오른쪽·아래).
const POINTER_GAP = 14
const POPUP_MARGIN = 8
const POPUP_BACKGROUND = 'var(--ui-popup)'

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

// 폰에서 실제로 보이는 화면 영역. 두 손가락으로 화면을 확대·이동하면 window.innerWidth/innerHeight는 그대로지만
// visualViewport의 크기와 시작점이 바뀐다. 팝업은 이 영역 안에 들어와야 보인다.
// pageLeft/pageTop은 문서 좌표라 absolute로 붙이는 폰 팝업과 같은 기준을 쓴다. 없는 브라우저는 스크롤+오프셋으로 대신한다.
function phoneViewport() {
  const vv = window.visualViewport
  return {
    left: vv?.pageLeft ?? window.scrollX + (vv?.offsetLeft ?? 0),
    top: vv?.pageTop ?? window.scrollY + (vv?.offsetTop ?? 0),
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  }
}

// 폰 팝업을 보이는 화면의 가로 가운데·툴바 줄 바로 아래에 다시 놓는다. 창 크기와 화면 확대·이동이
// 바뀌어도 같은 자리를 유지하도록 열 때의 값이 아니라 지금 화면을 매번 읽는다.
function placePhonePopup(el: HTMLElement) {
  const view = phoneViewport()
  el.style.maxWidth = `${Math.max(1, (view.width - POPUP_MARGIN * 2) / PHONE_POPUP_SCALE)}px`
  const { width, height } = el.getBoundingClientRect()
  // 툴바는 뷰포트 기준 rect라 문서 좌표인 팝업에 그대로 쓰면 확대·이동 시 어긋난다. offsetParent를 따라
  // 문서 좌표를 구한다. 확대해서 툴바가 화면 위로 벗어나면 아래 클램프가 보이는 영역 맨 위로 옮긴다.
  const toolbar = document.querySelector('[data-phone-toolbar-slot]') as HTMLElement | null
  let toolbarBottom = view.top + POPUP_MARGIN
  if (toolbar) {
    toolbarBottom = 0
    let node: HTMLElement | null = toolbar
    while (node) {
      toolbarBottom += node.offsetTop
      node = node.offsetParent as HTMLElement | null
    }
    toolbarBottom += toolbar.offsetHeight
  }
  const minLeft = view.left + POPUP_MARGIN
  const maxLeft = Math.max(minLeft, view.left + view.width - width - POPUP_MARGIN)
  const minTop = view.top + POPUP_MARGIN
  const maxTop = Math.max(minTop, view.top + view.height - height - POPUP_MARGIN)
  el.style.left = `${Math.min(Math.max(view.left + (view.width - width) / 2, minLeft), maxLeft)}px`
  el.style.top = `${Math.min(Math.max(Math.min(toolbarBottom, maxTop), minTop), maxTop)}px`
  el.style.visibility = 'visible'
}

interface PopupBodyProps {
  popup: PopupState
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onOpenChart?: (stock: { code: string; name: string }) => void
  onClose: () => void
  phoneEnlarged: boolean
}

function PopupBody({ popup, onExcludeSector, onOpenChart, onClose, phoneEnlarged }: PopupBodyProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const minLeft = Math.max(POPUP_MARGIN, popup.mapBounds.left + POPUP_MARGIN)
  const maxRight = Math.min(window.innerWidth - POPUP_MARGIN, popup.mapBounds.right - POPUP_MARGIN)
  // transform은 레이아웃 폭을 바꾸지 않고 그린 크기만 키운다. 지도 경계 안에 들어가도록
  // 최대 폭은 배율로 나눠 둔다(아래 위치 계산은 getBoundingClientRect의 실제 그린 크기를 쓴다).
  const scale = phoneEnlarged ? PHONE_POPUP_SCALE : 1
  const maxWidth = Math.max(1, (maxRight - minLeft) / scale)
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
    if (phoneEnlarged) {
      // 폰에서는 누린 칸 옆이 아니라 가로는 화면 가운데, 세로는 툴바 줄 바로 아래에 띄운다.
      // transform(공통 배율)이 적용된 실제 그린 크기로 맞춘다(transformOrigin이 top left라 그대로 쓴다).
      placePhonePopup(el)
      return
    }
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
  }, [popup, pointer, minLeft, maxRight, minTop, maxBottom, phoneEnlarged])

  // 팝업이 열려 있는 동안 창 크기·화면 확대·화면 이동이 바뀌면 가운데·툴바 아래 자리를 다시 잡는다.
  // popup 상태는 그대로라 위 레이아웃 효과가 다시 실행되지 않으므로 별도로 듣는다. PC 팝업은 예전 동작을 유지한다.
  useLayoutEffect(() => {
    if (!phoneEnlarged) return
    const el = elRef.current
    if (!el) return
    const place = () => placePhonePopup(el)
    const vv = window.visualViewport
    window.addEventListener('resize', place)
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    return () => {
      window.removeEventListener('resize', place)
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
    }
  }, [phoneEnlarged])

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
  const chartStock = onOpenChart && !popup.tooltip ? popup.chartStock : undefined
  const isSectorPopup = popup.targetKey.startsWith('sector:')

  return (
    <>
      <div
        ref={elRef}
        data-heatmap-popup
        className={`invisible ${phoneEnlarged ? 'absolute z-[70] cursor-pointer' : 'fixed z-[9999]'} w-max select-none break-words border border-[var(--ui-popup-border)] px-2 py-1 text-left text-base text-ui-background shadow-lg ${popup.tooltip ? 'pointer-events-none' : ''}`}
        // 폰에서는 팝업을 누르면 닫는다(길게 누르기 전의 모바일 동작 유지).
        onClick={phoneEnlarged ? onClose : undefined}
        style={{
          maxWidth,
          backgroundColor: POPUP_BACKGROUND,
          // 폰은 루트 글자 크기가 80%라 rem 기반 text-base·text-sm이 12.8·11.2px로 줄어든다.
          // 공통 배율을 그 위에 곱하면 PC(16·14px)보다 여전히 작으므로, 원래 크기로 되돌린 뒤 배율을 적용한다.
          ...(phoneEnlarged ? { fontSize: '16px', transform: `scale(${PHONE_POPUP_SCALE})`, transformOrigin: 'top left' } : {}),
        }}
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
              data-hint="업종 제외"
              className="flex h-6 w-6 items-center justify-center rounded-md border-0 bg-ui-selection p-0 text-ui-surface outline-none transition-colors hover:bg-ui-control-hover"
              onClick={async () => {
                // 확인 창이 뜨는 동안 우클릭 팝업은 먼저 닫는다(두 창이 겹쳐 보이지 않게).
                onClose()
                if (!await appConfirm(`[${excludeSector.name}]\n맵에서 제외하시겠습니까?`, { title: '업종 제외' })) return
                onExcludeSector(excludeSector.id, excludeSector.name)
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v7m4-7v7" />
              </svg>
            </button>
          )}
          {chartStock && (
            <button
              type="button"
              aria-label={`${chartStock.name} 차트`}
              data-hint="종목 차트"
              className="flex h-6 w-6 items-center justify-center rounded-md border-0 bg-ui-selection p-0 text-ui-surface outline-none transition-colors hover:bg-ui-control-hover"
              onClick={() => {
                onClose()
                onOpenChart?.(chartStock)
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M7 4v3m0 8v3M7 7h0m-2 0h4v8H5zM17 4v5m0 7v4M15 9h4v7h-4z" />
              </svg>
            </button>
          )}
        </div>
        <div className="pl-1 text-sm tabular-nums" style={phoneEnlarged ? { fontSize: '14px' } : undefined}>
          {popup.rows.map((row, index) => (
            <div key={index}>{row}</div>
          ))}
          {popup.note && <div className="text-[var(--ui-control)]">({popup.note})</div>}
        </div>
      </div>
    </>
  )
}
