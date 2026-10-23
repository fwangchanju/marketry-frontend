// 캡처창과 원본 레이아웃 크기는 유지하고, 긴 변 2560px을 목표로 그려 확대 시 글자를 선명하게 담는다.
// 작은 캡처 영역도 고해상도로 그릴 수 있도록 최대 4배까지 허용한다(최소 0.5배).
// 이 배율은 크기만 맞출 뿐 내용은 바꾸지 않는다 — 공유 이미지는 사용자가 설계한 지도(글자 표시·색·분류 설정)를 화면 그대로 담아야 한다.
const SHARE_IMAGE_LONG_SIDE = 2560

function scaleForLongSide(longSide: number): number {
  if (longSide === 0) return 1
  return Math.min(4, Math.max(0.5, SHARE_IMAGE_LONG_SIDE / longSide))
}

// 홈 전체 캡처는 화면 밖으로 넘친 세 항목의 너비까지 포함한다.
// 스크롤 내용이 아닌 툴바·바깥 여백은 현재 크기를 그대로 더한다.
export function fullScreenshotSize(el: HTMLElement): { width: number; height: number } {
  const content = el.querySelector<HTMLElement>('[data-capture-full-width]')
  const overflowWidth = content ? Math.max(0, content.scrollWidth - content.clientWidth) : 0
  const toolbarWidth = Math.max(0, ...Array.from(el.querySelectorAll<HTMLElement>('[data-capture-full-width-align]'), row => row.scrollWidth))
  return { width: Math.max(el.offsetWidth + overflowWidth, toolbarWidth), height: el.offsetHeight }
}

export function shareScreenshotScale(el: HTMLElement): number {
  const { width, height } = fullScreenshotSize(el)
  return scaleForLongSide(Math.max(width, height))
}

// 찍을 영역을 "맨 왼쪽 위부터 selector에 맞는 요소의 오른쪽 끝까지, 높이는 그대로"로 줄인다. 맞는 요소가 없으면 null이다.
// 홈에서 현재 맨 오른쪽 틀을 빼고 찍을 때 쓴다 — 틀 배치는 그대로 두고 오른쪽을 잘라서 찍는다.
export function captureRegionRect(el: HTMLElement, selector: string, mode: 'through-right-edge' | 'element' | 'content' = 'through-right-edge'): { x: number; y: number; width: number; height: number } | null {
  const edges = Array.from(el.querySelectorAll(selector))
  if (edges.length === 0) return null
  const origin = el.getBoundingClientRect()
  if (mode === 'element' || mode === 'content') {
    const target = edges[0]
    const rect = target.getBoundingClientRect()
    const style = getComputedStyle(target)
    const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0
    const borderRight = Number.parseFloat(style.borderRightWidth) || 0
    const borderTop = Number.parseFloat(style.borderTopWidth) || 0
    const borderBottom = Number.parseFloat(style.borderBottomWidth) || 0
    const paddingLeft = mode === 'content' ? Number.parseFloat(style.paddingLeft) || 0 : 0
    const paddingRight = mode === 'content' ? Number.parseFloat(style.paddingRight) || 0 : 0
    const paddingTop = mode === 'content' ? Number.parseFloat(style.paddingTop) || 0 : 0
    const paddingBottom = mode === 'content' ? Number.parseFloat(style.paddingBottom) || 0 : 0
    const outerMargin = mode === 'content' ? 3 : 0
    const rawX = rect.left - origin.left + borderLeft + paddingLeft - outerMargin
    const rawY = rect.top - origin.top + borderTop + paddingTop - outerMargin
    // 가로 스크롤로 화면 밖에 있는 항목도 전체를 찍는다. 화면 경계로 자르면
    // 우측 항목의 폭이 0이 되거나, 스크롤한 뒤 좌측 항목이 잘린다.
    return {
      x: rawX,
      y: rawY,
      width: Math.max(0, rect.width - borderLeft - borderRight - paddingLeft - paddingRight + outerMargin * 2),
      height: Math.max(0, rect.height - borderTop - borderBottom - paddingTop - paddingBottom + outerMargin * 2),
    }
  }
  const right = Math.max(...edges.map(edge => edge.getBoundingClientRect().right))
  return { x: 0, y: 0, width: right - origin.left, height: origin.height }
}

// data-capture-ignore가 붙은 요소(예: 지도 위 NXT 안내창과 그 어두운 배경)는 일시적인 알림이라 공유 이미지에 담지 않는다.
const isCapturable = (node: Node) => !(node instanceof Element && node.hasAttribute('data-capture-ignore'))

// 지도 모바일 캡처용 트리는 모바일을 선택했을 때만 렌더링한다. 선택 전환 중 이미 생성된 트리가 있어도
// 모니터 이미지의 복제 대상에는 포함하지 않는다.
const MOBILE_CAPTURE_FRAME_SELECTOR = '[data-map-mobile-capture-frame]'
const isCapturableWithoutMobileFrame = (node: Node) =>
  isCapturable(node) && !(node instanceof Element && node.matches(MOBILE_CAPTURE_FRAME_SELECTOR))

