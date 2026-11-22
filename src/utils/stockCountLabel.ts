import { toCount } from './format.ts'

// 설정창 상단의 "n/m종목" 양식. 화면·시장과 관계없이 두 값 모두 같은 쉼표 표기를 쓴다.
// 시간대 필터나 시장별 데이터 출처로 값이 달라지는 건 각 화면의 계산에 남긴다.
export function formatStockCountLabel(visibleCount: number, totalCount: number): string {
  return `${toCount(visibleCount)}/${toCount(totalCount)}종목`
}
