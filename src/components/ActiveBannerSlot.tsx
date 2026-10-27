import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getActiveBanner, type ActiveBanner } from '@/api/adminBanners'
import { BannerImage, NoticeBanner } from '@/components/BannerContent'
import AdBannerSlot, { type AdBannerSize } from '@/components/AdBannerSlot'

const SLIDE_DURATION_MS = 450

function bannerContent(banner: ActiveBanner, size: AdBannerSize) {
  return banner.type === 'AD' && banner.imageUrl ? (
    <BannerImage src={banner.imageUrl} title={banner.title ?? '광고'} size={size} linkUrl={banner.linkUrl} />
  ) : banner.type === 'NOTICE' ? (
    <NoticeBanner title={banner.title ?? '공지'} text={banner.text ?? ''} linkUrl={banner.linkUrl} size={size} textScalePercent={banner.textScalePercent} textBold={banner.textBold} />
  ) : null
}

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
  const [transition, setTransition] = useState<{ current: ActiveBanner | undefined; outgoing: ActiveBanner | null }>(() => ({ current: data, outgoing: null }))
  if (transition.current !== data) {
    const outgoing = transition.current?.active && data?.active && transition.current.id !== data.id ? transition.current : null
    setTransition({ current: data, outgoing })
  }
  useEffect(() => {
    if (!transition.outgoing) return
    const timer = window.setTimeout(() => setTransition(current => ({ ...current, outgoing: null })), SLIDE_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [transition.outgoing])

  const banner = transition.current
  const outgoingBanner = transition.outgoing
  if (!banner?.active) return null
  return (
    <AdBannerSlot>
      {size => (
        <div className="relative h-full w-full overflow-hidden">
          {outgoingBanner && <div className="active-banner-slide-out absolute inset-0">{bannerContent(outgoingBanner, size)}</div>}
          <div className={outgoingBanner ? 'active-banner-slide-in absolute inset-0' : 'h-full w-full'}>{bannerContent(banner, size)}</div>
        </div>
      )}
    </AdBannerSlot>
  )
}
