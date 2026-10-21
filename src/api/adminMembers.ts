import { z } from 'zod'
import client from './client'

const MemberPageSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    email: z.string().nullable(),
    nickname: z.string().nullable(),
    role: z.enum(['USER', 'ADMIN']),
    createdAt: z.string(),
    lastAccessAt: z.string().nullable(),
  })),
  total: z.number(),
  accessTrackingAvailable: z.boolean(),
})

export function getAdminMembers(params: { query: string; role: string; sort: string; order: string; page: number }, signal?: AbortSignal) {
  return client.get('/admin/members', { params, signal }).then(response => MemberPageSchema.parse(response.data))
}

const MemberSummarySchema = z.object({
  total: z.number(),
  admins: z.number(),
  users: z.number(),
  joinedRecently: z.number(),
})

export function getAdminMemberSummary(signal?: AbortSignal) {
  return client.get('/admin/members/summary', { signal }).then(response => MemberSummarySchema.parse(response.data))
}
