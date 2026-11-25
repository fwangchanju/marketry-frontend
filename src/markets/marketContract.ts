import type { ReactNode } from 'react'
import type { CurrencyUnit } from '@/utils/currencyUnit'
import type { HeatmapSectorNode } from '@/types/api'

// 모든 시장이 화면에 넘겨야 하는 것. 화면은 이 모양만 알고 어느 시장인지, 시세가 어디서 오는지 묻지 않는다.
// 필수 항목에 ?(생략 가능)를 붙이지 않는다 — 한 시장이라도 빠뜨리면 빌드가 실패해야 한다.
export const MARKET_IDS = ['KOREA', 'JAPAN', 'USA'] as const
export type MarketId = (typeof MARKET_IDS)[number]

// 지수 막대. 그 날짜의 값이 없으면 항목을 빼지 말고 이유를 넘긴다(빠뜨린 것과 정말 없는 것을 구분한다).
export type MarketIndexBar =
  | { key: string; name: string; value: number }
  | { key: string; name: string; value: null; reason: string }

// 자료 상태. 로딩·실패·다시 시도를 따로 빠뜨릴 수 없게 한 덩어리로 넘긴다.
export type MarketDataState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready' }

export interface MarketPeriod {
  snapshotTime: string | null
  liveSnapshotTime: string | null
  // 지난 날짜나 기간을 보는 중인지.
  isPast: boolean
  rangeStart: string | null
  excludedStocks: { stockCode: string; stockName: string }[]
  clear: () => void
  // 날짜 고르기. 달력 모양은 같고 날짜 목록만 시장마다 다르다.
  picker: ReactNode
}

// 나라마다 있고 없는 기능. 없으면 null을 넘긴다. 화면은 시장 이름이 아니라 이 값이 있는지만 본다.
export interface MarketFeatures {
  subMarkets: { id: string; label: string }[] | null
  afterHours: boolean
  // 정해진 시간대에 종목을 거르는 동안의 안내.
  timeWindowNotice: ReactNode | null
  exchangeTaxonomy: boolean
  intradayDelta: boolean
}

export interface MarketScreenData {
  id: MarketId
  label: string
  currencyUnit: CurrencyUnit
  // 장 상태(와 있으면 등락률 기준). 지난 날짜·기간에는 화면이 숨긴다.
  session: ReactNode
  tree: HeatmapSectorNode[]
  // 빈 목록으로 빠져나가지 못하게 하나 이상을 요구한다.
  indexBars: [MarketIndexBar, ...MarketIndexBar[]]
  state: MarketDataState
  // 상태와 관계없이 새로고침 칸이 쓰는 값.
  refresh: { run: () => void; isRunning: boolean; help: string }
  period: MarketPeriod
  isMineEmpty: boolean
  // 내 기준을 만들러 가는 주소(그 시장의 SECTOR).
  mineSetupPath: string
  features: MarketFeatures
}

// 화면이 쓰는 시장 목록의 모양. 시장이 하나라도 빠지면 빌드가 실패한다.
export type MarketRegistry<T> = Readonly<Record<MarketId, T>>
