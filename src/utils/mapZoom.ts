// 모바일 종목 지도의 확대·이동 계산. 화면 위치 = 기준 위치 × scale + (x, y)다.
// 박스는 CSS로 늘리지 않고 확대한 좌표·크기로 다시 놓아서, 커진 박스 안에 이름이 들어가면 이름을 새로 그린다.
export interface ZoomTransform {
  scale: number
  x: number
  y: number
}
export interface Point {
  x: number
  y: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 6
export const IDENTITY: ZoomTransform = { scale: 1, x: 0, y: 0 }

// 지도가 영역을 벗어나 빈 곳이 보이지 않게 이동 범위를 제한한다.
export function clampTransform(transform: ZoomTransform, width: number, height: number): ZoomTransform {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, transform.scale))
  const x = Math.min(0, Math.max(width - width * scale, transform.x))
  const y = Math.min(0, Math.max(height - height * scale, transform.y))
  return { scale, x, y }
}

// 두 손가락 확대 — 처음 잡은 두 손가락 가운데(startMid) 아래에 있던 지도 위치가 지금 가운데(mid)를 따라가게 한다.
export function pinchTransform(start: ZoomTransform, startDistance: number, startMid: Point, distance: number, mid: Point, width: number, height: number): ZoomTransform {
  if (startDistance <= 0) return clampTransform(start, width, height)
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, start.scale * distance / startDistance))
  const ratio = scale / start.scale
  return clampTransform({ scale, x: mid.x - (startMid.x - start.x) * ratio, y: mid.y - (startMid.y - start.y) * ratio }, width, height)
}

export function panTransform(start: ZoomTransform, dx: number, dy: number, width: number, height: number): ZoomTransform {
  return clampTransform({ scale: start.scale, x: start.x + dx, y: start.y + dy }, width, height)
}
