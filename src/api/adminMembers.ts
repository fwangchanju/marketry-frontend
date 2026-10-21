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
    // 최근 30일 중 접속한 날 수 — 서버가 아직 주지 않는 동안은 비어 있다.
    accessDays: z.number().nullable().optional(),
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

export function resetMembersNickname(userIds: number[]) {
  return client
    .patch('/admin/members/nickname-reset', { userIds })
    .then(response => z.object({ reset: z.number() }).parse(response.data))
}

const DailyAccessSchema = z.array(z.object({ date: z.string(), members: z.number() }))

// 최근 N일(오늘 포함)의 일별 접속 회원 수 — 접속한 사람이 없는 날도 0명으로 채워 받는다.
export function getAdminDailyAccess(days: number, signal?: AbortSignal) {
  return client.get('/admin/members/access-daily', { params: { days }, signal }).then(response => DailyAccessSchema.parse(response.data))
}

const SignupDailySchema = z.array(z.object({ date: z.string(), joined: z.number(), total: z.number() }))

// 최근 N일(오늘 포함)의 일별 신규 가입 수와 누적 회원 수 — 가입 시각으로 세므로 과거부터 채워져 있다.
export function getAdminSignups(days: number, signal?: AbortSignal) {
  return client.get('/admin/members/signups', { params: { days }, signal }).then(response => SignupDailySchema.parse(response.data))
}

const AccessFrequencySchema = z.array(z.object({ label: z.string(), members: z.number() }))

// 최근 30일 중 접속한 날 수 구간별 회원 수.
export function getAdminAccessFrequency(signal?: AbortSignal) {
  return client.get('/admin/members/access-frequency', { signal }).then(response => AccessFrequencySchema.parse(response.data))
}
