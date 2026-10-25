import { useQuery } from '@tanstack/react-query'
import { adminBannerImageUrl, getActiveBanner, getAdminBanners } from '@/api/adminBanners'
import { BannerImage, NoticeBanner } from '@/components/BannerContent'
import AdBannerSlot from '@/components/AdBannerSlot'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'

function refreshInterval(nextRefreshAt: string | null | undefined) {
  if (!nextRefreshAt) return 60_000
  // The API serializes KST LocalDateTime without an offset. Parse it as KST,
  // independent of the visitor's browser timezone.
  const untilTransition = Date.parse(`${nextRefreshAt}+09:00`) - Date.now()
  return untilTransition > 0 ? Math.min(60_000, untilTransition + 250) : 1_000
}


export default function ActiveBannerSlot() {
  const { data: session } = useSession()
  const isAdmin = isAdminSession(session)
  const { data } = useQuery({
    queryKey: ['banners', 'active'],
    queryFn: ({ signal }) => getActiveBanner(signal),
    retry: false,
    staleTime: 0,
    refetchInterval: query => refreshInterval(query.state.data?.nextRefreshAt),
  })
  const { data: adminCampaigns, isPending: isLoadingAdminCampaigns } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: ({ signal }) => getAdminBanners(signal),
    enabled: isAdmin,
    retry: false,
    staleTime: 0,
  })

  const newestByUpdate = (campaigns: NonNullable<typeof adminCampaigns>) => [...campaigns].sort((first, second) => second.updatedAt.localeCompare(first.updatedAt) || second.id - first.id)[0]
  const adminDrafts = adminCampaigns?.filter(campaign => campaign.status === 'DRAFT')
  const adminScheduled = adminCampaigns?.filter(campaign => campaign.status === 'SCHEDULED')
  const adminPreview = isAdmin
    ? (adminDrafts?.length ? newestByUpdate(adminDrafts) : adminScheduled?.length ? newestByUpdate(adminScheduled) : undefined)
    : undefined

  if (isAdmin && isLoadingAdminCampaigns) return null

  if (adminPreview) {
    return (
      <AdBannerSlot>
        {size => adminPreview.type === 'AD' && adminPreview.hasImage ? (
          <BannerImage src={adminBannerImageUrl(adminPreview.id, adminPreview.updatedAt)} title={adminPreview.title} size={size} />
        ) : adminPreview.type === 'NOTICE' ? (
          <NoticeBanner title={adminPreview.title} text={adminPreview.text ?? ''} linkUrl={adminPreview.linkUrl} size={size} preview textScalePercent={adminPreview.textScalePercent} textBold={adminPreview.textBold} />
        ) : null}
      </AdBannerSlot>
    )
  }

  if (!data?.active) return null
  return (
    <AdBannerSlot>
      {size => data.type === 'AD' && data.imageUrl ? (
        <BannerImage src={data.imageUrl} title={data.title ?? '광고'} size={size} />
      ) : data.type === 'NOTICE' ? (
        <NoticeBanner title={data.title ?? '공지'} text={data.text ?? ''} linkUrl={data.linkUrl} size={size} textScalePercent={data.textScalePercent} textBold={data.textBold} />
      ) : null}
    </AdBannerSlot>
  )
}
