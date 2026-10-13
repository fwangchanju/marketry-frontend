// 로컬 mock 서버(MSW)용 가짜 데이터. 실제 화면 확인용이라 값 자체의 정확성은 중요하지 않음.

import type { MarketMapSectorNode, MarketMapItem } from '@/types/api'

const now = () => new Date().toISOString().slice(0, 19)

export const marketOverviews = [
  {
    market: 'KOSPI' as const,
    marketStatus: '장중',
    indexValue: 2612.34,
    changeValue: 12.5,
    changeRate: 0.48,
    tradingValue: 8_231_000,
    upperLimitCount: 3,
    lowerLimitCount: 1,
    advancers: 512,
    decliners: 340,
    unchangedCount: 87,
    snapshotTime: now(),
  },
  {
    market: 'KOSDAQ' as const,
    marketStatus: '장중',
    indexValue: 812.11,
    changeValue: -3.2,
    changeRate: -0.39,
    tradingValue: 4_112_000,
    upperLimitCount: 5,
    lowerLimitCount: 2,
    advancers: 601,
    decliners: 480,
    unchangedCount: 120,
    snapshotTime: now(),
  },
]

// 시가총액 구간 정의 목업 — GET /market-map/value-tiers, thresholdValue 오름차순(백엔드 계약과 동일).
export const marketValueTiers = [
  { id: 1, label: '소형주', thresholdValue: 0, isExcludedByDefault: true },
  { id: 2, label: '중형주', thresholdValue: 500_000_000_000, isExcludedByDefault: false },
  { id: 3, label: '대형주', thresholdValue: 5_000_000_000_000, isExcludedByDefault: false },
  { id: 4, label: 'Top 2', thresholdValue: 500_000_000_000_000, isExcludedByDefault: false },
]

// 섹터 7~18처럼 종목 상세가 중요하지 않은 자리에 대표 종목 하나만 채울 때 쓴다.
function soloItem(
  stockCode: string,
  stockName: string,
  totalMarketValue: number,
  marketValueTier: string,
  changeRate: number,
): MarketMapItem[] {
  return [
    {
      stockCode,
      stockName,
      alias: null,
      lastPrice: 50_000,
      totalMarketValue,
      marketValueTier,
      changeRate,
      currentPrice: 50_000,
      snapshotTime: now(),
    },
  ]
}

