import type { LegendSwatch } from '@/utils/treemapColorScale'

// 지도 페이지 우하단에 놓는 등락률 색상 범례 — 설정 패널 색상 탭(2) 등락률 색상)의 7칸 바와 같은 값·모양이다.
// 너비는 설정 패널 안 바와 같은 254px(칸 약 34.6px, 간격 2px)이다. 보기만 하는 표시라서 눌러도 아무 일도 없다(색 편집은 설정 패널에서 한다).
export default function ChangeRateBar({ swatches }: { swatches: LegendSwatch[] }) {
  return (
    <div role="img" aria-label="등락률 색상 범례" className="grid w-[254px] grid-cols-7 gap-0.5">
      {swatches.map(({ label, color }) => (
        <span
          key={label}
          style={{ backgroundColor: color }}
          className="flex h-6 w-full min-w-0 items-center justify-center text-xs leading-none font-bold tabular-nums whitespace-nowrap text-white"
        >
          {label}
        </span>
      ))}
    </div>
  )
}
