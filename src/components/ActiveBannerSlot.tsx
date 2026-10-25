import { useQuery } from '@tanstack/react-query'
import { getActiveBanner } from '@/api/adminBanners'
import { BannerImage, NoticeBanner } from '@/components/BannerContent'
import AdBannerSlot from '@/components/AdBannerSlot'

function refreshInterval(nextRefreshAt: string | null | undefined) {
  if (!nextRefreshAt) return 60_000
  // The API serializes KST LocalDateTime without an offset. Parse it as KST,
  // independent of the visitor's browser timezone.
  const untilTransition = Date.parse(`${nextRefreshAt}+09:00`) - Date.now()
  return untilTransition > 0 ? Math.min(60_000, untilTransition + 250) : 1_000
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
        <BannerImage src={data.imageUrl} title={data.title ?? '광고'} size={size} linkUrl={data.linkUrl} />
      ) : data.type === 'NOTICE' ? (
        <NoticeBanner title={data.title ?? '공지'} text={data.text ?? ''} linkUrl={data.linkUrl} size={size} textScalePercent={data.textScalePercent} textBold={data.textBold} />
      ) : null}
    </AdBannerSlot>
  )
}
