import { useMemo, type CSSProperties } from 'react'
import type { PopupContent } from './Popup'
import type { TreemapItem } from '@/types/api'
import { toJoEok, toPctSigned, toVolume } from '@/utils/format'
import { isLightColor, resolveTreemapColor, type ColorScaleConfig } from '@/utils/treemapColorScale'
import type { StockLabelMode } from '@/hooks/useGlobalSettings'
import { LABEL_LINE_HEIGHT, fitStockLabel, useFontsVersion } from '@/utils/stockLabelFit'

interface Props {
  item: TreemapItem
  x: number
  y: number
  width: number
  height: number
  // 이 박스가 전체 트리맵 컨테이너 넓이에서 차지하는 비중(%) — useTreemapLayout에서 계산.
  areaPercent: number
  // 이 비중 미만이면 종목명/등락률을 아예 표시하지 않는다(설정 사이드바의 슬라이더로 조절).
  labelMinAreaPercent: number
  // 박스에 종목명만/등락률만/둘 다 보여줄지(설정 사이드바의 "종목 박스 표시 내용" 슬라이더) — 위 넓이
  // 기준을 넘어 실제로 보여줄 때(showLabel=true)만 적용된다. 툴팁 내용에는 영향 없음.
  stockLabelMode: StockLabelMode
  // 등락률(%) 표시 소수점 자릿수(설정 사이드바의 "소수점 아래 표시" 슬라이더).
  decimalPlaces: number
  // 박스 색칠은 이 설정 하나로만 결정된다(resolveTreemapColor) — 범례 바(MapPage)도
  // 같은 설정 + 같은 함수를 거치므로 두 화면이 항상 수학적으로 일치한다.
  colorScale: ColorScaleConfig
  onOpenPopup: (content: PopupContent, target: HTMLElement) => void
  // 커서 이동 방식일 때 박스를 벗어나면 그 박스의 팝업을 닫는다(targetKey가 같은 팝업만).
  onClosePopup: (targetKey: string) => void
  // true면 우클릭 대신 커서를 박스 위로 옮길 때 팝업을 띄운다(설정 사이드바의 "종목 정보 팝업").
  stockPopupOnHover: boolean
  // 지금 팝업이 떠 있는 섹터/종목의 식별 키(sectorPath/stockPath 기반) — 이 종목의 키와 일치하면
  // 이 박스의 hover 모양(2px 테두리 + 흰 오버레이, index.css)을 "고정(pinned)"으로 계속 보여준다.
  highlightedKey: string | null
  // 이 박스를 담고 있는 섹터의 전체 경로(SectorBox.sectorPath) — stockCode만으로는
  // 같은 종목이 트리 여러 자리에 나타날 가능성을 배제할 수 없어, 종목 키도 경로로 유일하게 만든다.
  ancestorPath: string
}

function fontSizePx(width: number, height: number): number {
  return Math.max(12, Math.min(30, Math.min(width, height) / 5))
}

export default function StockBox({
  item,
  x,
  y,
  width,
  height,
  areaPercent,
  labelMinAreaPercent,
  stockLabelMode,
  decimalPlaces,
  colorScale,
  onOpenPopup,
  onClosePopup,
  stockPopupOnHover,
  highlightedKey,
  ancestorPath,
}: Props) {
  const fontSize = fontSizePx(width, height)
  // 글자는 박스 크기에 맞춘다(utils/stockLabelFit.ts) — 종목명은 한 줄에 들어가면 그대로, 안 들어가면 두 줄로 나누고, 그래도 안 되면 글자를 9px까지 줄이고,
  // 그래도 안 되면 종목명을 감추고 등락률만 보여 준다. 말줄임표나 잘린 글자는 만들지 않는다. 종목명만 고른 경우에 이름이 안 들어가면 아무것도 그리지 않는다.
  const wantName = stockLabelMode !== 'rateOnly'
  const wantRate = stockLabelMode !== 'nameOnly'
  const fontsVersion = useFontsVersion()
  const name = item.alias ?? item.stockName
  const rateText = toPctSigned(item.changeRate, decimalPlaces)
  const fit = useMemo(
    () => fitStockLabel({ name, rateText, width, height, baseFont: fontSize, wantName, wantRate }),
    // fontsVersion은 글꼴이 늦게 로드돼 글자 폭이 달라졌을 때 다시 계산하려는 값이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, rateText, width, height, fontSize, wantName, wantRate, fontsVersion],
  )
  const showLabel = stockLabelMode !== 'off' && areaPercent >= labelMinAreaPercent && (fit.nameLines !== null || fit.rateSize !== null)
  const backgroundColor = resolveTreemapColor(item.changeRate, colorScale)
  const stockKey = `stock:${ancestorPath}\u0000${item.stockCode}`
  // 팝업이 이 종목을 대상으로 떠 있는 동안 hover 모양을 고정해서 보여준다(index.css의 .is-pinned).
  const isPinned = highlightedKey === stockKey
  const openStockPopup = (target: HTMLElement, tooltip = false, pointer?: { x: number; y: number }) => {
    onOpenPopup({
      title: item.stockName,
      rows: [
        `등락률: ${toPctSigned(item.changeRate, decimalPlaces)}`,
        // 기간 등락률에서는 시작일의 기준가와 종료일의 종가(장중이면 현재가)를 보여 준다.
        `${item.rangeLabels?.end ?? '현재가'}: ${toVolume(item.currentPrice)}원`,
        `${item.rangeLabels?.base ?? '전일종가'}: ${toVolume(item.lastPrice)}원`,
        `시가총액: ${toJoEok(item.totalMarketValue / 100_000_000)}`,
      ],
      targetKey: stockKey,
      tooltip,
      pointer,
    }, target)
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        backgroundColor,
        // 상한가·하한가 부근의 포인트 색(분홍/하늘)처럼 밝은 배경에서는 흰 글자가 안 읽혀 어두운 글자를 쓴다.
        color: isLightColor(backgroundColor) ? '#18181b' : undefined,
        '--treemap-base-color': backgroundColor,
      } as CSSProperties}
      onContextMenu={e => {
        e.preventDefault()
        e.stopPropagation()
        if (stockPopupOnHover) return
        openStockPopup(e.currentTarget)
      }}
      onPointerEnter={stockPopupOnHover ? e => openStockPopup(e.currentTarget, true, { x: e.clientX, y: e.clientY }) : undefined}
      onPointerLeave={stockPopupOnHover ? () => onClosePopup(stockKey) : undefined}
      className={`treemap-stock flex flex-col items-center justify-center overflow-hidden border border-black/40 text-white ${isPinned ? 'is-pinned' : ''}`}
    >
      {showLabel && (
        <>
          {fit.nameLines && (
            <span className="w-full px-1 text-center" style={{ fontSize: fit.nameSize, lineHeight: LABEL_LINE_HEIGHT }}>
              {fit.nameLines.map(line => (
                <span key={line} className="block whitespace-nowrap">{line}</span>
              ))}
            </span>
          )}
          {fit.rateSize !== null && (
            <span className="tabular-nums text-center" style={{ fontSize: fit.rateSize, lineHeight: LABEL_LINE_HEIGHT }}>
              {rateText}
            </span>
          )}
        </>
      )}

    </div>
  )
}
