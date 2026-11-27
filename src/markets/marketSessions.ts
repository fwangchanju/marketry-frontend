import { accentColor } from '@/utils/accentPalette'
import { JAPAN_SESSION_GUIDE } from '@/utils/japanMarketSession'
import { USA_SESSION_GUIDE } from '@/utils/usaMarketSession'
import type { SnapshotMarket } from '@/utils/markets'

type SessionDefinition = {
  label: string
  guide: readonly { session: string; term?: string; range: string }[]
  // 가운데 설명이 "한자 한글읽기"처럼 두 칸으로 나뉘는지(일본). 아니면 한국 세션 팝업처럼 한 줄 글자로, 이름 칸 바로 뒤에서 시작한다.
  termHasReading: boolean
  dotColors: Readonly<Record<string, string>>
}

// 시장마다 다른 세션 이름·시간표·색. 시장이 빠지면 빌드가 실패한다.
export const MARKET_SESSIONS: Readonly<Record<SnapshotMarket, SessionDefinition>> = {
  JAPAN: {
    label: '일본 증시 세션 안내',
    guide: JAPAN_SESSION_GUIDE,
    termHasReading: true,
    dotColors: { '오전 장': 'var(--brand)', '점심 휴장': accentColor('선명한 주황'), '오후 장': 'var(--brand)', '장 마감': accentColor('연회색') },
  },
  USA: {
    label: '미국 증시 세션 안내',
    guide: USA_SESSION_GUIDE,
    termHasReading: false,
    dotColors: { '프리 마켓': 'var(--sub-yellow)', '메인 마켓': 'var(--brand)', '애프터 마켓': 'var(--sub-purple)', '마켓 종료': accentColor('연회색') },
  },
}
