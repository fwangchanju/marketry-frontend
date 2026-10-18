// 4-1) 강조 색상: 위 7칸은 밝고 선명한 톤, 아래 7칸은 부드러운 톤이다.
// 같은 열끼리 색 계열을 맞춘다. 기존 형광색과 상단바 시간대 점의 색상 값은 유지한다.
export const ACCENT_PALETTE = [
  { label: '흰색', value: '#ffffff' },
  { label: '코랄', value: '#ff7b72' },
  { label: '선명한 주황', value: '#ffad33' },
  { label: '선명한 노랑', value: '#fff000' },
  { label: '형광', value: '#c6ff00' },
  { label: '선명한 하늘', value: '#4de4ff' },
  { label: '선명한 보라', value: '#bc8cff' },
  { label: '연회색', value: '#e5e7eb' },
  { label: '분홍', value: '#fccbcd' },
  { label: '연주황', value: '#ffc999' },
  { label: '연노랑', value: '#fff59d' },
  { label: '연두', value: '#d8ed77' },
  { label: '하늘', value: '#90bff9' },
  { label: '연보라', value: '#b39ddb' },
] as const

export type AccentColorLabel = (typeof ACCENT_PALETTE)[number]['label']

export function accentColor(label: AccentColorLabel): string {
  return ACCENT_PALETTE.find(color => color.label === label)!.value
}
