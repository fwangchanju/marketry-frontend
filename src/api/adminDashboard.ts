import { z } from 'zod'
import client from './client'

const AdminDashboardMetricsSchema = z.object({
  classificationEligibleMembers: z.number(),
  classifiedMembers: z.number(),
  revisitEligibleMembers: z.number(),
  returningMembers: z.number(),
  pages: z.array(z.object({ page: z.string(), pageLoads: z.number(), averageLoadMs: z.number(), clientErrors: z.number() })),
  mobileCaptures: z.number(),
  averageMobileCaptureMs: z.number(),
})

export function getAdminDashboardMetrics(days: number, signal?: AbortSignal) {
  return client.get('/admin/dashboard/metrics', { params: { days }, signal })
    .then(response => AdminDashboardMetricsSchema.parse(response.data))
}
