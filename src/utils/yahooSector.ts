// 야후 파이낸스가 주는 영어 섹터 이름의 한글 표기. 스톡 표의 "야후 섹터" 칸이 쓴다.
// 야후 섹터는 11개로 정해져 있고(미국·일본 같다), 표에 없는 이름은 영어 그대로 보여 준다.
const YAHOO_SECTOR_KO: Readonly<Record<string, string>> = {
  'Basic Materials': '소재',
  'Communication Services': '통신·미디어',
  'Consumer Cyclical': '경기 소비재',
  'Consumer Defensive': '필수 소비재',
  Energy: '에너지',
  'Financial Services': '금융',
  Healthcare: '헬스케어',
  Industrials: '산업재',
  'Real Estate': '부동산',
  Technology: '기술',
  Utilities: '유틸리티',
}

export function yahooSectorKo(sector: string): string {
  return YAHOO_SECTOR_KO[sector] ?? sector
}
