import KindBadge from '@/components/KindBadge'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { appConfirm } from '@/utils/appDialogBus'
import { mobileViewport } from '@/utils/mobileViewport'
import { MOBILE_POPUP_BACKDROP_CLASS, MOBILE_POPUP_SCALE, MOBILE_POPUP_Z_CLASS, mobilePopupTop } from '@/utils/mobilePopupScale'
import { swallowNextClick } from '@/utils/swallowNextClick'

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
  // 실제 MOBILE 화면에서만 true. 툴바 줄 팝업과 같은 배율·클램프로 키운다. 캡처·미리보기·PC는 false.
  mobileEnlarged?: boolean
}

export default function Popup({ popup, onExcludeSector, onOpenChart, onClose, mobileEnlarged = false }: Props) {
  // popup이 null이면 PopupBody를 트리에서 아예 뺀다 — 이래야 popup이 바뀔 때마다(닫혔다 다시 열릴
  // 때마다) PopupBody가 실제로 언마운트·재마운트되어 confirming/위치 계산 state가 매번 새로 시작한다.
  // Popup 자신은 부모가 항상 렌더하는 컴포넌트라 여기 직접 훅을 두면 그 state가 다음 팝업까지
  // 이어져버린다.
  if (!popup) return null
  return createPortal(
    <PopupBody popup={popup} onExcludeSector={onExcludeSector} onOpenChart={onOpenChart} onClose={onClose} mobileEnlarged={mobileEnlarged} />,
    document.body,
  )
}

// 팝업 본체와 우클릭한 박스 사이의 간격.
const POPUP_GAP = 2
// 커서 이동 팝업과 마우스 사이의 간격(오른쪽·아래).
const POINTER_GAP = 14
const POPUP_MARGIN = 8
// MOBILE 팝업의 너비는 종목·업종, 시장, 내용 길이, 화면 확대와 관계없이 늘 같다. 높이는 내용 줄 수를 따른다(2026-11-25 사용자 결정).
// 이 값에 MOBILE_POPUP_SCALE을 곱한 너비로 보인다.
const MOBILE_POPUP_WIDTH = 200
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

// MOBILE 팝업을 가로 가운데, 정해진 중심선 위치에 다시 놓는다. 창 크기와 화면 확대·이동이 바뀌어도 같은 자리를
// 유지하도록 열 때의 값이 아니라 지금 화면을 매번 읽는다.
function placeMobilePopup(el: HTMLElement) {
  const view = mobileViewport()
  const zoom = Math.max(view.scale, 0.1)
  // 화면에 실제로 보이는 px로 크기·위치를 정한 뒤 확대 배율로 나눈다. 여백도 같이 나눠야 확대할수록 자리가 줄지 않는다.
  // 너비는 고정값, 높이는 화면 확대·transform의 영향을 받지 않는 offsetHeight를 쓴다.
  const screenWidth = view.width * zoom
  const screenHeight = view.height * zoom
  const scale = Math.min(MOBILE_POPUP_SCALE, (screenWidth - POPUP_MARGIN * 2) / MOBILE_POPUP_WIDTH)
  const width = MOBILE_POPUP_WIDTH * scale
  const height = el.offsetHeight * scale
  const left = (screenWidth - width) / 2
  // 세로 위치는 툴바 팝업과 같은 중심선(mobilePopupTop)에 맞춘다.
  const top = mobilePopupTop(screenHeight, height)
  el.style.transform = `scale(${scale / zoom})`
  el.style.left = `${view.left + left / zoom}px`
  el.style.top = `${view.top + top / zoom}px`
  el.style.visibility = 'visible'
}

interface PopupBodyProps {
  popup: PopupState
  onExcludeSector: (sectorId: number, sectorName: string) => void
  onOpenChart?: (stock: { code: string; name: string }) => void
  onClose: () => void
  mobileEnlarged: boolean
}

