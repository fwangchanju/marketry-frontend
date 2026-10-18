import { domToPng } from 'modern-screenshot'
import { captureRegionRect, shareScreenshotOptions } from './screenshotScale'

const SHARE_IMAGE_LONG_SIDE = 1280

async function cropMobileCaptureBottom(dataUrl: string, cropPixels: number): Promise<string> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()

  const croppedHeight = Math.max(1, image.naturalHeight - cropPixels)
  if (croppedHeight === image.naturalHeight) return dataUrl

  const cropped = document.createElement('canvas')
  cropped.width = image.naturalWidth
  cropped.height = croppedHeight
  cropped.getContext('2d')?.drawImage(image, 0, 0, image.naturalWidth, croppedHeight, 0, 0, image.naturalWidth, croppedHeight)
  return cropped.toDataURL('image/png')
}

// 공유 이미지는 긴 변이 1280px이 되게 찍고, 작은 박스의 글자는 뺀다(screenshotScale.ts 참고).
// regionSelector를 주면 맨 왼쪽부터 그 요소의 오른쪽 끝까지만 찍는다.
export async function screenshotElementToDataUrl(el: HTMLElement, regionSelector?: string, regionMode?: 'through-right-edge' | 'element' | 'content', onCloneNode?: (cloned: Node) => void, horizontalPadding = 0): Promise<string> {
  const dataUrl = await domToPng(el, shareScreenshotOptions(el, regionSelector, regionMode, onCloneNode, horizontalPadding))
  if (regionSelector !== '[data-map-mobile-capture-frame]') return dataUrl

  const region = captureRegionRect(el, regionSelector, regionMode)
  const longSide = region ? Math.max(region.width, region.height) : 0
  const scale = longSide > 0 ? Math.min(2, Math.max(0.5, SHARE_IMAGE_LONG_SIDE / longSide)) : 1
  // 이전 프레임 높이에서 남은 하단 여백을 캡처 이미지 자체에서 4 CSS px 더 잘라낸다.
  return cropMobileCaptureBottom(dataUrl, Math.round(4 * scale))
}
