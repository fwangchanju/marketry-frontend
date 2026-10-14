// 텔레그램은 사진을 보낼 때 긴 변을 1280px로 줄이고 다시 압축한다. 이미지가 그보다 크면 텔레그램이 비트맵을 줄이면서
// 글자가 번지므로, 처음부터 긴 변이 정확히 1280px이 되는 배율로 찍는다 — 브라우저가 그 크기로 글자를 직접 그려서 훨씬 또렷하고,
// 텔레그램은 크기를 건드리지 않는다. 너무 작거나 큰 배율은 막는다(0.5~2배).
// 이 배율은 크기만 맞출 뿐 내용은 바꾸지 않는다 — 공유 이미지는 사용자가 설계한 지도(글자 표시·색·분류 설정)를 화면 그대로 담아야 한다.
const SHARE_IMAGE_LONG_SIDE = 1280

export function shareScreenshotScale(el: HTMLElement): number {
  const longSide = Math.max(el.offsetWidth, el.offsetHeight)
  if (longSide === 0) return 1
  return Math.min(2, Math.max(0.5, SHARE_IMAGE_LONG_SIDE / longSide))
}

// data-capture-ignore가 붙은 요소(예: 지도 위 NXT 안내창과 그 어두운 배경)는 일시적인 알림이라 공유 이미지에 담지 않는다.
const isCapturable = (node: Node) => !(node instanceof Element && node.hasAttribute('data-capture-ignore'))

export function shareScreenshotOptions(el: HTMLElement) {
  return { scale: shareScreenshotScale(el), backgroundColor: '#0f1117', filter: isCapturable }
}
