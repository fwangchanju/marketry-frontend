// 메인 영역의 로딩·오류 원 래퍼. 모든 지도·그래프·섹터·종목·커스텀 페이지가 이 값만 쓴다(페이지마다 여백을 따로 두지 않는다).
// 공간을 차지하는 flex-1이라 하단 면책 문구가 제자리에 남고, 원은 메인 영역 세로 가운데에 온다(측정값 기준 -5px 보정).
export const MAIN_LOADING_CLASS = 'relative flex min-h-0 flex-1 items-center justify-center -translate-y-[5px]'
