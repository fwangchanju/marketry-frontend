import type { AdBannerSize } from '@/components/AdBannerSlot'
import { BannerImage, NoticeBanner } from '@/components/BannerContent'
import BannerTypeBadge from '@/components/BannerTypeBadge'

export default function BannerPreview({
  type,
  title,
  text = '',
  imageUrl,
  size = { width: 728, height: 90 },
  textScalePercent = 100,
  textBold = false,
  emptyMessage = '광고 이미지 없음',
  className = '',
  framed = true,
}: {
  type: 'NOTICE' | 'AD'
  title: string
  text?: string
  imageUrl?: string | null
  size?: AdBannerSize
  textScalePercent?: number
  textBold?: boolean
  emptyMessage?: string
  className?: string
  framed?: boolean
}) {
  const emptyAdPreview = framed && type === 'AD' && !imageUrl
  const previewClassName = framed
    ? `flex h-[90px] w-full max-w-[728px] items-center justify-center overflow-hidden border border-ui-border ${emptyAdPreview ? 'bg-ui-popup' : 'bg-ui-panel'} ${className}`
    : `flex h-full w-full items-center justify-center overflow-hidden ${className}`

  return (
    <div className={previewClassName}>
      {type === 'NOTICE'
        ? <NoticeBanner title={title || '제목을 입력해 주세요.'} text={text || '내용을 입력해 주세요.'} linkUrl={null} size={size} preview textScalePercent={textScalePercent} textBold={textBold} />
        : imageUrl
          ? <BannerImage src={imageUrl} title={title || '광고 배너'} size={size} preview />
          : emptyAdPreview
            ? <div className="flex w-full items-center justify-start gap-3 px-5 text-sm text-ui-background"><BannerTypeBadge type="AD" size="normal" /><span>이미지를 선택해 주세요.</span></div>
            : <span className="text-center text-sm text-ui-muted">{emptyMessage}</span>}
    </div>
  )
}
