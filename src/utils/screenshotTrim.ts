// 찍은 이미지에서 내용이 있는 부분만 남기고 사방에 같은 여백(margin 픽셀)을 둔다. 검은 바탕 위에 그린 이미지가 대상이다.
// 가장자리에 소수점 크기 때문에 찍기 바탕색(#0f1117)이 한두 픽셀 비치는 일이 있어서, 검정과 그 바탕색 근처는 내용으로 보지 않는다.
// 틀마다 안쪽 여백이 달라서(왼쪽 12px, 오른쪽 0 등) 영역을 잘라 찍으면 네 변의 여백이 제각각이라, 찍은 뒤 내용 기준으로 다시 맞춘다.
// 빨강·초록·파랑이 모두 이 값 이하이면 바탕이다(검정 0,0,0과 찍기 바탕색 15,17,23 둘 다 여기 든다). 가장 어두운 박스(네이비)는 파랑이 이보다 훨씬 커서 내용으로 남는다.
const BACKGROUND_MAX = [30, 30, 36] as const

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('이미지를 읽지 못했습니다'))
    image.src = src
  })
}

export async function trimToContent(dataUrl: string, margin: number): Promise<string> {
  const image = await loadImage(dataUrl)
  const { width, height } = image
  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const sourceContext = source.getContext('2d')
  if (!sourceContext) return dataUrl
  sourceContext.drawImage(image, 0, 0)
  const pixels = sourceContext.getImageData(0, 0, width, height).data

  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      if (pixels[index] <= BACKGROUND_MAX[0] && pixels[index + 1] <= BACKGROUND_MAX[1] && pixels[index + 2] <= BACKGROUND_MAX[2]) continue
      if (x < left) left = x
      if (x > right) right = x
      if (y < top) top = y
      if (y > bottom) bottom = y
    }
  }
  if (right < left || bottom < top) return dataUrl

  const pad = Math.round(margin)
  const trimmed = document.createElement('canvas')
  trimmed.width = right - left + 1 + pad * 2
  trimmed.height = bottom - top + 1 + pad * 2
  const trimmedContext = trimmed.getContext('2d')
  if (!trimmedContext) return dataUrl
  trimmedContext.fillStyle = '#000000'
  trimmedContext.fillRect(0, 0, trimmed.width, trimmed.height)
  trimmedContext.drawImage(source, left, top, right - left + 1, bottom - top + 1, pad, pad, right - left + 1, bottom - top + 1)
  return trimmed.toDataURL('image/png')
}
