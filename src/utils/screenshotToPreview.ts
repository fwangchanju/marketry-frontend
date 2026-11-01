import { domToPng, type Options as ScreenshotOptions } from 'modern-screenshot'
import { fontCssFor } from './captureFonts'
import { shareScreenshotOptions } from './screenshotScale'
import { reportClientMetric } from './clientMetrics'
import { withScreenshotSandbox } from './screenshotSandbox'

type CloneCaptureOptions = {
  onCloneEachNode?: ((cloned: Node) => void | Promise<void>) | null
}

// 큰 지도를 복제하는 동안 메인 스레드가 오래 붙잡히면 로딩 시계와 회전 표시가 멈춘다.
// 복제 작업을 약 50ms마다 양보해 브라우저가 화면·타이머를 갱신하게 한다.
function yieldDuringCapture<T extends CloneCaptureOptions>(options: T) {
  const onCloneEachNode = options.onCloneEachNode
  let lastYieldAt = performance.now()
  return {
    ...options,
    onCloneEachNode: async (cloned: Node) => {
      await onCloneEachNode?.(cloned)
      if (performance.now() - lastYieldAt < 50) return
      await new Promise<void>(resolve => window.setTimeout(resolve, 0))
      lastYieldAt = performance.now()
    },
  }
}

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
  const captureStartedAt = performance.now()
  const baseOptions = shareScreenshotOptions(el, regionSelector, regionMode, onCloneNode, horizontalPadding)
  const options = regionSelector === '[data-map-mobile-capture-frame]'
    ? { ...baseOptions, scale: 2560 / MAP_MOBILE_CAPTURE_FRAME_HEIGHT }
    : baseOptions
  // 글꼴은 찍을 영역에 쓰인 조각만 넣는다(전부 넣으면 캡처마다 글꼴 조각 277개를 내려받는다). 고르지 못하면 라이브러리 기본 동작이다.
  const mobileFrame = regionSelector === '[data-map-mobile-capture-frame]'
    ? el.querySelector<HTMLElement>(regionSelector)
    : null
  const toolbar = mobileFrame ? el.querySelector<HTMLElement>('.main-toolbar') : null
  const fontCss = await fontCssFor(mobileFrame && toolbar ? [mobileFrame, toolbar] : el)
  const captureOptions = fontCss ? { ...options, font: { cssText: fontCss } } : options
  const dataUrl = await withScreenshotSandbox(el.ownerDocument, sandbox => domToPng(el, yieldDuringCapture({ ...captureOptions, sandbox } as ScreenshotOptions & { sandbox: HTMLIFrameElement })))
  if (regionSelector !== '[data-map-mobile-capture-frame]') return dataUrl

  // 이전 프레임 높이에서 남은 하단 여백을 캡처 이미지 자체에서 4 CSS px 더 잘라낸다.
  const croppedDataUrl = await cropMobileCaptureBottom(dataUrl, Math.round(4 * options.scale))
  reportClientMetric('MAP', 'MAP_MOBILE_CAPTURE', performance.now() - captureStartedAt)
  return croppedDataUrl
}

// 텔레그램 홈 모바일 판과 같은 크기(픽셀).
export const HOME_CAPTURE_FRAME_WIDTH = 810
export const HOME_CAPTURE_FRAME_HEIGHT = 1080
// 9:16 비율(810×1440). 모바일 캡처와 텔레그램이 같은 프레임·배율을 사용한다.
export const MAP_MOBILE_CAPTURE_FRAME_HEIGHT = 1440
// 상단 정보(왼쪽 툴바와 오른쪽 배지)가 고정 폭에 다 들어가지 않을 때 — 사용자에게 안내 문구를 그대로 보여 준다.
export class CaptureWidthError extends Error {
  constructor() {
    super('캡처 폭에 상단 정보가 모두 들어가지 않습니다.')
  }
}

// 텔레그램 홈 모바일 판과 같은 크기(픽셀)로 저장한다. 별도 리샘플링을 거치면 배지 글자 위치가 달라진다.
// 툴바는 각 틀 안에 원래 글자 크기로 배치해 전체 상단줄을 축소하지 않는다.
export async function screenshotFixedHomeFrameToDataUrl(root: HTMLElement, selector: string): Promise<string> {
  const frame = root.querySelector(selector)?.closest<HTMLElement>('[data-capture-fixed-frame]')
  if (!frame) throw new Error('Fixed home capture frame is unavailable')
  const toolbar = frame.querySelector<HTMLElement>('.home-capture-toolbar')
  const left = toolbar?.firstElementChild as HTMLElement | null
  const right = toolbar?.lastElementChild as HTMLElement | null
  if (!toolbar || !left || !right || left.scrollWidth + right.scrollWidth + 12 > toolbar.clientWidth) {
    throw new CaptureWidthError()
  }
  if (frame.offsetWidth !== HOME_CAPTURE_FRAME_WIDTH || frame.offsetHeight !== HOME_CAPTURE_FRAME_HEIGHT) throw new Error('Fixed home capture size is invalid')
  const options = { ...shareScreenshotOptions(frame), scale: 1 }
  const fontCss = await fontCssFor(frame)
  const captureOptions = fontCss ? { ...options, font: { cssText: fontCss } } : options
  return withScreenshotSandbox(frame.ownerDocument, sandbox => domToPng(frame, yieldDuringCapture({ ...captureOptions, sandbox } as ScreenshotOptions & { sandbox: HTMLIFrameElement })))
}
