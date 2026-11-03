// 설정 프로필은 MARKETRY / 거래소 / 내 기준이다. NXT는 특정 시간대 종목 필터의 내부 표현이며 별도 프로필이 아니다.
// 아래 타입에 NXT가 남아 있어도 설정 저장 범위를 분리하는 근거로 해석하지 않는다.
// 지도에서 고를 수 있는 분류. 화면에는 한글 이름(내 기준)이 보이고, 코드·주소 안의 값은 mine이다.
export type TaxonomyKey = 'KRX' | 'NXT' | 'MARKETRY' | 'MINE'

// 서버 지도 요청의 source 값 — NXT는 거래소의 한 모습이라 따로 없다.
export type TaxonomySource = 'KRX' | 'MARKETRY' | 'MINE'

export const TAXONOMY_NAMES = {
  // 지도 상단 표시(title)는 KRX와 NXT를 합친 거래소 분류 하나라 둘 다 같은 이름이다. 설정창의 "거래소" 버튼, 그룹 페이지와 같은 이름을 쓴다.
  KRX: { tab: 'KRX', title: '거래소' },
  NXT: { tab: 'NXT', title: '거래소' },
  MARKETRY: { tab: 'MARKETRY', title: 'MARKETRY' },
  MINE: { tab: '내 기준', title: '내 기준' },
} as const

// 설정창 아래쪽 선택 버튼 묶음(MARKETRY / 거래소 / 내 기준)의 제목. 이름을 또 바꿀 때는 여기만 고친다.
export const TAXONOMY_SELECT_TITLE = 'Basis'
