import { domToPng } from 'modern-screenshot'
import { shareScreenshotOptions } from './screenshotScale'

async function cropUniformBottom(dataUrl: string, keepBottom = 0): Promise<string> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return dataUrl
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  const rowIsBackground = (y: number, r: number, g: number, b: number, a: number) => {
    const start = y * canvas.width * 4
    let backgroundPixels = 0
    for (let x = 0; x < canvas.width; x += 1) {
      const index = start + x * 4
      if (
        Math.abs(pixels[index] - r) <= 3 && Math.abs(pixels[index + 1] - g) <= 3 &&
        Math.abs(pixels[index + 2] - b) <= 3 && Math.abs(pixels[index + 3] - a) <= 3
      ) backgroundPixels += 1
    }
    // 가장자리 안티앨리어싱이나 몇 픽셀짜리 선은 허용하되, 사실상 배경색인 행만 빈 공간으로 본다.
    return backgroundPixels / canvas.width >= 0.995
  }
  const bottom = (canvas.height - 1) * canvas.width * 4
  const [r, g, b, a] = pixels.slice(bottom, bottom + 4)
  let contentHeight = canvas.height
  while (contentHeight > 1 && rowIsBackground(contentHeight - 1, r, g, b, a)) contentHeight -= 1
  // 바탕과 거의 같은 줄만 걷어낸다. 타일이 닿은 마지막 줄은 보존한다.
  if (canvas.height - contentHeight < 2) return dataUrl
  const cropped = document.createElement('canvas')
  const croppedHeight = Math.min(canvas.height, contentHeight + keepBottom)
  cropped.width = canvas.width
  cropped.height = croppedHeight
  cropped.getContext('2d')?.drawImage(canvas, 0, 0, canvas.width, croppedHeight, 0, 0, canvas.width, croppedHeight)
  return cropped.toDataURL('image/png')
}

// 공유 이미지는 긴 변이 1280px이 되게 찍고, 작은 박스의 글자는 뺀다(screenshotScale.ts 참고).
// regionSelector를 주면 맨 왼쪽부터 그 요소의 오른쪽 끝까지만 찍는다.
export async function screenshotElementToDataUrl(el: HTMLElement, regionSelector?: string, regionMode?: 'through-right-edge' | 'element' | 'content', onCloneNode?: (cloned: Node) => void, horizontalPadding = 0): Promise<string> {
  const dataUrl = await domToPng(el, shareScreenshotOptions(el, regionSelector, regionMode, onCloneNode, horizontalPadding))
  return regionSelector === '[data-map-mobile-capture-frame]' ? cropUniformBottom(dataUrl, 4) : dataUrl
}
