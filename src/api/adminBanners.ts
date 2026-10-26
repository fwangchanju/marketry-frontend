import { z } from 'zod'
import client from './client'

export const BannerTypeSchema = z.enum(['AD', 'NOTICE'])
export const BannerStatusSchema = z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'ENDED'])

export const BannerCampaignSchema = z.object({
  id: z.number(),
  type: BannerTypeSchema,
  title: z.string(),
  text: z.string().nullable(),
  linkUrl: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  status: BannerStatusSchema,
  updatedAt: z.string(),
  hasImage: z.boolean(),
  imageContentType: z.string().nullable(),
  textScalePercent: z.number().default(100),
  textBold: z.boolean().default(false),
})

export const ActiveBannerSchema = z.object({
  active: z.boolean(),
  id: z.number().nullable(),
  type: BannerTypeSchema.nullable(),
  title: z.string().nullable(),
  text: z.string().nullable(),
  linkUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageContentType: z.string().nullable(),
  nextRefreshAt: z.string().nullable(),
  textScalePercent: z.number().default(100),
  textBold: z.boolean().default(false),
})

export const BannerRotationSettingSchema = z.object({
  intervalSeconds: z.number(),
  saved: z.boolean(),
  updatedAt: z.string().nullable(),
})

export type BannerCampaign = z.infer<typeof BannerCampaignSchema>
export type ActiveBanner = z.infer<typeof ActiveBannerSchema>
export type BannerRotationSetting = z.infer<typeof BannerRotationSettingSchema>

export interface BannerDraftInput {
  id: number | null
  type: BannerCampaign['type']
  title: string
  text: string
  textScalePercent: number
  textBold: boolean
  linkUrl: string
  startsAt: string
  endsAt: string
  file: File | null
}

export function getAdminBanners(signal?: AbortSignal): Promise<BannerCampaign[]> {
  return client.get('/admin/banners', { signal }).then(response => z.array(BannerCampaignSchema).parse(response.data))
}

export function getActiveBanner(signal?: AbortSignal): Promise<ActiveBanner> {
  return client.get('/banners/active', { signal }).then(response => ActiveBannerSchema.parse(response.data))
}

export function getBannerRotationSetting(signal?: AbortSignal): Promise<BannerRotationSetting> {
  return client.get('/admin/banners/rotation-setting', { signal }).then(response => BannerRotationSettingSchema.parse(response.data))
}

export function saveBannerRotationSetting(intervalSeconds: number): Promise<BannerRotationSetting> {
  return client.put('/admin/banners/rotation-setting', { intervalSeconds }).then(response => BannerRotationSettingSchema.parse(response.data))
}

export function saveBannerDraft(input: BannerDraftInput): Promise<BannerCampaign> {
  const form = new FormData()
  form.append('type', input.type)
  form.append('title', input.title)
  form.append('text', input.text)
  form.append('textScalePercent', String(input.textScalePercent))
  form.append('textBold', String(input.textBold))
  form.append('linkUrl', input.linkUrl)
  form.append('startsAt', input.startsAt)
  form.append('endsAt', input.endsAt)
  if (input.file) form.append('file', input.file)
  const request = input.id === null
    ? client.post('/admin/banners', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    : client.put(`/admin/banners/${input.id}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return request.then(response => BannerCampaignSchema.parse(response.data))
}

export function approveBanner(id: number): Promise<BannerCampaign> {
  return client.post(`/admin/banners/${id}/approve`).then(response => BannerCampaignSchema.parse(response.data))
}

export function cancelBannerSchedule(id: number): Promise<BannerCampaign> {
  return client.post(`/admin/banners/${id}/cancel-schedule`).then(response => BannerCampaignSchema.parse(response.data))
}

export function endBannerCampaign(id: number): Promise<BannerCampaign> {
  return client.post(`/admin/banners/${id}/end`).then(response => BannerCampaignSchema.parse(response.data))
}

export function deleteBannerCampaign(id: number): Promise<void> {
  return client.delete(`/admin/banners/${id}`).then(() => undefined)
}

export function adminBannerImageUrl(id: number, updatedAt?: string): string {
  const version = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : ''
  return `/api/admin/banners/${id}/image${version}`
}
