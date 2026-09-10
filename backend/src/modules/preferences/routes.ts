import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/plugin'
import { listPreferences, setPreference } from './service'

const preferenceBody = z.object({
  kind: z.enum(['source', 'category']),
  targetId: z.string().min(1),
  blocked: z.boolean().default(false),
  weight: z.number().int().min(-10).max(10).default(0)
})

export async function preferenceRoutes(app: FastifyInstance) {
  app.get('/preferences', {
    schema: { tags: ['Preferences'], response: { 200: z.array(z.object({ id: z.string(), kind: z.string(), targetId: z.string(), blocked: z.boolean(), weight: z.number() })) } },
    preHandler: [requireAuth]
  }, async (request) => listPreferences(request.user!.id))

  app.put('/preferences', {
    schema: { tags: ['Preferences'], body: preferenceBody },
    preHandler: [requireAuth]
  }, async (request) => {
    const body = request.body as z.infer<typeof preferenceBody>
    return setPreference(request.user!.id, body.kind, body.targetId, body.blocked, body.weight)
  })
}