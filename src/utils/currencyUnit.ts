// 지도 부품이 시가총액 뒤에 붙이는 화폐 단위 글자. 원은 붙이지 않는다(국내 화면은 단위를 따로 안내한다).
export type CurrencyUnit = '원' | '엔' | '달러'

export const currencySuffix = (unit: CurrencyUnit): string => (unit === '엔' ? ' 엔' : unit === '달러' ? ' 달러' : '')
