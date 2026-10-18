// 텔레그램은 사진을 보낼 때 긴 변을 1280px로 줄이고 다시 압축한다. 이미지가 그보다 크면 텔레그램이 비트맵을 줄이면서
// 글자가 번지므로, 처음부터 긴 변이 정확히 1280px이 되는 배율로 찍는다 — 브라우저가 그 크기로 글자를 직접 그려서 훨씬 또렷하고,
// 텔레그램은 크기를 건드리지 않는다. 너무 작거나 큰 배율은 막는다(0.5~2배).
// 이 배율은 크기만 맞출 뿐 내용은 바꾸지 않는다 — 공유 이미지는 사용자가 설계한 지도(글자 표시·색·분류 설정)를 화면 그대로 담아야 한다.
const SHARE_IMAGE_LONG_SIDE = 1280

function scaleForLongSide(longSide: number): number {
  if (longSide === 0) return 1
  return Math.min(2, Math.max(0.5, SHARE_IMAGE_LONG_SIDE / longSide))
}

// 홈 전체 캡처는 화면 밖으로 넘친 세 항목의 너비까지 포함한다.
// 스크롤 내용이 아닌 툴바·바깥 여백은 현재 크기를 그대로 더한다.
export function fullScreenshotSize(el: HTMLElement): { width: number; height: number } {
  const content = el.querySelector<HTMLElement>('[data-capture-full-width]')
  const overflowWidth = content ? Math.max(0, content.scrollWidth - content.clientWidth) : 0
  return { width: el.offsetWidth + overflowWidth, height: el.offsetHeight }
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

// regionSelector를 주면 그 요소들이 차지한 영역만 찍는다(없거나 못 찾으면 전체).
export function shareScreenshotOptions(el: HTMLElement, regionSelector?: string, regionMode: 'through-right-edge' | 'element' | 'content' = 'through-right-edge', onCloneNode?: (cloned: Node) => void, horizontalPadding = 0) {
  const base = { backgroundColor: captureBackgroundColor(el), filter: isCapturable }
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
