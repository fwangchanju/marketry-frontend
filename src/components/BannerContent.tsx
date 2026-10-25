import type { AdBannerSize } from '@/components/AdBannerSlot'

export function NoticeBanner({ title, text, linkUrl, size, preview = false }: { title: string; text: string; linkUrl: string | null; size: AdBannerSize; preview?: boolean }) {
  const content = (
    <div className={`flex h-full w-full items-center gap-3 overflow-hidden bg-brand-surface text-ui-white ${size.height < 90 ? 'px-3' : 'px-5'}`}>
      <span aria-hidden="true" className="shrink-0 border border-brand px-1.5 py-1 text-[10px] font-bold text-brand">공지</span>
      <div className="min-w-0 flex-1">
        <p className={`m-0 truncate font-bold leading-tight ${size.height < 90 ? 'text-xs' : 'text-sm'}`}>{title}</p>
        {text && <p className={`m-0 line-clamp-2 whitespace-pre-line text-ui-white/80 ${size.height < 90 ? 'text-[10px]' : 'text-xs'}`}>{text}</p>}
      </div>
      {linkUrl && <span className={`shrink-0 whitespace-nowrap font-bold text-brand ${size.height < 90 ? 'text-[10px]' : 'text-xs'}`}>자세히 보기 ›</span>}
    </div>
  )
  return linkUrl && !preview
    ? <a href={linkUrl} className="block h-full w-full no-underline">{content}</a>
    : content
}


export function BannerImage({ src, title, size }: { src: string; title: string; size: AdBannerSize }) {
  return <img src={src} alt={title} className="h-full w-full object-contain" width={size.width} height={size.height} />
}
