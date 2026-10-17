// 지도 설정 색상 탭 4-1) 강조 색상의 8칸 색 — 설정 화면의 선택지와 상단바 시간대 점이 같은 값을 쓰도록 한 곳에 둔다.
// 등락률 색상(4-3)의 8칸(회색·빨강·주황·노랑·초록·파랑·보라·자홍)과 같은 자리에 그 색의 옅은 버전을 둔다 — 두 줄이 같은 8칸으로 같은 간격에 놓인다.
// 이름도 4-3과 겹치지 않게 한다(4-3의 보라·자홍·주황과 다른 색이므로 연보라·연자홍·연주황). 청록은 홈페이지 메인색과 같아서 뺐다.
export const ACCENT_PALETTE = [
  { label: '연회색', value: '#e5e7eb' },
  { label: '분홍', value: '#fccbcd' },
  { label: '연주황', value: '#ffc999' },
  { label: '연노랑', value: '#fff59d' },
  { label: '형광', value: '#c6ff00' },
  { label: '하늘', value: '#90bff9' },
  { label: '연보라', value: '#b39ddb' },
  { label: '연자홍', value: '#eea0e1' },
] as const

export type AccentColorLabel = (typeof ACCENT_PALETTE)[number]['label']

export function accentColor(label: AccentColorLabel): string {
  return ACCENT_PALETTE.find(color => color.label === label)!.value
}
