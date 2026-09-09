import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/plugin'
import { createSource, deleteSource, getSource, listSources, updateSource } from './service'
import { syncSource } from './sync-service'

const sourceType = z.enum(['rss', 'newsletter', 'manual', 'api'])
const sourceBody = z.object({
  name: z.string().min(2).max(120),
  url: z.string().url(),
  feedUrl: z.string().url().optional(),
  type: sourceType,
  enabled: z.boolean().optional()
})

const sourceResponse = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  feedUrl: z.string().nullable(),
  type: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  _count: z.object({ articles: z.number() }).optional()
})

function serialize(source: any) {
  return {
    ...source,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString()
  }
}

export async function sourcesRoutes(app: FastifyInstance) {
  app.get('/sources', {
    schema: { response: { 200: z.array(sourceResponse) }, tags: ['Sources'] },
    preHandler: [requireAuth]
  }, async () => (await listSources()).map(serialize))

  app.get('/sources/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: sourceResponse.nullable() },
      tags: ['Sources']
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const source = await getSource((request.params as { id: string }).id)
    return source ? serialize(source) : null
  })

  app.post('/sources', {
    schema: { body: sourceBody, response: { 201: sourceResponse }, tags: ['Sources'] },
    preHandler: [requireAuth]
  }, async (request, reply) => {
    const source = await createSource(request.body as z.infer<typeof sourceBody>)
    return reply.status(201).send(serialize(source))
  })

  app.patch('/sources/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: sourceBody.partial(),
      response: { 200: sourceResponse },
      tags: ['Sources']
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const source = await updateSource(
      (request.params as { id: string }).id,
      request.body as Partial<z.infer<typeof sourceBody>>
    )
    return serialize(source)
  })

  app.delete('/sources/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 204: z.null() },
      tags: ['Sources']
    },
    preHandler: [requireAuth]
  }, async (request, reply) => {
    await deleteSource((request.params as { id: string }).id)
    return reply.status(204).send()
  })

  app.post('/sources/:id/sync', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: z.object({
          sourceId: z.string(),
          imported: z.number(),
          skipped: z.number(),
          message: z.string()
        })
      },
      tags: ['Sources'],
      summary: 'Sincronizar artigos de um feed RSS'
    },
    preHandler: [requireAuth]
  }, async (request) => {
    return syncSource((request.params as { id: string }).id)
  })
}