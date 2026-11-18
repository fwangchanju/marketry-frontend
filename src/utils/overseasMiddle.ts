import type { OverseasMarket } from '@/utils/markets'

// 해외 시장마다 설정창 Mode의 가운데 칸이 무엇인지 한곳에서 정한다.
// 한국의 "거래소"처럼 외부 분류를 보여 주는 칸이다. 새 시장(대만 등)은 여기에 한 줄을 더하면 된다.
// externalReady가 false인 시장은 칸 이름만 보이고 잠긴 상태로 둔다(데이터가 준비되면 true로 바꾼다).
export const OVERSEAS_MIDDLE: Record<OverseasMarket, { label: string; externalReady: boolean }> = {
  JAPAN: { label: '모닝스타', externalReady: false },
  USA: { label: 'GICS', externalReady: true },
}

export type OverseasMiddleMode = 'MARKETRY' | 'EXTERNAL'

// 같은 화면 안의 여러 훅이 가운데 칸 선택을 함께 맞추도록 알리는 이벤트 이름.
export const OVERSEAS_MIDDLE_EVENT = 'marketry:overseas-middle'

export function overseasMiddleLabel(market: OverseasMarket): string {
  return OVERSEAS_MIDDLE[market].label
}

// 시장마다 따로 저장한다. 한국의 공통 모드(heatmap.taxonomySelection)와 섞이지 않게 키를 나눈다.
export function overseasMiddleStorageKey(market: OverseasMarket): string {
  return `heatmap.overseasMiddle.${market}`
}

export function readOverseasMiddle(market: OverseasMarket, storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): OverseasMiddleMode {
  try {
    return storage?.getItem(overseasMiddleStorageKey(market)) === 'EXTERNAL' && OVERSEAS_MIDDLE[market].externalReady ? 'EXTERNAL' : 'MARKETRY'
  } catch {
    return 'MARKETRY'
  }
}
