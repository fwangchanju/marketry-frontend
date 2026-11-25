import { accentColor } from '@/utils/accentPalette'
import { JAPAN_SESSION_GUIDE } from '@/utils/japanMarketSession'
import { USA_SESSION_GUIDE } from '@/utils/usaMarketSession'
import type { OverseasMarket } from '@/utils/markets'

type SessionDefinition = {
  label: string
  guide: readonly { session: string; term?: string; range: string }[]
  dotColors: Readonly<Record<string, string>>
}

// 시장마다 다른 세션 이름·시간표·색. 시장이 빠지면 빌드가 실패한다.
export const MARKET_SESSIONS: Readonly<Record<OverseasMarket, SessionDefinition>> = {
  JAPAN: {
    label: '일본 증시 세션 안내',
    guide: JAPAN_SESSION_GUIDE,
    dotColors: { '오전 장': 'var(--brand)', '점심 휴장': accentColor('연회색'), '오후 장': 'var(--brand)', '장 마감': accentColor('연회색') },
  },
  USA: {
    label: '미국 증시 세션 안내',
    guide: USA_SESSION_GUIDE,
    dotColors: { '프리 마켓': 'var(--sub-yellow)', '메인 마켓': 'var(--brand)', '애프터 마켓': 'var(--sub-purple)', '마켓 종료': accentColor('연회색') },
  },
}
