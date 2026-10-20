// 지도 설정의 기본값 — 사용자가 값을 바꾸기 전(저장값이 없을 때)에 보이는 값을 한 곳에 모았다.
// 기본값을 바꾸려면 이 파일만 고치면 된다. 사용자가 값을 바꿔서 저장값이 생기면 그 값이 항상 기본값보다 우선한다
// (로그인 사용자는 서버 설정, 비로그인은 이 탭의 sessionStorage — usePageSetting 참고).
//
// 회원 기본값(MEMBER_DEFAULTS)을 비로그인 기본값(GUEST_DEFAULTS)에서도 그대로 사용한다.
// 비회원과 가입 직후 회원은 모든 설정 기본값을 공유한다.
// 항목 이름 뒤의 번호는 지도 설정창의 항목 번호다.

export type DepthMetricDefault = 'weightedAvgChangeRate' | 'simpleAvgChangeRate'

export interface SettingDefaults {
  // 분류 체계 — true는 MARKETRY 분류다. 비로그인은 이 값과 상관없이 내 분류를 쓸 수 없다(useGlobalSettings).
  isCustom: boolean
  // 1-1 업종 분류 깊이: 켜짐 여부와 단계(1=대분류, 2=중분류, 3=소분류)
  sectorLevelEnabled: boolean
  maxDepth: number
  // 1-2 표시 지표
  depthMetric: DepthMetricDefault
  // 1-3 표시 위치: 단계 범위(0=대분류, 1=중분류, 2=소분류)
  depthMetricMinIndex: number
  depthMetricMaxIndex: number
  // 4-3 상위 업종 강조: 단계(0=대분류, 1=중분류, 2=소분류)와 개수
  topPickDepth: number
  topPickCount: number
  // 2-1 시가총액 범위: 'all'은 모든 구간, 'excludeDefaultTiers'는 기본 제외 구간(소형주)을 뺀다,
  // 'topTwoTiers'는 시가총액이 큰 두 구간(초대형주+대형주)만, 'topThreeTiers'는 큰 세 구간(중형주까지)을 보여준다
  tierRange: 'all' | 'excludeDefaultTiers' | 'topTwoTiers' | 'topThreeTiers'
  // 업종 등락 방향 필터('all' | 'rising' | 'falling')와 그 업종 단계(0=대분류) — 관리자 페이지 미사용 탭으로 옮김(서버에 저장하지 않고 브라우저에만 둔다)
  // 2-3 종목 등락 방향 필터
  sectorChangeFilter: 'all' | 'rising' | 'falling'
  sectorChangeDepth: number
  stockChangeFilter: 'all' | 'rising' | 'falling'
  // 2-2 제외 업종 변경 사용 여부
  sectorFilterEnabled: boolean
  // 3-1 박스 크기: 시가총액 반영 비율(0=동일 크기 ~ 100=시가총액 비례)
  boxSizeMarketCapRatio: number
  // 3-2 박스 내 표기: 0=끄기, 1=종목명, 2=등락률, 3=종목명+등락률
  stockLabelModeIndex: number
  // 텍스트 표시 기준(관리자 페이지 미사용 탭으로 옮김 — 서버에 저장하지 않고 브라우저에만 둔다): 전체 면적 대비 박스 면적 비율(%)
  boxLabelMinAreaPercent: number
  // 3-3 등락률 소수점: 0=정수, 1=1자리, 2=2자리
  decimalPlacesIndex: number
  // 종목 정보(관리자 페이지 미사용 탭) 팝업: true면 커서를 올릴 때, false면 우클릭으로 연다
  stockPopupOnHover: boolean
  // 4-2 강조 색상
  strongIndustryColor: string
  // 4-1 등락률 색상 범위 커스텀 사용 여부
  colorCustomOn: boolean
  // 섹터 랭킹/그룹 화면의 평균 방식(true=동일 가중)
  avgChangeRateUseSimple: boolean
  // 설정창: 핀 켜짐(고정 + 열린 채로 시작)
  sidebarPinned: boolean
}

export const MEMBER_DEFAULTS: SettingDefaults = {
  isCustom: true,
  sectorLevelEnabled: true,
  maxDepth: 2, // 1-1 중분류까지
  depthMetric: 'weightedAvgChangeRate', // 1-2 시총 가중
  depthMetricMinIndex: 0,
  depthMetricMaxIndex: 1, // 1-3 대분류~중분류
  topPickDepth: 1, // 4-2 중분류
  topPickCount: 3, // 4-3 상위 업종 강조 3개
  tierRange: 'topThreeTiers', // 2-1 중형주까지
  sectorChangeFilter: 'all',
  sectorChangeDepth: 0,
  stockChangeFilter: 'all',
  sectorFilterEnabled: true,
  boxSizeMarketCapRatio: 45, // 3-1 45%
  stockLabelModeIndex: 3,
  boxLabelMinAreaPercent: 0.01, // 미사용 탭 텍스트 표시 기준 0.01%
  decimalPlacesIndex: 1, // 3-3 1자리
  stockPopupOnHover: false,
  strongIndustryColor: '#d8ed77', // 4-1 연두
  colorCustomOn: true,
  avgChangeRateUseSimple: false, // 그룹 등락률 기준: 시총 가중
  sidebarPinned: true,
}

export const GUEST_DEFAULTS: SettingDefaults = { ...MEMBER_DEFAULTS }

export function settingDefaultsFor(isLoggedIn: boolean): SettingDefaults {
  return isLoggedIn ? MEMBER_DEFAULTS : GUEST_DEFAULTS
}
