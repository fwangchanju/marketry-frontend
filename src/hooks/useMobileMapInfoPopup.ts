import { useCallback, useState, type RefObject } from 'react'
import { type PopupContent, type PopupState } from '@/components/Popup'
import { currencySuffix, type CurrencyUnit } from '@/utils/currencyUnit'
import { toJoEok, toPctSigned, toVolume } from '@/utils/format'

// 업종 지도·종목 지도 MOBILE 팝업의 공통 상태. 한국과 일본·미국가 같은 PC용 Popup을 같은 규칙으로 띄운다.
// 칸 데이터가 조금 달라도 이 훅이 받는 값만 맞추면 행·토글·위치 계산은 한 곳에서 관리된다.
export interface MobileMapPopupStock {
  key: string
  name: string
  changeRate: number
  currentPrice: number
  marketValue: number
}

export interface MobileMapPopupSector {
  key: string
  name: string
  changeRate: number
  marketValue: number
  simpleAvg?: number | null
  advancers?: number
  decliners?: number
  unchanged?: number
}

export function useMobileMapInfoPopup({ currencyUnit, mapBoundsRef }: {
  // 기본값을 두지 않는다. 일본·미국 화면이 빠뜨리면 금액에 원이 붙는다.
  currencyUnit: CurrencyUnit
  mapBoundsRef?: RefObject<HTMLElement | null>
}) {
  const [popup, setPopup] = useState<PopupState | null>(null)
  // 화면 이동으로 닫기는 공통 셸(MobileMapShell)이 스와이프 시작과 navigationKey로 처리한다.
  const close = useCallback(() => setPopup(null), [])
  const open = useCallback((content: PopupContent, target: HTMLElement) => {
    const rect = target.getBoundingClientRect()
    const bounds = (target.closest('[data-mobile-map-scale]') ?? mapBoundsRef?.current)?.getBoundingClientRect()
    setPopup(current => current?.targetKey === content.targetKey ? null : {
      ...content,
      anchorRect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      mapBounds: {
        left: bounds?.left ?? 0,
        right: bounds?.right ?? window.innerWidth,
        top: bounds?.top ?? 0,
        bottom: bounds?.bottom ?? window.innerHeight,
      },
    })
  }, [mapBoundsRef])

  // 일본·미국 금액은 종목 지도 팝업과 같은 표기(예: 153조 엔)를 쓰고, 한국 MOBILE 팝업은 기존대로 원을 붙인다.
  const marketValueText = (value: number) => `${toJoEok(value / 100_000_000)}${currencySuffix(currencyUnit) || '원'}`

  const openStockPopup = (stock: MobileMapPopupStock, target: HTMLElement, decimalPlaces = 1) => open({
    title: stock.name,
    rows: [
      `등락률: ${toPctSigned(stock.changeRate, decimalPlaces)}`,
      `현재가: ${toVolume(stock.currentPrice)}${currencyUnit}`,
      `시가총액: ${marketValueText(stock.marketValue)}`,
    ],
    targetKey: `stock:${stock.key}`,
  }, target)

  const openSectorPopup = (sector: MobileMapPopupSector, target: HTMLElement, decimalPlaces = 1) => open({
    title: sector.name,
    rows: [
      `시총 가중: ${toPctSigned(sector.changeRate, decimalPlaces)}`,
      ...(sector.simpleAvg === undefined ? [] : [`동일 가중: ${sector.simpleAvg === null ? '-' : toPctSigned(sector.simpleAvg, decimalPlaces)}`]),
      `등락 종목: ▲${sector.advancers ?? 0} ▼${sector.decliners ?? 0} ■${sector.unchanged ?? 0}`,
      `그룹 시총: ${marketValueText(sector.marketValue)}`,
    ],
    targetKey: `sector:${sector.key}`,
  }, target)

  return { popup, close, open, openStockPopup, openSectorPopup }
}
