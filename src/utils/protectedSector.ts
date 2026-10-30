// 삭제·이름 변경·이동·하위 업종 만들기가 막힌 보호 업종(서버도 막는다). 모든 사용자에게 항상 대분류로 있고, 업종 표에서 항상 맨 아래에 미분류 → 신규 상장 → 거래 정지 순서로 놓는다.
export const NEW_LISTING_SECTOR_NAME = '신규 상장'
export const SUSPENDED_SECTOR_NAME = '거래 정지'
export const UNCLASSIFIED_SECTOR_NAME = '미분류'
export const PROTECTED_SECTOR_NAMES = [UNCLASSIFIED_SECTOR_NAME, NEW_LISTING_SECTOR_NAME, SUSPENDED_SECTOR_NAME] as const

// 업종 표에서 보호 업종을 눈에 띄게 하는 서브 노랑 글자.
export const PROTECTED_SECTOR_TEXT_CLASS = 'text-[var(--sub-yellow)]'

// 이름에 마우스를 올렸을 때 공통 툴팁(data-hint)으로 보여 주는 안내.
const PROTECTED_SECTOR_HINTS: Record<string, string> = {
  [NEW_LISTING_SECTOR_NAME]: '신규 상장시 이 그룹으로 자동 배정됩니다.\n~~(거래소 모드에서는 거래소 기준으로 배정됩니다.)~~',
  [SUSPENDED_SECTOR_NAME]: '연속 5거래일 이상 거래가 정지된 종목이 이 그룹으로 자동 배정되며, 다른 업종으로 옮길 수 없습니다.',
  [UNCLASSIFIED_SECTOR_NAME]: '삭제한 업종의 종목과 거래가 재개된 종목이 이 그룹으로 옮겨집니다.',
}

// 삭제하려고 할 때 "삭제 불가" 팝업에 쓰는 안내.
const PROTECTED_SECTOR_DELETE_MESSAGES: Record<string, string> = {
  [NEW_LISTING_SECTOR_NAME]: '신규 상장시 자동 분류되는 항목이라 삭제가 불가능합니다.',
  [SUSPENDED_SECTOR_NAME]: '거래 정지 종목이 자동 분류되는 항목이라 삭제가 불가능합니다.',
  [UNCLASSIFIED_SECTOR_NAME]: '삭제한 업종의 종목이 옮겨 오는 항목이라 삭제가 불가능합니다.',
}

// 거래 정지 종목은 서버가 거래 정지 업종에 자동 배정하고, 사용자(운영자 포함)는 그 업종에 종목을 직접 넣거나 거기서 다른 업종으로 옮길 수 없다.
export const SUSPENDED_STOCK_HINT = '거래 정지 종목은 다른 업종으로 옮길 수 없습니다.'
export const isSuspendedSectorName = (name: string | null | undefined) => name === SUSPENDED_SECTOR_NAME

export const isProtectedSectorName = (name: string) => (PROTECTED_SECTOR_NAMES as readonly string[]).includes(name)
// 거래소 표에는 거래 정지만 있다 — 읽기 전용이고, 재개되면 서버가 다음 조회부터 키움 업종으로 돌려놓는다.
const KRX_SUSPENDED_HINT = '연속 5거래일 이상 거래가 정지된 종목이 이 그룹으로 묶입니다.\n재개되면 원래 거래소 업종으로 돌아갑니다.'
export const getProtectedSectorHint = (name: string, source: 'MARKETRY' | 'KRX' = 'MARKETRY'): string | undefined =>
  source === 'KRX' && name === SUSPENDED_SECTOR_NAME ? KRX_SUSPENDED_HINT : PROTECTED_SECTOR_HINTS[name]
export const getProtectedSectorDeleteMessage = (name: string): string => PROTECTED_SECTOR_DELETE_MESSAGES[name] ?? '삭제가 불가능한 항목입니다.'
// 맨 아래에 놓는 순서 — 보호 업종이 아니면 -1이다.
export const protectedSectorOrder = (name: string) => (PROTECTED_SECTOR_NAMES as readonly string[]).indexOf(name)

// 정렬한 업종 목록에서 보호 업종을 빼 맨 아래로 보낸다(정렬 방향과 상관없이 항상 미분류 → 신규 상장 → 거래 정지 순서).
// names는 맨 아래로 보낼 업종(기본은 보호 업종 셋)이다. 거래소 표는 거래 정지만 보낸다.
export function placeProtectedSectorsLast<T>(items: T[], getName: (item: T) => string, names: readonly string[] = PROTECTED_SECTOR_NAMES): T[] {
  const regular = items.filter(item => !names.includes(getName(item)))
  const protectedItems = items
    .filter(item => names.includes(getName(item)))
    .sort((a, b) => names.indexOf(getName(a)) - names.indexOf(getName(b)))
  return [...regular, ...protectedItems]
}
