import type { ReactNode } from 'react'
import MarketSessionChip from '@/components/MarketSessionChip'
import japanStocks from '@/data/japanStocks.json'
import { japanSessionAt } from '@/utils/japanMarketSession'
import { isJapanMapCapture, japanMapManagedDefaults, JAPAN_MAP_DRAFT_KEY_MAP, JAPAN_MAP_FIXED, JAPAN_MAP_SETTING_PREFIX, JAPAN_REFRESH_HELP, JAPAN_SETTINGS_TAB_STORAGE, type SnapshotMapPreferences } from '@/utils/japanMapSettings'
import { isUsaMapCapture, usaMapManagedDefaults, USA_MAP_DRAFT_KEY_MAP, USA_MAP_FIXED, USA_MAP_SETTING_PREFIX, USA_SETTINGS_TAB_STORAGE } from '@/utils/usaMapSettings'
import { usaRefreshHelp, usaSessionAt } from '@/utils/usaMarketSession'
import type { CurrencyUnit } from '@/utils/currencyUnit'
import { snapshotMarketInfo, type SnapshotMarket } from '@/utils/markets'
import { SNAPSHOT_CLOSE_CLOCK } from '@/utils/snapshotCloseClock'

type SnapshotMarketDefinition = {
  currencyUnit: CurrencyUnit
  // MOBILE 하단 설정 줄과 차트가 쓰는 시장 이름.
  sheetMarket: 'japan' | 'usa'
  // 저장된 설정의 이름 앞부분. 바꾸면 저장값이 사라진다.
  settingPrefix: string
  fixed: Pick<typeof JAPAN_MAP_FIXED, 'colorScale' | 'strongIndustryColor' | 'boxLabelMinAreaPercent' | 'stockPopupOnHover'>
  // 번들에 든 종목 목록. 서버에서 받는 시장은 null이다.
  bundledStocks: readonly { code: string; name: string }[] | null
  intradayDelta: boolean
  // 그래프에서 고를 수 있는 업종 단계 수와 설정 저장 이름의 앞부분.
  graphDepth: number
  graphSettingPrefix: string
  tabStorage: { graph: string; map: string }
  // 지도 설정의 기본 업종 단계 수, 관리자 기본값, 저장 이름 바꿈표, 텔레그램 캡처 주소인지.
  mapDepth: number
  mapDefaults: (profiles: Record<string, unknown> | undefined) => SnapshotMapPreferences
  mapDraftKeyMap: Readonly<Record<string, string>>
  isMapCapture: () => boolean
  // 하루에 시세가 여러 개일 때 종가 줄의 시각(뉴욕·도쿄 현지 시각 HH:mm). 없으면 null이다. 날짜를 고르거나 텔레그램 종가 지도를 그릴 때 이 줄을 쓴다.
  closeClock: string | null
  // 애프터마켓 등락률 기준(종가·합산·별도)을 고를 수 있는지(미국). 종가 줄이 있는 시장만 켠다.
  hasAfterHoursBasis: boolean
  // 장 중에 전일 종가 그대로인 시세를 지도에서 빼는지.
  hidesStaleQuotes: boolean
  // 지수 막대. hasIntraday면 하루 보기에서 장중 값을 쓰고, 아니면 최근 날도 종가로 만든다.
  index: { key: string; name: string; hasIntraday: boolean }
  session: (snapshotTime: string) => ReactNode
  refreshHelp: (snapshotTime: string | null) => string
}

// 스냅샷 목록으로 시세를 주는 시장마다 다른 값. 시장이 빠지면 빌드가 실패한다.
export const SNAPSHOT_MARKETS: Readonly<Record<SnapshotMarket, SnapshotMarketDefinition>> = {
  JAPAN: { currencyUnit: '엔', closeClock: SNAPSHOT_CLOSE_CLOCK.JAPAN, hasAfterHoursBasis: false, sheetMarket: 'japan', settingPrefix: JAPAN_MAP_SETTING_PREFIX, fixed: JAPAN_MAP_FIXED, bundledStocks: japanStocks, intradayDelta: true, graphDepth: 3, graphSettingPrefix: 'japan.graph.', tabStorage: JAPAN_SETTINGS_TAB_STORAGE, mapDepth: 3, mapDefaults: japanMapManagedDefaults, mapDraftKeyMap: JAPAN_MAP_DRAFT_KEY_MAP, isMapCapture: isJapanMapCapture, hidesStaleQuotes: true, index: { key: 'market-index:NIKKEI225', name: '닛케이', hasIntraday: true }, session: time => <MarketSessionChip market="JAPAN" session={japanSessionAt(time)} />, refreshHelp: () => JAPAN_REFRESH_HELP },
  USA: { currencyUnit: '달러', closeClock: SNAPSHOT_CLOSE_CLOCK.USA, hasAfterHoursBasis: true, sheetMarket: 'usa', settingPrefix: USA_MAP_SETTING_PREFIX, fixed: USA_MAP_FIXED, bundledStocks: null, intradayDelta: false, graphDepth: 2, graphSettingPrefix: 'usa.graph.', tabStorage: USA_SETTINGS_TAB_STORAGE, mapDepth: 2, mapDefaults: usaMapManagedDefaults, mapDraftKeyMap: USA_MAP_DRAFT_KEY_MAP, isMapCapture: isUsaMapCapture, hidesStaleQuotes: false, index: { key: 'market-index:SP500', name: snapshotMarketInfo('USA').badgeLabel, hasIntraday: false }, session: time => <MarketSessionChip market="USA" session={usaSessionAt(time)} />, refreshHelp: usaRefreshHelp },
}