function PopupBody({ popup, onExcludeSector, onOpenChart, onClose, mobileEnlarged }: PopupBodyProps) {
  const elRef = useRef<HTMLDivElement>(null)
  // MOBILE 팝업이 떠 있을 때 바깥을 누르면 팝업만 닫고, 그 누름이 아래 업종·종목까지 눌려 이동하지 않게 한다(2026-11-27 사용자 제보).
  useEffect(() => {
    if (!mobileEnlarged) return
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && elRef.current?.contains(event.target)) return
      swallowNextClick()
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [mobileEnlarged, onClose])
  // MOBILE 팝업은 길게 누르는 동안(손가락을 떼기 전에) 열린다. 떼는 순간의 클릭이 팝업에 닿아 바로 닫히지 않게,
  // 팝업 위에서 누르기 시작한 클릭만 받는다. 시간으로 막으면 클릭이 늦게 올 때 뚫린다(2026-11-25 재현).
  const pressedRef = useRef(false)
  useLayoutEffect(() => {
    pressedRef.current = false
  }, [popup])
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
    if (mobileEnlarged) {
      // MOBILE에서는 누른 칸 옆이 아니라 가로 가운데, 정해진 중심선 위치에 띄운다.
      placeMobilePopup(el)
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
  }, [popup, pointer, minLeft, maxRight, minTop, maxBottom, mobileEnlarged])

  // 렌더 사이에 화면 확대·이동이 바뀌었을 수 있어 매 렌더마다 다시 맞춘다.
  useLayoutEffect(() => {
    if (!mobileEnlarged) return
    const el = elRef.current
    if (el) placeMobilePopup(el)
  })

  // 팝업이 열려 있는 동안 창 크기·화면 확대·화면 이동이 바뀌면 자리를 다시 잡는다.
  // popup 상태는 그대로라 위 레이아웃 효과가 다시 실행되지 않으므로 별도로 듣는다. PC 팝업은 예전 동작을 유지한다.
  useLayoutEffect(() => {
    if (!mobileEnlarged) return
    const el = elRef.current
    if (!el) return
    const place = () => placeMobilePopup(el)
    const vv = window.visualViewport
    window.addEventListener('resize', place)
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    return () => {
      window.removeEventListener('resize', place)
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
    }
  }, [mobileEnlarged])

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
      {/* MOBILE은 외곽선 없이 둥근 크림색 카드 + 뒤 화면 어둡게(툴바 팝업과 같은 막, 2026-11-27 사용자 결정). PC는 그대로. */}
      {mobileEnlarged && <div aria-hidden="true" className={MOBILE_POPUP_BACKDROP_CLASS} />}
      <div
        ref={elRef}
        data-heatmap-popup
        className={`invisible ${mobileEnlarged ? `absolute ${MOBILE_POPUP_Z_CLASS} box-border cursor-pointer rounded-[9px] border-0 shadow-2xl` : 'fixed z-[9999] w-max break-words border border-[var(--ui-popup-border)] shadow-lg'} select-none px-2 py-1 text-left text-base text-ui-background ${popup.tooltip ? 'pointer-events-none' : ''}`}
        onPointerDown={mobileEnlarged ? () => { pressedRef.current = true } : undefined}
        onClickCapture={mobileEnlarged ? event => {
          const pressed = pressedRef.current
          pressedRef.current = false
          // 키보드·보조 기술의 클릭(detail 0)은 누르기 없이 오므로 그대로 받는다.
          if (pressed || event.detail === 0) return
          event.preventDefault()
          event.stopPropagation()
        } : undefined}
        // MOBILE에서는 팝업을 누르면 닫는다(길게 누르기 전의 모바일 동작 유지).
        onClick={mobileEnlarged ? onClose : undefined}
        style={{
          backgroundColor: POPUP_BACKGROUND,
          // MOBILE은 루트 글자 크기가 80%라 rem 기반 text-base·text-sm이 12.8·11.2px로 줄어든다.
          // 공통 배율을 그 위에 곱하면 PC(16·14px)보다 여전히 작으므로, 원래 크기로 되돌린 뒤 배율을 적용한다.
          // 브라우저의 글자 자동 확대도 끈다. 고정 크기 안에서 줄이 바뀌지 않아야 한다.
          ...(mobileEnlarged
            ? { width: MOBILE_POPUP_WIDTH, fontSize: '16px', transformOrigin: 'top left', textSizeAdjust: '100%', WebkitTextSizeAdjust: '100%' }
            : { maxWidth }),
        }}
      >
        <div className="flex items-center justify-between gap-3 font-bold">
          <div className="flex min-w-0 items-center gap-1.5">
            <KindBadge kind={isSectorPopup ? '업종' : '종목'} />
            <span className={mobileEnlarged ? 'min-w-0 truncate' : undefined}>{popup.title}</span>
          </div>
          {excludeSector && (
            <button
              type="button"
              aria-label={`${excludeSector.name} 제외`}
              data-hint="업종 제외"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-0 bg-ui-selection p-0 text-ui-surface outline-none transition-colors hover:bg-ui-control-hover"
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
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-0 bg-ui-selection p-0 text-ui-surface outline-none transition-colors hover:bg-ui-control-hover"
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
        <div className={`pl-1 text-sm tabular-nums ${mobileEnlarged ? 'whitespace-nowrap' : ''}`} style={mobileEnlarged ? { fontSize: '14px' } : undefined}>
          {popup.rows.map((row, index) => (
            <div key={index}>{row}</div>
          ))}
          {popup.note && <div className="text-[var(--ui-control)]">({popup.note})</div>}
        </div>
      </div>
    </>
  )
}
