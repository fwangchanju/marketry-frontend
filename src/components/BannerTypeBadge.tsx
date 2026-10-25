export default function BannerTypeBadge({ type }: { type: 'NOTICE' | 'AD' }) {
  return (
    <span className={`inline-flex h-4 shrink-0 items-center justify-center rounded-sm px-1 text-[10px] font-semibold leading-none ${type === 'NOTICE' ? 'bg-brand-surface text-ui-white' : 'bg-admin-only text-ui-background'}`}>
      {type === 'NOTICE' ? '공지' : '광고'}
    </span>
  )
}