export const marketMapTree: MarketMapSectorNode[] = [
  {
    sectorId: 1,
    sectorName: '반도체',
    totalMarketValue: 550_000_000_000_000,
    isExcluded: false,
    items: [],
    children: [
      {
        sectorId: 4,
        sectorName: '메모리',
        totalMarketValue: 420_000_000_000_000,
        isExcluded: false,
        items: [
          // alias 예시 — 박스 라벨은 "삼전"으로, 팝업(툴팁)은 원래 이름 "삼성전자"로 보여야 한다.
          { stockCode: '005930', stockName: '삼성전자', alias: '삼전', lastPrice: 71000, totalMarketValue: 420_000_000_000_000, marketValueTier: 'Top 2', changeRate: 1.2, currentPrice: 71000, snapshotTime: now() },
        ],
        children: [],
      },
      {
        sectorId: 5,
        sectorName: '파운드리',
        totalMarketValue: 130_000_000_000_000,
        isExcluded: false,
        items: [
          { stockCode: '000660', stockName: 'SK하이닉스', alias: null, lastPrice: 178000, totalMarketValue: 130_000_000_000_000, marketValueTier: 'Top 2', changeRate: -0.8, currentPrice: 178000, snapshotTime: now() },
        ],
        children: [],
      },
    ],
  },
  {
    sectorId: 2,
    sectorName: '2차전지',
    totalMarketValue: 122_000_000_000_000,
    isExcluded: false,
    items: [
      { stockCode: '373220', stockName: 'LG에너지솔루션', alias: null, lastPrice: 398000, totalMarketValue: 93_000_000_000_000, marketValueTier: '대형주', changeRate: -1.5, currentPrice: 398000, snapshotTime: now() },
    ],
    children: [
      {
        sectorId: 6,
        sectorName: '양극재',
        totalMarketValue: 29_000_000_000_000,
        isExcluded: false,
        items: [
          { stockCode: '051910', stockName: 'LG화학', alias: null, lastPrice: 412000, totalMarketValue: 29_000_000_000_000, marketValueTier: '대형주', changeRate: 2.1, currentPrice: 412000, snapshotTime: now() },
        ],
        children: [],
      },
    ],
  },
  {
    sectorId: 3,
    sectorName: '인터넷/플랫폼',
    totalMarketValue: 50_000_000_000_000,
    isExcluded: false,
    items: [
      { stockCode: '035420', stockName: 'NAVER', alias: null, lastPrice: 198000, totalMarketValue: 32_000_000_000_000, marketValueTier: '대형주', changeRate: 0.3, currentPrice: 198000, snapshotTime: now() },
      { stockCode: '035720', stockName: '카카오', alias: null, lastPrice: 41500, totalMarketValue: 18_000_000_000_000, marketValueTier: '중형주', changeRate: 3.4, currentPrice: 41500, snapshotTime: now() },
    ],
    children: [],
  },
  // 섹터 페이지가 화면을 꽉 채운 모습을 확인하기 위한 추가 대분류 — 실제 WICS 대분류 개수(15개 안팎)에
  // 맞춰 늘렸다. 대표 종목 하나씩만 채운다 — computeSectorAverage(결정 1)가 items로 평균을
  // 계산하므로, items가 비면 평균이 null이 되어 섹터 그래프에서 사라진다.
  { sectorId: 7, sectorName: '자동차', totalMarketValue: 40_000_000_000_000, isExcluded: false, items: soloItem('900007', '자동차대표주', 40_000_000_000_000, '대형주', 0.85), children: [] },
  { sectorId: 8, sectorName: '철강', totalMarketValue: 18_000_000_000_000, isExcluded: false, items: soloItem('900008', '철강대표주', 18_000_000_000_000, '중형주', -0.65), children: [] },
  { sectorId: 9, sectorName: '제약', totalMarketValue: 22_000_000_000_000, isExcluded: false, items: soloItem('900009', '제약대표주', 22_000_000_000_000, '중형주', 2.1), children: [] },
  { sectorId: 10, sectorName: '금융', totalMarketValue: 60_000_000_000_000, isExcluded: false, items: soloItem('900010', '금융대표주', 60_000_000_000_000, '초대형주', 0.15), children: [] },
  { sectorId: 11, sectorName: '통신', totalMarketValue: 15_000_000_000_000, isExcluded: false, items: soloItem('900011', '통신대표주', 15_000_000_000_000, '대형주', -0.3), children: [] },
  { sectorId: 12, sectorName: '조선', totalMarketValue: 12_000_000_000_000, isExcluded: false, items: soloItem('900012', '조선대표주', 12_000_000_000_000, '중형주', 1.4), children: [] },
  { sectorId: 13, sectorName: '건설', totalMarketValue: 9_000_000_000_000, isExcluded: false, items: soloItem('900013', '건설대표주', 9_000_000_000_000, '중형주', -1.1), children: [] },
  { sectorId: 14, sectorName: '유통', totalMarketValue: 11_000_000_000_000, isExcluded: false, items: soloItem('900014', '유통대표주', 11_000_000_000_000, '중형주', 0.55), children: [] },
  { sectorId: 15, sectorName: '보험', totalMarketValue: 14_000_000_000_000, isExcluded: false, items: soloItem('900015', '보험대표주', 14_000_000_000_000, '중형주', 0.95), children: [] },
  { sectorId: 16, sectorName: '은행', totalMarketValue: 25_000_000_000_000, isExcluded: false, items: soloItem('900016', '은행대표주', 25_000_000_000_000, '대형주', -0.25), children: [] },
  { sectorId: 17, sectorName: '운송', totalMarketValue: 10_000_000_000_000, isExcluded: false, items: soloItem('900017', '운송대표주', 10_000_000_000_000, '중형주', 1.75), children: [] },
  { sectorId: 18, sectorName: '미디어/엔터', totalMarketValue: 7_000_000_000_000, isExcluded: false, items: soloItem('900018', '미디어대표주', 7_000_000_000_000, '중형주', -0.85), children: [] },
]

