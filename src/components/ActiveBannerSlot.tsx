import { useQuery } from '@tanstack/react-query'
import { getActiveBanner } from '@/api/adminBanners'
import type { AdBannerSize } from '@/components/AdBannerSlot'
import AdBannerSlot from '@/components/AdBannerSlot'

function refreshInterval(nextRefreshAt: string | null | undefined) {
  if (!nextRefreshAt) return 60_000
  // The API serializes KST LocalDateTime without an offset. Parse it as KST,
  // independent of the visitor's browser timezone.
  const untilTransition = Date.parse(`${nextRefreshAt}+09:00`) - Date.now()
  return untilTransition > 0 ? Math.min(60_000, untilTransition + 250) : 1_000
}

function NoticeBanner({ title, text, linkUrl, size }: { title: string; text: string; linkUrl: string | null; size: AdBannerSize }) {
  const content = (
    <div className={`flex h-full w-full items-center gap-3 overflow-hidden bg-brand-surface text-ui-white ${size.height < 90 ? 'px-3' : 'px-5'}`}>
      <span aria-hidden="true" className="shrink-0 border border-brand px-1.5 py-1 text-[10px] font-bold text-brand">공지</span>
      <div className="min-w-0 flex-1">
        <p className={`m-0 truncate font-bold leading-tight ${size.height < 90 ? 'text-xs' : 'text-sm'}`}>{title}</p>
        {text && <p className={`m-0 truncate text-ui-white/80 ${size.height < 90 ? 'text-[10px]' : 'text-xs'}`}>{text}</p>}
      </div>
      {linkUrl && <span className={`shrink-0 whitespace-nowrap font-bold text-brand ${size.height < 90 ? 'text-[10px]' : 'text-xs'}`}>자세히 보기 ›</span>}
    </div>
  )
  return linkUrl
    ? <a href={linkUrl} className="block h-full w-full no-underline">{content}</a>
    : content
}

export default function ActiveBannerSlot() {
  const { data } = useQuery({
    queryKey: ['banners', 'active'],
    queryFn: ({ signal }) => getActiveBanner(signal),
    retry: false,
    staleTime: 0,
    refetchInterval: query => refreshInterval(query.state.data?.nextRefreshAt),
  })

  if (!data?.active) return null
  return (
    <AdBannerSlot>
      {size => data.type === 'AD' && data.imageUrl ? (
        <BannerImage src={data.imageUrl} title={data.title ?? '광고'} size={size} />
      ) : data.type === 'NOTICE' ? (
        <NoticeBanner title={data.title ?? '공지'} text={data.text ?? ''} linkUrl={data.linkUrl} size={size} />
      ) : null}
    </AdBannerSlot>
  )
}

function BannerImage({ src, title, size }: { src: string; title: string; size: AdBannerSize }) {
  return <img src={src} alt={title} className="h-full w-full object-contain" width={size.width} height={size.height} />
}
