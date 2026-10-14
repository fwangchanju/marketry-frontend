// 글자만 담은 알림창(커서 말풍선, ? 도움말, 새로고침·툴바 설명, 호버 설명)의 공통 모양 — 위아래 여백(py-1)과 줄 간격(leading-snug)을
// 한 곳에서 정해서 알림창마다 높이가 달라 보이지 않게 한다. 폭·위치·줄바꿈 방식은 알림창마다 다르니 각자 덧붙인다.
export const HINT_BUBBLE_COLOR_CLASS = 'rounded border border-[#7a6d55] bg-[#fff8e7] text-black shadow-lg'

// 색은 위와 같고 글자 크기·여백이 다른 알림(예: 지도 한가운데 안내창)은 HINT_BUBBLE_COLOR_CLASS만 쓰고 나머지를 직접 정한다.
// break-keep은 한글을 글자 중간이 아니라 띄어쓰기에서만 줄바꿈하게 한다.
// font-normal·tracking-normal: 말풍선이 굵은 글씨나 좁은 자간의 줄(예: 시계 옆 시각 스타일) 안에서 열려도 그 글자 모양을 물려받지 않고 항상 같은 모양이 되게 한다.
// 확인창·알림창·안내창(가운데 팝업)의 공통 크기 — 폭은 max-w-sm으로 같고, 높이는 본문이 3줄일 때(198px)에 맞춰 최소 높이를 두어 짧은 창도 같은 크기로 보이게 한다. 버튼 줄은 맨 아래에 붙는다.
export const POPUP_SIZE_CLASS = 'flex min-h-[198px] w-full max-w-sm flex-col p-5'

export const HINT_BUBBLE_CLASS = `${HINT_BUBBLE_COLOR_CLASS} px-2 py-1 text-left text-xs font-normal tracking-normal leading-snug break-keep`
