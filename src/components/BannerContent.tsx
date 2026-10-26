import type { AdBannerSize } from '@/components/AdBannerSlot'

export function NoticeBanner({ title, text, linkUrl, size, preview = false, textScalePercent = 100, textBold = false }: { title: string; text: string; linkUrl: string | null; size: AdBannerSize; preview?: boolean; textScalePercent?: number; textBold?: boolean }) {
  const compact = size.height < 90
  const baseFontSize = compact ? 10 : 12
  const fontSize = baseFontSize * textScalePercent / 100
  const lineHeight = fontSize * 1.25
  const titleLineHeight = (compact ? 12 : 14) * 1.25
  const maxLines = Math.max(1, Math.floor((size.height - titleLineHeight) / lineHeight))
  const content = (
    <div className={`flex h-full w-full items-center gap-3 overflow-hidden bg-brand-surface text-ui-white tracking-normal ${compact ? 'px-3' : 'px-5'}`}>
      <span aria-hidden="true" className={`shrink-0 bg-brand px-1.5 py-1 font-bold text-ui-background ${compact ? 'text-xs' : 'text-sm'}`}>공지</span>
      <div data-banner-text-area="" className="min-w-0 flex-1">
        <p data-banner-title="" className={`m-0 truncate font-bold leading-tight ${compact ? 'text-xs' : 'text-sm'}`}>{title}</p>
        {text && <p data-banner-text-body="" data-banner-max-lines={maxLines} className={`m-0 whitespace-pre-line text-ui-white/80 [display:-webkit-box] [-webkit-box-orient:vertical] [overflow:hidden] [overflow-wrap:anywhere] ${textBold ? 'font-bold' : 'font-normal'}`} style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeight}px`, WebkitLineClamp: maxLines }}>{text}</p>}
      </div>
      <span aria-hidden={!linkUrl || undefined} className={`shrink-0 whitespace-nowrap font-bold ${linkUrl ? 'text-brand' : 'invisible'} ${compact ? 'text-[10px]' : 'text-xs'}`}>자세히 보기 ›</span>
    </div>
  )
  return linkUrl && !preview
    ? <a href={linkUrl} className="block h-full w-full no-underline">{content}</a>
    : content
}


export function BannerImage({ src, title, size, linkUrl, preview = false }: { src: string; title: string; size: AdBannerSize; linkUrl?: string | null; preview?: boolean }) {
  const image = <img src={src} alt={title} className="h-full w-full object-contain" width={size.width} height={size.height} />
  return linkUrl && !preview
    ? <a href={linkUrl} className="block h-full w-full no-underline">{image}</a>
    : image
}
