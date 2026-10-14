// 프로필 사진을 올리기 전에 브라우저에서 가운데 정사각형 256×256 JPEG로 줄인다 — 서버(nginx) 업로드 한도 안에 들어오게 하고, 서버가 같은 규칙으로 다시 한 번 만든다.
export const PROFILE_IMAGE_SIZE = 256
// 고른 원본의 한도 — 휴대폰 사진(3~8MB)·카메라 JPEG도 그대로 고를 수 있게 둔다. 올리는 것은 줄인 256×256 JPEG라서 서버 한도와 상관없다.
export const PROFILE_IMAGE_MAX_SOURCE_BYTES = 10 * 1024 * 1024
export const PROFILE_IMAGE_MAX_UPLOAD_BYTES = 512 * 1024
const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png']
const JPEG_QUALITY = 0.85

export type ProfileImageCheckError = 'type' | 'size'

export function checkProfileImageFile(file: File): ProfileImageCheckError | null {
  if (!PROFILE_IMAGE_TYPES.includes(file.type)) return 'type'
  if (file.size > PROFILE_IMAGE_MAX_SOURCE_BYTES) return 'size'
  return null
}

// 디코드에 실패하면(예: 확장자만 .jpg인 HEIC) 던진다.
export async function resizeProfileImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = PROFILE_IMAGE_SIZE
    canvas.height = PROFILE_IMAGE_SIZE
    const context = canvas.getContext('2d')
    if (context === null) throw new Error('canvas를 쓸 수 없습니다.')
    // 투명 PNG는 흰 배경에 합성한다.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE)
    const left = (image.naturalWidth - side) / 2
    const top = (image.naturalHeight - side) / 2
    context.drawImage(image, left, top, side, side, 0, 0, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_SIZE)
    return await toBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('사진을 읽지 못했습니다.'))
    image.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob === null ? reject(new Error('사진을 줄이지 못했습니다.')) : resolve(blob)), 'image/jpeg', JPEG_QUALITY)
  })
}
