import { domToPng } from 'modern-screenshot'
import { shareScreenshotOptions } from './screenshotScale'

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

// 화면 배치를 유지하고 공통 설정의 해상도로 공유 이미지를 생성한다.
// regionSelector를 주면 맨 왼쪽부터 그 요소의 오른쪽 끝까지만 찍는다.
export async function screenshotElementToDataUrl(el: HTMLElement, regionSelector?: string, regionMode?: 'through-right-edge' | 'element' | 'content', onCloneNode?: (cloned: Node) => void, horizontalPadding = 0): Promise<string> {
  const options = shareScreenshotOptions(el, regionSelector, regionMode, onCloneNode, horizontalPadding)
  const dataUrl = await domToPng(el, options)
  if (regionSelector !== '[data-map-mobile-capture-frame]') return dataUrl

  // 이전 프레임 높이에서 남은 하단 여백을 캡처 이미지 자체에서 4 CSS px 더 잘라낸다.
  return cropMobileCaptureBottom(dataUrl, Math.round(4 * options.scale))
}
