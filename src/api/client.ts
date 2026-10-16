import axios, { type InternalAxiosRequestConfig } from 'axios'
import { AuthSessionResponseSchema, type AuthSessionResponse } from '@/types/api'
import queryClient from './queryClient'
import { authKeys } from '@/hooks/queryKeys'

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

type RetriableConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean }

// 로그인 로직: 어떤 API든 401을 받으면 POST /auth/refresh를 한 번만 시도해서 재발급된 쿠키로
// 원래 요청을 재시도한다. refresh도 실패하면 로그아웃 상태로 간주하고(세션 캐시를 anonymous로
// 되돌린다) 원래 에러를 그대로 던진다 — 화면은 이후 로그아웃 UI로 자연히 전환된다.
// /auth/** 자체의 401(예: 세션 없음)은 재시도 대상이 아니다 — 무한 루프를 막는다.
let refreshPromise: Promise<AuthSessionResponse> | null = null
let lastRefreshAt = 0

export function markSessionAnonymous() {
  queryClient.setQueryData(authKeys.session(), {
    authenticated: false,
    userId: null,
    email: null,
    role: null,
    nickname: null,
    profileImageVersion: null,
    nicknameChangeableAt: null,
  })
}

export function getLastRefreshAt() {
  return lastRefreshAt
}

// 계정 전환 전에 진행 중인 갱신을 마쳐 이전 계정의 쿠키가 새 계정 쿠키를 덮지 않게 한다.
export async function settleSessionRefresh() {
  await refreshPromise?.catch(() => undefined)
}

// 진행 중인 갱신이 있으면 그 promise를 공유하고, 없으면 새로 /auth/refresh를 호출한다. 401
// 인터셉터와 useSessionKeepAlive(선제 갱신)가 동시에 갱신을 시도해도 요청이 한 번만 나가도록 한다.
export function refreshSessionOnce(): Promise<AuthSessionResponse> {
  if (!refreshPromise) {
    refreshPromise = client
      .post('/auth/refresh')
      .then(response => {
        const parsed = AuthSessionResponseSchema.parse(response.data)
        queryClient.setQueryData(authKeys.session(), parsed)
        lastRefreshAt = Date.now()
        return parsed
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

client.interceptors.response.use(
  response => response,
  async error => {
    const config = error?.config as RetriableConfig | undefined
    const status = error?.response?.status
    const isAuthEndpoint = typeof config?.url === 'string' && config.url.includes('/auth/')

    if (status !== 401 || !config || config._retriedAfterRefresh || isAuthEndpoint) {
      return Promise.reject(error)
    }

    config._retriedAfterRefresh = true
    try {
      await refreshSessionOnce()
      return await client(config)
    } catch {
      markSessionAnonymous()
      return Promise.reject(error)
    }
  },
)

export default client
