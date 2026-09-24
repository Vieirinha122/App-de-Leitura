import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { env } from '@/lib/config/env'
import { listSources } from '@/modules/sources/service'
import { syncSource, SyncResult } from '@/modules/sources/sync-service'

export async function cronRoutes(app: FastifyInstance) {
  /**
   * POST /api/cron/sync
   *
   * Sincroniza todas as fontes RSS habilitadas. Chamado por um cron externo
   * (ex: cron-job.org) que envia o header x-cron-secret para autenticação.
   *
   * Serve também como keep-alive: o próprio cron externo que faz GET /api/health
   * a cada 10 minutos impede que o Render free tier adormeça o processo.
   */
  app.post('/cron/sync', {
    schema: {
      tags: ['Cron'],
      summary: 'Sincronizar todas as fontes RSS (cron externo)',
      response: {
        200: z.object({
          success: z.literal(true),
          totalImported: z.number(),
          totalSkipped: z.number(),
          sourcesSynced: z.number(),
          results: z.array(z.object({
            sourceId: z.string(),
            imported: z.number(),
            skipped: z.number(),
            message: z.string()
          })),
          syncedAt: z.string().datetime()
        }),
        401: z.object({ message: z.string() }),
        503: z.object({ message: z.string(), reason: z.string() })
      }
    }
  }, async (request, reply) => {
    // Autenticação por header secret
    const incomingSecret = request.headers['x-cron-secret'] as string | undefined

    if (!env.CRON_SECRET) {
      app.log.warn('CRON_SECRET não configurado — rota /api/cron/sync bloqueada')
      return reply.status(503).send({
        message: 'Cron endpoint não está configurado no servidor.',
        reason: 'CRON_SECRET ausente nas variáveis de ambiente'
      })
    }

    if (incomingSecret !== env.CRON_SECRET) {
      app.log.warn({ ip: request.ip }, 'Tentativa de acesso ao cron sem secret válido')
      return reply.status(401).send({ message: 'Unauthorized' })
    }

    // Sync de todas as fontes habilitadas com feed RSS
    const sources = await listSources()
    const results: SyncResult[] = []
    const startedAt = Date.now()

    for (const source of sources) {
      if (!source.enabled || !source.feedUrl) continue

      try {
        const result = await syncSource(source.id)
        results.push(result)
        app.log.info(result, `Cron: sincronizado "${source.name}"`)
      } catch (error) {
        app.log.error({ error, sourceId: source.id, sourceName: source.name }, 'Cron: falha ao sincronizar fonte')
        // Continua para as próximas fontes mesmo se uma falhar
      }
    }

    const totalImported = results.reduce((sum, r) => sum + r.imported, 0)
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)
    const elapsedMs = Date.now() - startedAt

    app.log.info(
      { totalImported, totalSkipped, sourcesSynced: results.length, elapsedMs },
      'Cron: sync RSS concluído'
    )

    return {
      success: true as const,
      totalImported,
      totalSkipped,
      sourcesSynced: results.length,
      results,
      syncedAt: new Date().toISOString()
    }
  })
}
