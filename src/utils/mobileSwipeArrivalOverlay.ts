// 모바일 스와이프로 다음 화면에 들어갈 때, 미리보기 판을 새 화면이 준비될 때까지 잠시 덮어 둔다.
// 주소가 바뀐 뒤 새 페이지가 붙고 지도 배치가 잡히기까지 한두 프레임 빈 화면이 보이는 것을 막는다.
const FADE_MS = 120
const MAX_HOLD_MS = 2000

type Overlay = { node: HTMLDivElement; releaseTimer: number | null; safetyTimer: number | null; rafId: number | null }

let active: Overlay | null = null

function clearTimers(overlay: Overlay) {
  if (overlay.releaseTimer !== null) window.clearTimeout(overlay.releaseTimer)
  if (overlay.safetyTimer !== null) window.clearTimeout(overlay.safetyTimer)
  if (overlay.rafId !== null) cancelAnimationFrame(overlay.rafId)
}

export function releaseSwipeArrivalOverlay() {
  const overlay = active
  if (!overlay) return
  active = null
  clearTimers(overlay)
  overlay.node.style.opacity = '0'
  overlay.releaseTimer = window.setTimeout(() => overlay.node.remove(), FADE_MS + 20)
}

// 스와이프가 확정됐을 때, 화면에 보이는 미리보기 판의 모양 그대로 덮개를 만든다.
export function captureSwipeArrivalOverlay(element: HTMLElement | null) {
  releaseSwipeArrivalOverlay()
  if (!element) return
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const clone = element.cloneNode(true) as HTMLElement
  clone.style.position = 'absolute'
  clone.style.left = '0'
  clone.style.top = '0'
  clone.style.transformOrigin = 'top left'
  clone.style.transition = 'none'
  const node = document.createElement('div')
  node.setAttribute('aria-hidden', 'true')
  node.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:9999;pointer-events:none;overflow:hidden;background:var(--ui-background);transition:opacity ${FADE_MS}ms linear`
  // 미리보기 자체에 배율이 있으면(공통 셸) 그대로 쓰고, 없으면(한국 업종·그룹) 부모 배율을 여기서 적용한다.
  if (/scale\(/.test(clone.style.transform || '')) {
    node.appendChild(clone)
  } else {
    const scale = rect.width / element.offsetWidth
    const scaled = document.createElement('div')
    scaled.style.cssText = `position:absolute;left:0;top:0;transform-origin:top left;transform:scale(${scale})`
    scaled.appendChild(clone)
    node.appendChild(scaled)
  }
  document.body.appendChild(node)
  const overlay: Overlay = { node, releaseTimer: null, safetyTimer: null, rafId: null }
  overlay.safetyTimer = window.setTimeout(() => releaseSwipeArrivalOverlay(), MAX_HOLD_MS)
  active = overlay
  // 도착 페이지가 어느 컴포넌트인지(국내/일본/미국) 가리지 않고, 지도 배치가 잡히면 덮개를 걷는다.
  const releaseWhenLaidOut = () => {
    if (active !== overlay) return
    if (document.querySelector('[data-map-mobile-capture-frame] [data-heatmap-layout-ready="true"]')) {
      releaseSwipeArrivalOverlay()
      return
    }
    overlay.rafId = requestAnimationFrame(releaseWhenLaidOut)
  }
  overlay.rafId = requestAnimationFrame(releaseWhenLaidOut)
}
