import type { TaxonomyKey } from '@/utils/taxonomyNames'

// ─── 지도 배치 기본값 ───────────────────────────────────────────────────────────
//   다시 쓰려면: DEFAULT_MAP_TILE을 'binary'로, DEFAULT_STRETCH의 세 값을 모두 1.6으로 바꾼다. 다른 파일은 고치지 않는다.
// 이름: 모양 우선 = squarify(박스를 정사각형에 가깝게 놓는다), 순서 우선 = binary(시가총액 큰 순서가 배치에서도 이어진다).
export type MapTileMethod = 'squarify' | 'binary'
export const DEFAULT_MAP_TILE: MapTileMethod = 'squarify'
// 분류마다 가로 늘리기 배율(1이면 그대로, 1~3).
const DEFAULT_STRETCH = { KRX: 1, MARKETRY: 1, MINE: 1 } as const

// 비교용 주소 덮어쓰기(저장되지 않는다) — 주소 끝에 붙이면 기본값 대신 그 값으로 한 번 본다.
//   ?tile=squarify          모양 우선으로 보기
//   ?tile=binary            순서 우선
//   ?stretch=1              모든 분류의 가로 늘리기를 1(없음)로 보기, 값은 1~3
//   ?stretchKRX=2.2         거래소만 덮어쓰기 (?stretchMARKETRY=, ?stretchMINE= 도 같다)
// 개별 값이 전체 값(?stretch=)보다 우선한다.
const PARAM_BY_TARGET = { KRX: 'stretchKRX', MARKETRY: 'stretchMARKETRY', MINE: 'stretchMINE' } as const

function readStretch(params: URLSearchParams, name: string): number | null {
  const raw = params.get(name)
  const value = Number(raw)
  return raw !== null && Number.isFinite(value) && value >= 1 && value <= 3 ? value : null
}

export function mapStretchFor(taxonomy: TaxonomyKey): number {
  const params = new URLSearchParams(window.location.search)
  // NXT 보기는 거래소 분류의 한 모습이라 거래소 값을 쓴다.
  const target = taxonomy === 'NXT' ? 'KRX' : taxonomy
  return readStretch(params, PARAM_BY_TARGET[target]) ?? readStretch(params, 'stretch') ?? DEFAULT_STRETCH[target]
}

export function mapTileMethod(): MapTileMethod {
  const tile = new URLSearchParams(window.location.search).get('tile')
  return tile === 'binary' || tile === 'squarify' ? tile : DEFAULT_MAP_TILE
}
