import type { ComponentProps } from 'react'
import Heatmap from '@/components/Heatmap'
import PathBar, { type PathCrumb } from '@/components/PathBar'

// 모바일 지도 캡처 프레임의 히트맵 영역. 실제 지도 화면과 스와이프 미리보기가 같은 렌더을 공유한다.
export default function MobileMapHeatmapFrame({ path, marketLabel, strongIndustryColor, heatmapProps }: {
  path: string[]
  marketLabel: string
  strongIndustryColor: string
  heatmapProps: ComponentProps<typeof Heatmap>
}) {
  const crumbs: PathCrumb[] = [
    { key: 'market', label: marketLabel },
    ...path.map((name, index) => ({ key: `${name}-${index}`, label: name, current: index === path.length - 1 })),
  ]
  return (
    <>
      <div aria-hidden="true" className="h-2 shrink-0" />
      {path.length > 0 && <PathBar crumbs={crumbs} accentColor={strongIndustryColor} />}
      {/* 미리보기 레이어는 block이라 flex-1만으로 높이가 0이 된다. 실제 지도 프레임(flex 부모)에서는 flex-basis가 우선해 h-full이 레이아웃을 밀지 않는다. */}
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <Heatmap {...heatmapProps} />
      </div>
    </>
  )
}
