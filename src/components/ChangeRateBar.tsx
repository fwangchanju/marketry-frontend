import type { LegendSwatch } from '@/utils/heatmapColorScale'

// 지도 페이지 우하단에 놓는 등락률 색상 범례 — 설정 패널 색상 탭의 4-1) 등락률 색상의 바와 같은 값·모양이다(기본은 하락 4칸 + 0% + 상승 4칸의 9칸).
// 하단 줄(DisclaimerFooter, @container)이 920px보다 좁으면 통째로 숨긴다. 줄이 좁아지면 범례가 같이 줄어드는데, 하단 줄이 약 910px부터 칸 안의 글자가 칸을 벗어나 겹치기 시작한다(범례 약 300px, 2026-11-14 측정).
// 면책조항은 숨기지 않는다. 범례가 없어지면 그 자리까지 면책조항이 쓴다.
// 너비는 칸마다 36px(간격 2px)로 잡아 한 칸에 두 자리 수(예: +10%)가 들어간다. 오른쪽 끝에 붙어 있어 넓어지면 왼쪽으로만 늘어난다(9칸이면 340px, 글자는 11px·굵기 700). 보기만 하는 표시라서 눌러도 아무 일도 없다(색 편집은 설정 패널에서 한다).
export default function ChangeRateBar({ swatches }: { swatches: LegendSwatch[] }) {
  return (
    <div role="img" aria-label="등락률 색상 범례" className="hidden gap-0.5 pb-[4px] @[920px]:grid" style={{ width: swatches.length * 36 + (swatches.length - 1) * 2, gridTemplateColumns: `repeat(${swatches.length}, minmax(0, 1fr))` }}>
      {swatches.map(({ label, color }) => (
        <span
          key={label}
          style={{ backgroundColor: color }}
          className="flex h-[20px] w-full min-w-0 items-center justify-center text-[11px] font-bold leading-none tabular-nums whitespace-nowrap text-ui-white"
        >
          {label}
        </span>
      ))}
    </div>
  )
}