// /api/map 목업(isCustom=false) 전용 — 실제 기본 모드는 어드민이 구성한 섹터를 아예 안 쓰고
// stock_info 섹터 그대로 1뎁스로 묶어서, 노드 sectorId가 전부 0(NO_SECTOR_ID)으로 내려온다.
// marketMapTree를 그대로 쓰면 커스텀 트리와 구분이 안 돼서, 결정 5의 "now/before를 sectorName으로
// 짝짓는다" 로직이 기본 모드에서 sectorId로 잘못 짝지어도 목업에서는 안 드러난다.
function toDefaultModeNode(node: MarketMapSectorNode): MarketMapSectorNode {
  return { ...node, sectorId: 0, children: node.children.map(toDefaultModeNode) }
}

export function toDefaultModeTree(nodes: MarketMapSectorNode[]): MarketMapSectorNode[] {
  return nodes.map(toDefaultModeNode)
}

// /api/map?snapshotTime=... 목업(섹터 페이지의 before 쌍 쿼리) 전용 — 종목 changeRate를 일괄로
// 낮춰서 최신 트리와 값이 달라 보이게 한다. 실제 과거 값 재현이 목적이 아니라 변화율 막대가 0이 아닌
// 걸 dev:mock에서 눈으로 확인하는 게 목적이다(결정 7).
const MOCK_BEFORE_CHANGE_RATE_DELTA = 0.3

function shiftItemChangeRate(item: MarketMapItem): MarketMapItem {
  return { ...item, changeRate: item.changeRate - MOCK_BEFORE_CHANGE_RATE_DELTA }
}

function shiftNodeChangeRates(node: MarketMapSectorNode): MarketMapSectorNode {
  return {
    ...node,
    items: node.items.map(shiftItemChangeRate),
    children: node.children.map(shiftNodeChangeRates),
  }
}

export function shiftMarketMapTreeChangeRates(nodes: MarketMapSectorNode[]): MarketMapSectorNode[] {
  return nodes.map(shiftNodeChangeRates)
}

export const MOCK_BEFORE_INDEX_CHANGE_RATE_DELTA = 0.2


// ── 커스텀 섹터·종목 배정(가입/로그인 전환 이후 /api/custom/*) ───────────
export const customSectors = [
  { id: 1, name: '반도체', parentId: null, depth: 0 },
  { id: 2, name: '2차전지', parentId: null, depth: 0 },
  { id: 3, name: '인터넷/플랫폼', parentId: null, depth: 0 },
  { id: 4, name: '메모리', parentId: 1, depth: 1 },
  { id: 5, name: '파운드리', parentId: 1, depth: 1 },
  { id: 6, name: '양극재', parentId: 2, depth: 1 },
]

