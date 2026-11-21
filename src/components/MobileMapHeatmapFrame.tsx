import type { ComponentProps } from 'react'
import Heatmap from '@/components/Heatmap'
import { ReturnArrowIcon } from '@/components/icons/AppIcons'
import { BREADCRUMB_LINK_CLASS } from '@/utils/mobileMapHeatmap'

// 이름 오른쪽의 되돌아가기 표시 — 이름과 한 버튼이라서 올리면 함께 하이라이트된다.
export function BreadcrumbBackIcon() {
  return <ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
}

// 모바일 지도 캡처 프레임의 히트맵 영역. 실제 지도 화면과 스와이프 미리보기가 같은 렌더을 공유한다.
export default function MobileMapHeatmapFrame({ path, marketLabel, strongIndustryColor, heatmapProps }: {
  path: string[]
  marketLabel: string
  strongIndustryColor: string
  heatmapProps: ComponentProps<typeof Heatmap>
}) {
  return (
    <>
      <div aria-hidden="true" className="h-2 shrink-0" />
      {path.length > 0 && (
        <nav aria-label="업종 이동 경로" className="flex h-7 w-full shrink-0 items-center truncate bg-ui-background/70 text-lg leading-none font-bold">
          <span aria-hidden="true" className="h-4 w-[4px] shrink-0 bg-ui-white" />
          <span className={BREADCRUMB_LINK_CLASS}>{marketLabel}<BreadcrumbBackIcon /></span>
          {path.map((name, index) => (
            <span
              key={`${name}-${index}`}
              className={index === path.length - 1 ? 'px-2 text-[var(--accent)]' : BREADCRUMB_LINK_CLASS}
              style={index === path.length - 1 && strongIndustryColor ? { color: strongIndustryColor } : undefined}
            >{name}{index < path.length - 1 && <BreadcrumbBackIcon />}</span>
          ))}
        </nav>
      )}
      {/* 미리보기 레이어는 block이라 flex-1만으로 높이가 0이 된다. 실제 지도 프레임(flex 부모)에서는 flex-basis가 우선해 h-full이 레이아웃을 밀지 않는다. */}
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <Heatmap {...heatmapProps} />
      </div>
    </>
  )
}
