// 대시보드 인원 수 표기 — 카드 종류가 달라도 한국식 자릿수 구분을 통일한다.
export function formatCount(value: number): string {
  return value.toLocaleString('ko-KR')
}
