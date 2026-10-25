import type { ReactNode } from 'react'

// 설정창과 정보 패널이 같은 기준을 쓰도록 헤더·탭 줄의 크기와 공통 틀을 한곳에서 관리한다.
export const SETTINGS_PANEL_TAB_ICON_CLASS = 'h-6 w-6'

export function SettingsPanelHeader({ children }: { children: ReactNode }) {
  return <div className="flex h-[39px] shrink-0 items-center border-b border-ui-border px-4">{children}</div>
}

export function SettingsPanelTabList({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return (
    <nav role="tablist" aria-label={ariaLabel} className="flex h-[58px] shrink-0 items-stretch border-b border-ui-border bg-ui-panel px-1">
      {children}
    </nav>
  )
}
