import cron from 'node-cron'
import { env } from '@/lib/config/env'
import { listSources } from '@/modules/sources/service'
import { syncSource } from '@/modules/sources/sync-service'

export function startRssCron(logger: { info: (obj: unknown, message?: string) => void; error: (obj: unknown, message?: string) => void }) {
  if (env.RSS_CRON_ENABLED !== 'true') {
    logger.info({}, 'RSS scheduler disabled')
    return null
  }

  const task = cron.schedule(env.RSS_CRON_EXPRESSION, async () => {
    try {
      const sources = await listSources()
      for (const source of sources) {
        if (!source.enabled || !source.feedUrl) continue
        try {
          const result = await syncSource(source.id)
          logger.info(result, 'RSS source synchronized')
        } catch (error) {
          logger.error({ error, sourceId: source.id }, 'RSS source synchronization failed')
        }
      }
    } catch (error) {
      logger.error({ error }, 'RSS scheduler failed')
    }
  })

  logger.info({ expression: env.RSS_CRON_EXPRESSION }, 'RSS scheduler enabled')
  return task
}