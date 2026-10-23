import { domToPng } from 'modern-screenshot'
import { fontCssFor } from './captureFonts'
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
  // 글꼴은 찍을 영역에 쓰인 조각만 넣는다(전부 넣으면 캡처마다 글꼴 조각 277개를 내려받는다). 고르지 못하면 라이브러리 기본 동작이다.
  const fontCss = await fontCssFor(el)
  const dataUrl = await domToPng(el, fontCss ? { ...options, font: { cssText: fontCss } } : options)
  if (regionSelector !== '[data-map-mobile-capture-frame]') return dataUrl

  // 이전 프레임 높이에서 남은 하단 여백을 캡처 이미지 자체에서 4 CSS px 더 잘라낸다.
  return cropMobileCaptureBottom(dataUrl, Math.round(4 * options.scale))
}

// 텔레그램 홈 모바일 판과 같은 810×1080 픽셀로 저장한다. 별도 리샘플링을 거치면 배지 글자 위치가 달라진다.
// 툴바는 각 틀 안에 원래 글자 크기로 배치해 전체 상단줄을 축소하지 않는다.
export async function screenshotFixedHomeFrameToDataUrl(root: HTMLElement, selector: string): Promise<string> {
  const frame = root.querySelector(selector)?.closest<HTMLElement>('[data-capture-fixed-frame]')
  if (!frame) throw new Error('Fixed home capture frame is unavailable')
  const toolbar = frame.querySelector<HTMLElement>('.home-capture-toolbar')
  const left = toolbar?.firstElementChild as HTMLElement | null
  const right = toolbar?.lastElementChild as HTMLElement | null
  if (!toolbar || !left || !right || left.scrollWidth + right.scrollWidth + 12 > toolbar.clientWidth) {
    throw new Error('캡처 폭에 상단 정보가 모두 들어가지 않습니다.')
  }
  if (frame.offsetWidth !== 810 || frame.offsetHeight !== 1080) throw new Error('Fixed home capture size is invalid')
  const options = { ...shareScreenshotOptions(frame), scale: 1 }
  const fontCss = await fontCssFor(frame)
  return domToPng(frame, fontCss ? { ...options, font: { cssText: fontCss } } : options)
}
