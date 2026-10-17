import type { LegendSwatch } from '@/utils/treemapColorScale'

// 지도 페이지 우하단에 놓는 등락률 색상 범례 — 설정 패널 색상 탭의 4-3) 등락률 색상의 바와 같은 값·모양이다(기본은 하락 4칸 + 0% + 상승 4칸의 9칸).
// 너비는 칸마다 34px(간격 2px)로 잡아 한 칸에 두 자리 수(예: +10%)가 들어간다. 오른쪽 끝에 붙어 있어 넓어지면 왼쪽으로만 늘어난다(9칸이면 322px, 글자는 11px). 보기만 하는 표시라서 눌러도 아무 일도 없다(색 편집은 설정 패널에서 한다).
export default function ChangeRateBar({ swatches }: { swatches: LegendSwatch[] }) {
  return (
    <div role="img" aria-label="등락률 색상 범례" className="grid gap-0.5" style={{ width: swatches.length * 34 + (swatches.length - 1) * 2, gridTemplateColumns: `repeat(${swatches.length}, minmax(0, 1fr))` }}>
      {swatches.map(({ label, color }) => (
        <span
          key={label}
          style={{ backgroundColor: color }}
          className={`flex h-6 w-full min-w-0 items-center justify-center font-bold leading-none tabular-nums whitespace-nowrap text-white ${swatches.length > 7 ? 'text-[11px]' : 'text-xs'}`}
        >
          {label}
        </span>
      ))}
    </div>
  )
}
