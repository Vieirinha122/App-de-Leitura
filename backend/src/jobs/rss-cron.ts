import cron from 'node-cron'
import { env } from '@/lib/config/env'
import { listSources } from '@/modules/sources/service'
import { syncSource } from '@/modules/sources/sync-service'

export function startRssCron(logger: { info: (obj: unknown, message?: string) => void; error: (obj: unknown, message?: string) => void }) {
  if (env.RSS_CRON_ENABLED !== 'true') {
    logger.info({}, 'Source scheduler disabled')
    return null
  }

  const task = cron.schedule(env.RSS_CRON_EXPRESSION, async () => {
    try {
      const sources = await listSources()
      for (const source of sources) {
        // Pula desabilitados; fontes 'scraped' (sem feedUrl) também são sincronizadas
        if (!source.enabled) continue
        if (!source.feedUrl && source.type !== 'scraped') continue

        try {
          const result = await syncSource(source.id)
          logger.info(result, 'Source synchronized')
        } catch (error) {
          logger.error({ error, sourceId: source.id, sourceName: source.name }, 'Source synchronization failed')
        }
      }
    } catch (error) {
      logger.error({ error }, 'RSS scheduler failed')
    }
  })

  logger.info({ expression: env.RSS_CRON_EXPRESSION }, 'Source scheduler enabled')
  return task
}