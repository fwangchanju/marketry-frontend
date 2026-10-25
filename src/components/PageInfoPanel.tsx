import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import SettingsPanelSideToggle from '@/components/SettingsPanelSideToggle'
import { SETTINGS_PANEL_TAB_ICON_CLASS, SettingsPanelHeader, SettingsPanelTabList } from '@/components/SettingsPanelChrome'

function PageInfoPanelTextGroup({ lines }: { lines: string[] }) {
  return (
    <div className="flex h-[180px] shrink-0 items-center justify-center">
      <div className="flex min-w-0 max-w-full flex-col items-center gap-2">
        {lines.map(text => <p key={text} title={text} className="m-0 w-full truncate whitespace-nowrap text-center text-sm font-normal leading-relaxed text-ui-text">{text}</p>)}
      </div>
    </div>
  )
}

// 설정창과 같은 폭·헤더·탭 구조를 쓰는 읽기 전용 패널. 약관·개인정보·프로필처럼
// 별도 설정값이 없는 화면도 서비스 전체의 좌측 본문/우측 패널 양식을 유지한다.
export default function PageInfoPanel({ title, tabLabel, description, note, icon = 'document', isOnLeft = false, onToggleSide }: { title: string; tabLabel: string; description: string; note?: string; icon?: SettingsSectionIconName; isOnLeft?: boolean; onToggleSide?: () => void }) {
  return (
    <div data-settings-panel-shell className="relative z-20 mb-[4px] flex shrink-0">
      {onToggleSide && <SettingsPanelSideToggle isOnLeft={isOnLeft} onToggleSide={onToggleSide} panelName="정보 패널" />}
      <aside className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-md border border-ui-border bg-ui-panel text-ui-white">
        <SettingsPanelHeader>
          <p title={title} className="font-roboto-latin flex h-7 w-full min-w-0 items-center overflow-hidden whitespace-nowrap text-lg font-bold leading-none">
            <span aria-hidden="true" className="mr-[6px] inline-block h-5 w-1 shrink-0 rounded-sm bg-brand" />
            <span className="truncate">{title}</span>
          </p>
        </SettingsPanelHeader>
        <SettingsPanelTabList ariaLabel={`${title} 분류`}>
          <span
            id="page-info-tab"
            role="tab"
            aria-selected="true"
            aria-controls="page-info-panel"
            className="group relative box-border flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-0 bg-transparent px-1 py-[5px] text-[12px] leading-tight text-brand"
          >
            <SettingsSectionIcon icon={icon} className={SETTINGS_PANEL_TAB_ICON_CLASS} />
            <span className="max-w-full truncate font-bold">{tabLabel}</span>
            <span aria-hidden="true" className="absolute bottom-0 left-1/2 h-0.5 w-10 -translate-x-1/2 bg-brand" />
          </span>
        </SettingsPanelTabList>
        <div id="page-info-panel" role="tabpanel" aria-labelledby="page-info-tab" className="min-h-0 flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-ui-text">
          <PageInfoPanelTextGroup lines={[description, ...(note ? [note] : [])]} />
        </div>
      </aside>
    </div>
  )
}
