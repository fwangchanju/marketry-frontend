import type { ReactNode } from 'react'
import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'

// 설정창과 같은 폭·헤더·탭 구조를 쓰는 읽기 전용 패널. 약관·개인정보·프로필처럼
// 별도 설정값이 없는 화면도 서비스 전체의 좌측 본문/우측 패널 양식을 유지한다.
export default function PageInfoPanel({ title, tabLabel, icon = 'document', children }: { title: string; tabLabel: string; icon?: SettingsSectionIconName; children?: ReactNode }) {
  return (
    <aside className="mb-[4px] flex w-[300px] shrink-0 flex-col overflow-hidden rounded-md border border-ui-border bg-ui-panel text-ui-white">
      <div className="flex shrink-0 items-center border-b border-ui-border px-4 py-[11.75px]">
        <p className="font-roboto-latin flex h-7 items-center text-lg font-bold leading-none">
          <span aria-hidden="true" className="mr-[6px] inline-block h-5 w-1 shrink-0 rounded-sm bg-brand" />
          {title}
        </p>
      </div>
      <div role="tablist" aria-label={`${title} 분류`} className="flex h-[68px] shrink-0 items-stretch border-b border-ui-border bg-ui-panel px-1">
        <span
          id="page-info-tab"
          role="tab"
          aria-selected="true"
          aria-controls="page-info-panel"
          className="group relative box-border flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-0 bg-transparent px-1 pt-2 pb-3 text-[12px] leading-tight text-brand"
        >
          <SettingsSectionIcon icon={icon} className="h-[30px] w-[30px]" />
          <span className="max-w-full truncate font-bold">{tabLabel}</span>
          <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 bg-brand" />
        </span>
      </div>
      <div id="page-info-panel" role="tabpanel" aria-labelledby="page-info-tab" className="min-h-0 flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-ui-text">
        {children}
      </div>
    </aside>
  )
}
