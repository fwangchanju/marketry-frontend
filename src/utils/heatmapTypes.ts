// 업종 헤더에 보여 줄 지표.
export type DepthMetric = 'weightedAvgChangeRate' | 'simpleAvgChangeRate' | 'upDownCount' | 'marketValue'

// 히트맵 종목 박스에 이름/등락률 중 뭘 보여줄지 — 슬라이더 인덱스로 저장(0~3). off는 둘 다 안 보여준다.
export type StockLabelMode = 'off' | 'nameOnly' | 'rateOnly' | 'both'