// 모바일 이미지는 원본 툴바와 별도 모바일 판만 쓴다. 데스크톱 지도를 통째로 복제하면
// 같은 종목 박스 트리를 두 벌 직렬화하게 되어 미리보기가 늦어진다.
function mobileCaptureFilter(root: HTMLElement) {
  const frame = root.querySelector(MOBILE_CAPTURE_FRAME_SELECTOR)
  const toolbar = root.querySelector('.main-toolbar')
  return (node: Node) => isCapturable(node)
    && !(node instanceof Element && node.parentElement === root && node !== frame && node !== toolbar)
}

// 찍을 영역 자체에 불투명한 배경색이 있으면 그 색을 찍기 바탕으로 쓴다. 바탕색 옵션이 영역의 배경색을 덮어써서, 홈처럼 영역이 검정인데
// 바탕색이 다르면 배경이 없는 줄(아래 줄)만 다른 색으로 찍히기 때문이다. 배경이 없으면 기본 바탕색(#000000)을 쓴다.
// 캡처 라이브러리에는 CSS 변수 대신 실제 픽셀 색을 전달한다.
const DEFAULT_CAPTURE_BACKGROUND = '#000000'

function captureBackgroundColor(el: HTMLElement): string {
  const color = getComputedStyle(el).backgroundColor
  const alpha = /^rgba\(.*,\s*([\d.]+)\)$/.exec(color)?.[1]
  const isOpaque = color !== '' && color !== 'transparent' && (alpha === undefined || Number(alpha) === 1)
  return isOpaque ? color : DEFAULT_CAPTURE_BACKGROUND
}

function hideScrollbars(cloned: Node) {
  if (cloned instanceof HTMLElement) cloned.style.scrollbarWidth = 'none'
}

// regionSelector를 주면 그 요소들이 차지한 영역만 찍는다(없거나 못 찾으면 전체).
export function shareScreenshotOptions(el: HTMLElement, regionSelector?: string, regionMode: 'through-right-edge' | 'element' | 'content' = 'through-right-edge', onCloneNode?: (cloned: Node) => void, horizontalPadding = 0) {
  // 복제본에는 스크롤바를 그리지 않는다 — 찍는 것은 사람이 보는 영역이라 스크롤바가 이미지에 들어갈 이유가 없다. Windows처럼 스크롤바가 자리를 차지하는 환경에서는
  // 복제본 표가 조금만 넘쳐도 이미지에 스크롤바가 찍힌다(실제 화면에는 없던 것). 레이아웃은 바꾸지 않고 스크롤바만 숨긴다.
  const filter = regionSelector === MOBILE_CAPTURE_FRAME_SELECTOR ? mobileCaptureFilter(el) : isCapturableWithoutMobileFrame
  const base = { backgroundColor: captureBackgroundColor(el), filter, onCloneEachNode: hideScrollbars }
  const fullSize = fullScreenshotSize(el)
  const selectedRegion = regionSelector ? captureRegionRect(el, regionSelector, regionMode) : null
  const isExpandedFullCapture = !selectedRegion && fullSize.width > el.offsetWidth
  const baseRegion = selectedRegion ?? (fullSize.width > el.offsetWidth ? { x: 0, y: 0, ...fullSize } : null)
  const region = baseRegion
    ? horizontalPadding > 0
      ? { ...baseRegion, x: baseRegion.x - horizontalPadding, width: baseRegion.width + horizontalPadding * 2 }
      : baseRegion
    : horizontalPadding > 0
      ? { x: -horizontalPadding, y: 0, width: el.offsetWidth + horizontalPadding * 2, height: el.offsetHeight }
      : null
  if (!region) return { scale: shareScreenshotScale(el), ...base }
  return {
    scale: scaleForLongSide(Math.max(region.width, region.height)),
    width: Math.round(region.width),
    height: Math.round(region.height),
    // 출력 이미지 크기와 원본 레이아웃 크기를 구분한다. 잘라 낼 폭으로 원본까지
    // 줄이면 flex 항목이 재배치되므로 복제본은 현재 화면의 원본 크기를 유지한다.
    style: {
      width: `${el.offsetWidth}px`,
      height: `${el.offsetHeight}px`,
      transform: `translate(${-region.x}px, ${-region.y}px)`,
      transformOrigin: 'top left',
    },
    ...(isExpandedFullCapture || onCloneNode ? {
      // 본문 항목 크기는 유지하고 툴바와 아래 줄만 이미지 전체 폭으로 넓힌다.
      // 화면의 DOM은 바꾸지 않고 복제본의 분류 배지와 범례를 오른쪽 끝에 맞춘다.
      onCloneNode: (cloned: Node) => {
        if (!(cloned instanceof Element)) return
        if (isExpandedFullCapture) {
          for (const row of cloned.querySelectorAll<HTMLElement>('[data-capture-full-width-align]')) {
            row.style.width = `${fullSize.width}px`
            row.style.boxSizing = 'border-box'
          }
        }
        onCloneNode?.(cloned)
      },
    } : {}),
    ...base,
  }
}