export const customStockSectors: {
  stockCode: string
  market: 'KOSPI' | 'KOSDAQ'
  stockName: string
  nxtEnabled: boolean
  alias: string | null
  totalMarketValue: number | null
  marketValueTier: string | null
  industryName: string | null
  parentSectorName: string | null
  sectorName: string
  sectorId: number
}[] = [
  {
    stockCode: '005930',
    market: 'KOSPI',
    stockName: '삼성전자',
    nxtEnabled: true,
    alias: null,
    totalMarketValue: 420_000_000_000_000,
    marketValueTier: 'Top 2',
    industryName: '반도체와반도체장비',
    parentSectorName: '반도체',
    sectorName: '메모리',
    sectorId: 4,
  },
  {
    stockCode: '000660',
    market: 'KOSPI',
    stockName: 'SK하이닉스',
    nxtEnabled: true,
    alias: null,
    totalMarketValue: 130_000_000_000_000,
    marketValueTier: 'Top 2',
    industryName: '반도체와반도체장비',
    parentSectorName: '반도체',
    sectorName: '파운드리',
    sectorId: 5,
  },
  {
    stockCode: '051910',
    market: 'KOSPI',
    stockName: 'LG화학',
    nxtEnabled: true,
    alias: null,
    totalMarketValue: 29_000_000_000_000,
    marketValueTier: '대형주',
    industryName: '화학',
    parentSectorName: '2차전지',
    sectorName: '양극재',
    sectorId: 6,
  },
  {
    stockCode: '373220',
    market: 'KOSPI',
    stockName: 'LG에너지솔루션',
    nxtEnabled: false,
    alias: 'LG엔솔',
    totalMarketValue: 93_000_000_000_000,
    marketValueTier: '대형주',
    industryName: '전기장비',
    parentSectorName: null,
    sectorName: '2차전지',
    sectorId: 2,
  },
  {
    stockCode: '035420',
    market: 'KOSPI',
    stockName: 'NAVER',
    nxtEnabled: false,
    alias: null,
    totalMarketValue: 32_000_000_000_000,
    marketValueTier: '대형주',
    industryName: '소프트웨어',
    parentSectorName: null,
    sectorName: '인터넷/플랫폼',
    sectorId: 3,
  },
  {
    stockCode: '035720',
    market: 'KOSDAQ',
    stockName: '카카오',
    nxtEnabled: false,
    alias: null,
    totalMarketValue: 18_000_000_000_000,
    marketValueTier: '중형주',
    industryName: '소프트웨어',
    parentSectorName: null,
    sectorName: '인터넷/플랫폼',
    sectorId: 3,
  },
]

export const customSnapshots = [
  { id: 1, label: '2026-07-초안', createdAt: '2026-07-01T09:00:00', updatedAt: '2026-07-01T09:00:00' },
  { id: 2, label: '분기 정기 저장', createdAt: '2026-08-01T09:00:00', updatedAt: '2026-08-01T09:00:00' },
]

// 로그인 여부/로그인 사용자 정보를 흉내 내는 목업 전역 상태 — dev:mock에서 새로고침해도 유지되도록
// 모듈 스코프에 둔다(탭을 닫으면 사라짐, 실제 백엔드 쿠키와 달리 서버 재시작 개념이 없음).
export const mockAuth: { authenticated: boolean; userId: number; email: string; role: 'USER' | 'ADMIN' } = {
  authenticated: false,
  userId: 1,
  email: 'dev@example.com',
  role: 'USER',
}

// GET/PUT /profile/** 목업 — 사진은 올린 바이트를 그대로 들고 있다가 GET /profile/image로 돌려준다.
export const mockProfile: { nickname: string | null; image: ArrayBuffer | null; imageVersion: number | null } = {
  nickname: null,
  image: null,
  imageVersion: null,
}

// GET/PUT /custom/preferences 목업 — 사용자가 바꾼 값만 담기는 sparse JSON.
export const mockCustomPreferences: Record<string, unknown> = {}

// GET /custom/scale, /map/scale 공통 응답 모양 — thresholds를 비워둬서 커스텀 저장 전에는 오늘(기본
// 프리셋) 화면과 동일하게 보이도록 한다. 개별 create/update/delete는 이 목업 자체를 실제로 mutate하지
// 않는다(다른 custom 핸들러들과 동일 — 페이지가 응답을 받아 로컬 colorScaleDraft를 직접 갱신하는
// 구조라 필요 없음).
export const marketMapColorScale: {
  thresholds: { id: number; thresholdPercent: number; color: string; colorLabel: string | null }[]
} = {
  thresholds: [],
}
