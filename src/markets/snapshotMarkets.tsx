import type { ReactNode } from 'react'
import MarketSessionChip from '@/components/MarketSessionChip'
import japanStocks from '@/data/japanStocks.json'
import { japanSessionAt } from '@/utils/japanMarketSession'
import { JAPAN_MAP_FIXED, JAPAN_MAP_SETTING_PREFIX, JAPAN_REFRESH_HELP } from '@/utils/japanMapSettings'
import { USA_MAP_FIXED, USA_MAP_SETTING_PREFIX } from '@/utils/usaMapSettings'
import { USA_SESSION, usaRefreshHelp } from '@/utils/usaMarketSession'
import type { CurrencyUnit } from '@/utils/currencyUnit'
import { overseasMarketInfo, type OverseasMarket } from '@/utils/markets'

type SnapshotMarketDefinition = {
  currencyUnit: CurrencyUnit
  // 저장된 설정의 이름 앞부분. 바꾸면 저장값이 사라진다.
  settingPrefix: string
  fixed: { colorScale: (typeof JAPAN_MAP_FIXED)['colorScale']; strongIndustryColor: string }
  // 번들에 든 종목 목록. 서버에서 받는 시장은 null이다.
  bundledStocks: readonly { code: string; name: string }[] | null
  intradayDelta: boolean
  // 지수 막대. hasIntraday면 하루 보기에서 장중 값을 쓰고, 아니면 최근 날도 종가로 만든다.
  index: { key: string; name: string; hasIntraday: boolean }
  session: (snapshotTime: string) => ReactNode
  refreshHelp: (snapshotTime: string | null) => string
}

// 스냅샷 목록으로 시세를 주는 시장마다 다른 값. 시장이 빠지면 빌드가 실패한다.
export const SNAPSHOT_MARKETS: Readonly<Record<OverseasMarket, SnapshotMarketDefinition>> = {
  JAPAN: { currencyUnit: '엔', settingPrefix: JAPAN_MAP_SETTING_PREFIX, fixed: JAPAN_MAP_FIXED, bundledStocks: japanStocks, intradayDelta: true, index: { key: 'market-index:NIKKEI225', name: '닛케이', hasIntraday: true }, session: time => <MarketSessionChip market="JAPAN" session={japanSessionAt(time)} />, refreshHelp: () => JAPAN_REFRESH_HELP },
  USA: { currencyUnit: '달러', settingPrefix: USA_MAP_SETTING_PREFIX, fixed: USA_MAP_FIXED, bundledStocks: null, intradayDelta: false, index: { key: 'market-index:SP500', name: overseasMarketInfo('USA').badgeLabel, hasIntraday: false }, session: () => <MarketSessionChip market="USA" session={USA_SESSION} />, refreshHelp: usaRefreshHelp },
}
