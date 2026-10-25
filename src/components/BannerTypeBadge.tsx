export default function BannerTypeBadge({ type, size = 'small' }: { type: 'NOTICE' | 'AD'; size?: 'small' | 'normal' }) {
  const sizeClass = size === 'normal' ? 'h-6 rounded-[4px] px-2 text-sm' : 'h-5 rounded-[4px] px-1.5 text-xs'
  return (
    <span className={`inline-flex shrink-0 items-center justify-center font-semibold leading-none ${sizeClass} ${type === 'NOTICE' ? 'bg-brand-surface text-ui-white' : 'bg-admin-only text-ui-background'}`}>
      {type === 'NOTICE' ? '공지' : '광고'}
    </span>
  )
}
