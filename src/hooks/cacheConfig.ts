export const MARKET_DATA_CACHE = {
  staleTime: 60_000,
  refetchInterval: 60_000,
  // 다른 창을 보다 돌아오면 1분이 지난 시세는 바로 새로 받는다(2026-11-27 사용자 결정, 한국·일본·미국 공통). 앱 전체 기본은 꺼져 있다.
  // 뒤에 가려진 탭은 주기 갱신을 멈추므로, 돌아왔을 때 옛 시세를 보지 않게 하려는 것이다.
  refetchOnWindowFocus: true,
} as const

// 하루 한 번(고정 시각) 갱신되거나, 외부 요인으로 가끔 바뀌는 데이터용.
// staleTime을 갱신 주기(예: 24시간)에 맞추지 않는 이유: staleTime은 "마지막 조회 시점부터"
// 상대적으로 흐르는 시간이라, 캐시가 언제 만들어졌느냐에 따라 실제 갱신 시각과 어긋날 수 있음
// (최악의 경우 갱신 시각 직후부터 다음날 그 시각까지 낡은 데이터를 계속 보여줄 수 있음).
// 짧은 주기로 두면 캐시 생성 시점과 무관하게 갱신 시각 이후 곧 따라잡음.
export const INFREQUENT_DATA_CACHE = {
  staleTime: 5 * 60_000,
  refetchInterval: 5 * 60_000,
} as const

export const STATIC_REFERENCE_CACHE = {
  staleTime: Infinity,
  refetchInterval: false,
} as const
