import { http, HttpResponse, delay } from 'msw'
import * as data from './data'

const snapshot = <T>(items: T[]) => ({ snapshotTime: new Date().toISOString().slice(0, 19), items })
const ok = () => HttpResponse.json({})
const anonymousSession = () =>
  HttpResponse.json({
    authenticated: false,
    userId: null,
    email: null,
    role: null,
    nickname: null,
    profileImageVersion: null,
  })
const authenticatedSession = () =>
  HttpResponse.json({
    authenticated: true,
    userId: data.mockAuth.userId,
    email: data.mockAuth.email,
    role: data.mockAuth.role,
    nickname: data.mockProfile.nickname,
    profileImageVersion: data.mockProfile.imageVersion,
  })
const profileResponse = () =>
  HttpResponse.json({
    nickname: data.mockProfile.nickname,
    hasImage: data.mockProfile.image !== null,
    imageVersion: data.mockProfile.imageVersion,
  })

export const handlers = [
  http.get('/api/map/trading-schedule', ({ request }) => HttpResponse.json({
    date: new URL(request.url).searchParams.get('date'),
    status: 'FAILED',
    preMarket: null,
    regularMarket: null,
    afterMarket: null,
    nxtOnlyWindows: [],
  })),
  // ── 프로필(닉네임·사진) ───────────────────────────────────────────────
  http.get('/api/profile', () => profileResponse()),
  http.put('/api/profile/nickname', async ({ request }) => {
    const body = (await request.json()) as { nickname?: string }
    data.mockProfile.nickname = body.nickname?.trim() || null
    return profileResponse()
  }),
  http.put('/api/profile/image', async ({ request }) => {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) return new HttpResponse(null, { status: 400 })
    data.mockProfile.image = await file.arrayBuffer()
    data.mockProfile.imageVersion = Date.now()
    return profileResponse()
  }),
  http.delete('/api/profile/image', () => {
    data.mockProfile.image = null
    data.mockProfile.imageVersion = null
    return new HttpResponse(null, { status: 204 })
  }),
  http.get('/api/profile/image', () =>
    data.mockProfile.image === null
      ? new HttpResponse(null, { status: 404 })
      : new HttpResponse(data.mockProfile.image, { headers: { 'Content-Type': 'image/jpeg' } }),
  ),
  // ── 인증(가입/로그인 전환) ────────────────────────────────────────────
  // 실제 Google OAuth 대신, dev:mock에서는 이 요청 자체를 "로그인 성공"으로 취급하고 곧바로
  // returnTo로 리다이렉트한다 — LoginModal의 <a href>가 실제 페이지 이동을 트리거하므로 여기서도
  // 진짜 302로 응답해야 브라우저가 실제로 그 경로로 이동한다.
  http.get('/api/auth/google', ({ request }) => {
    const url = new URL(request.url)
    const returnTo = url.searchParams.get('returnTo') || '/'
    data.mockAuth.authenticated = true
    return new HttpResponse(null, { status: 302, headers: { Location: returnTo } })
  }),
  http.get('/api/auth/session', () => (data.mockAuth.authenticated ? authenticatedSession() : anonymousSession())),
  http.post('/api/auth/refresh', () =>
    data.mockAuth.authenticated ? authenticatedSession() : new HttpResponse(null, { status: 401 }),
  ),
  http.post('/api/auth/logout', () => {
    data.mockAuth.authenticated = false
    return new HttpResponse(null, { status: 204 })
  }),

  // ── 대시보드(시장요약, 홈 화면이 지수 등락률만 쓴다) ────────────────────────────────
  http.get('/api/summary', () => HttpResponse.json({ marketOverviews: snapshot(data.marketOverviews) })),

  // ── 마켓맵(공개 기본 조회) ────────────────────────────────────────────
  // marketOverview는 market이 단일 마켓일 때만(ALL_STOCK이면 단일 지수값이 없어 null) — 실제 백엔드와 동일.
  // 지연을 둬서 섹터 페이지 쌍 쿼리의 placeholder·스피너를 dev:mock에서 눈으로 볼 수 있게 한다(결정 7).
  // source=mine은 비로그인이면 실제로는 401이지만(가입/로그인 전환 4), 프론트가 이미 비로그인에서
  // 거래소로 바꿔 요청하므로 목업에서 그 가드까지 재현할 필요는 없다.
  http.get('/api/map', async ({ request }) => {
    await delay(1200)
    const url = new URL(request.url)
    const market = url.searchParams.get('market')
    // source가 krx가 아니면(marketry·mine) 커스텀 트리를 준다. 옛 요청(source 없음)은 isCustom을 따른다.
    const source = url.searchParams.get('source')
    const isCustom = source ? source !== 'KRX' : url.searchParams.get('isCustom') === 'true'
    const snapshotTime = url.searchParams.get('snapshotTime')
    const marketOverview = data.marketOverviews.find(o => o.market === market) ?? null
    const tree = isCustom ? data.marketMapTree : data.toDefaultModeTree(data.marketMapTree)

    if (!snapshotTime) {
      return HttpResponse.json({
        ...snapshot(tree),
        marketOverview,
        taxonomyUpdatedAt: isCustom ? '2026-10-01T09:00:00' : '2026-10-02T07:00:00',
      })
    }
    // snapshotTime이 있으면 그 값을 응답에 그대로 싣고(결정 4의 "요청 시각과 같아야 before로 인정" 조건을
    // 목업에서도 통과시키기 위함), 종목 changeRate를 낮춘 트리를 준다.
    return HttpResponse.json({
      snapshotTime,
      items: data.shiftMarketMapTreeChangeRates(tree),
      marketOverview: marketOverview
        ? { ...marketOverview, changeRate: marketOverview.changeRate - data.MOCK_BEFORE_INDEX_CHANGE_RATE_DELTA }
        : null,
    })
  }),
  // 공개 기본값 — 로그인 사용자는 아래 /custom/value-tiers, /custom/scale로 각자 값을 받는다.
  http.get('/api/map/value-tiers', () => HttpResponse.json(data.marketValueTiers)),
  http.get('/api/map/stock-catalog', () =>
    HttpResponse.json(
      data.customStockSectors.map(({ stockCode, market, nxtEnabled, industryName }) => ({
        stockCode,
        market,
        nxtEnabled,
        industryName,
      })),
    ),
  ),
  http.get('/api/map/scale', () => HttpResponse.json(data.marketMapColorScale)),
  http.get('/api/map/excluded-stocks', () => HttpResponse.json(data.excludedStocks)),
  http.post('/api/map/excluded-stocks/:stockCode', ok),
  http.delete('/api/map/excluded-stocks/:stockCode', ok),
  http.delete('/api/map/excluded-stocks', ok),
  http.post('/api/map/excluded-sectors/:sectorId', ok),
  http.delete('/api/map/excluded-sectors/:sectorId', ok),
  http.delete('/api/map/excluded-sectors', ok),
  http.delete('/api/map/reset', ok),

  // ── 커스텀(로그인 사용자 전용, /api/admin/market-map/* → /api/custom/* 전환) ────────────────
  http.get('/api/custom/sectors', () => HttpResponse.json(data.customSectors)),
  http.post('/api/custom/sectors', async ({ request }) => {
    const body = (await request.json()) as { name: string; parentId: number | null }
    const parent = body.parentId != null ? data.customSectors.find(c => c.id === body.parentId) : null
    return HttpResponse.json({
      id: Math.floor(Math.random() * 1_000_000),
      name: body.name,
      parentId: body.parentId,
      depth: parent ? parent.depth + 1 : 0,
    })
  }),
  http.patch('/api/custom/sectors/:id/name', ok),
  http.patch('/api/custom/sectors/:id/parent', ok),
  http.get('/api/custom/sectors/:id/delete-preview', ({ params }) => {
    const sector = data.customSectors.find(c => c.id === Number(params.id))
    if (!sector) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json({ sectorName: sector.name, deletable: true, blockingStocks: [], deletableSectors: [] })
  }),
  http.delete('/api/custom/sectors/:id', ok),
  http.get('/api/custom/snapshots', () => HttpResponse.json(data.customSnapshots)),
  http.get('/api/custom/snapshots/current', () => HttpResponse.json(data.customSnapshots[0] ?? null)),
  http.post('/api/custom/snapshots', async ({ request }) => {
    const body = (await request.json()) as { label: string }
    const nowText = new Date().toISOString().slice(0, 19)
    return HttpResponse.json({ id: Math.floor(Math.random() * 1_000_000), label: body.label, createdAt: nowText, updatedAt: nowText })
  }),
  http.patch('/api/custom/snapshots/:id', async ({ request, params }) => {
    const body = (await request.json()) as { label: string }
    const existing = data.customSnapshots.find(v => v.id === Number(params.id))
    return HttpResponse.json({
      id: Number(params.id),
      label: body.label,
      createdAt: existing?.createdAt ?? new Date().toISOString().slice(0, 19),
      updatedAt: new Date().toISOString().slice(0, 19),
    })
  }),
  http.post('/api/custom/snapshots/:id/restore', ok),
  http.delete('/api/custom/snapshots/:id', ok),
  http.post('/api/custom/scale', async ({ request }) => {
    const body = (await request.json()) as { thresholdPercent: number; color: string; colorLabel: string | null }
    return HttpResponse.json({ id: Math.floor(Math.random() * 1_000_000), ...body })
  }),
  http.put('/api/custom/scale/:id', async ({ request, params }) => {
    const body = (await request.json()) as { thresholdPercent: number; color: string; colorLabel: string | null }
    return HttpResponse.json({ id: Number(params.id), ...body })
  }),
  http.delete('/api/custom/scale/:id', ok),
  // 로그인 사용자 본인 값 — dev:mock에서는 공개 기본값과 동일한 목업 데이터를 그대로 재사용한다.
  http.get('/api/custom/scale', () => HttpResponse.json(data.marketMapColorScale)),
  http.get('/api/custom/value-tiers', () => HttpResponse.json(data.marketValueTiers)),
  http.get('/api/custom/stock-sectors', () => HttpResponse.json(snapshot(data.customStockSectors))),
  http.put('/api/custom/stock-sectors/:stockCode', ok),
  http.patch('/api/custom/stock-sectors/:stockCode/alias', ok),
  http.delete('/api/custom/stock-sectors/:stockCode/alias', ok),
  http.patch('/api/custom/stock-sectors/bulk', async ({ request }) => {
    const body = (await request.json()) as { stockCodes: string[]; sectorId: number }
    return HttpResponse.json({ failedStockCodes: [], sectorId: body.sectorId })
  }),

  // 사용자가 바꾼 값만 담는 sparse JSON — 전체 교체(PUT)만 지원한다.
  http.get('/api/custom/preferences', () => HttpResponse.json(data.mockCustomPreferences)),
  http.put('/api/custom/preferences', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    Object.keys(data.mockCustomPreferences).forEach(key => delete data.mockCustomPreferences[key])
    Object.assign(data.mockCustomPreferences, body)
    return HttpResponse.json({})
  }),
]
