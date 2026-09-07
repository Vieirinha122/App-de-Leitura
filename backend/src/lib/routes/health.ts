import { FastifyInstance } from 'fastify'
import { z } from 'zod'

const healthResponse = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  environment: z.string(),
  version: z.string()
})

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', {
    schema: {
      response: { 200: healthResponse },
      tags: ['Health'],
      summary: 'Health check'
    }
  }, async () => {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? '0.0.1'
    }
  })

  app.get('/health/ready', {
    schema: {
      response: { 200: healthResponse, 503: healthResponse },
      tags: ['Health'],
      summary: 'Readiness check (with dependencies)'
    }
  }, async (request, reply) => {
    // TODO: Check DB connection, Redis, etc.
    const checks = {
      database: 'ok', // await prisma.$queryRaw`SELECT 1` then 'ok' else 'fail'
      redis: 'ok' // await redis.ping() then 'ok' else 'fail'
    }

    const allOk = Object.values(checks).every(v => v === 'ok')
    const status = allOk ? 200 : 503

    return reply.status(status).send({
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV ?? 'development',
      version: process.env.npm_package_version ?? '0.0.1',
      checks
    })
  })
}