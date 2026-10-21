import { z } from 'zod'
import client from './client'

const MemberPageSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    issuer: z.string().nullable(),
    email: z.string().nullable(),
    nickname: z.string().nullable(),
    role: z.enum(['USER', 'ADMIN']),
    special: z.boolean(),
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
  specials: z.number(),
  users: z.number(),
  joinedRecently: z.number(),
  // 최근 7일 안에 접속한 회원 수 — 접속 기록이 생긴 뒤부터 센다. 서버가 아직 이 값을 주지 않는 동안은 비어 있다.
  accessedRecently: z.number().optional(),
})

export function getAdminMemberSummary(signal?: AbortSignal) {
  return client.get('/admin/members/summary', { signal }).then(response => MemberSummarySchema.parse(response.data))
}

export function setMembersSpecial(userIds: number[], special: boolean) {
  return client
    .patch('/admin/members/special', { userIds, special })
    .then(response => z.object({ changed: z.number() }).parse(response.data))
}
