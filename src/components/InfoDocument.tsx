import type { ReactNode } from 'react'

export function InfoPageHeading({ title, summary, effectiveDate, actions, sticky = false, flushBottom = false }: { title: string; summary: string; effectiveDate?: string; actions?: ReactNode; sticky?: boolean; flushBottom?: boolean }) {
  return (
    <header className={`${sticky ? 'sticky top-0 z-20 bg-ui-background' : ''} ${sticky || flushBottom ? 'mb-0' : 'mb-7'} border-b border-ui-border pb-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-2xl font-bold text-ui-white">
          <span aria-hidden="true" className="h-7 w-1 shrink-0 rounded-sm bg-brand" />
          {title}
        </h1>
        {(effectiveDate || actions) && <div className="flex shrink-0 items-center gap-2">
          {actions}
          {effectiveDate && <p className="inline-flex shrink-0 whitespace-nowrap border border-ui-border bg-ui-panel px-2 py-1 text-xs text-ui-muted">시행일 {effectiveDate}</p>}
        </div>}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-ui-text">{summary}</p>
    </header>
  )
}

export function InfoSection({ number, title, children }: { number?: string; title: string; children: ReactNode }) {
  return (
    <section className="border-b border-ui-border pb-5 last:border-b-0">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ui-white">
        {number && <span aria-hidden="true" className="inline-flex h-6 min-w-6 items-center justify-center bg-brand-surface px-1.5 text-xs font-bold text-brand">{number}</span>}
        {!number && <span className="h-4 w-1 shrink-0 rounded-sm bg-brand" />}
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ui-text">{children}</div>
    </section>
  )
}

export function InfoCallout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="border-l-2 border-brand bg-ui-panel px-4 py-3">
      <h3 className="text-sm font-bold text-ui-white">{title}</h3>
      <div className="mt-1 text-sm leading-relaxed text-ui-text">{children}</div>
    </aside>
  )
}

export function InfoFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-ui-border px-3 py-3 last:border-b-0 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
      <h3 className="font-bold text-ui-white">{label}</h3>
      <div className="mt-1 leading-relaxed text-ui-text sm:mt-0">{children}</div>
    </div>
  )
}

export const INFO_LIST = 'list-disc space-y-1 pl-5 text-sm leading-relaxed text-ui-text'
export const INFO_FACTS = 'overflow-hidden border border-ui-border bg-ui-panel'
