import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import Fastify from 'fastify'
import { fastifyCors } from '@fastify/cors'
import { fastifyHelmet } from '@fastify/helmet'
import { fastifyRateLimit } from '@fastify/rate-limit'
import { fastifyCookie } from '@fastify/cookie'
import { fastifyJwt } from '@fastify/jwt'
import { fastifySwagger } from '@fastify/swagger'
import { fastifySwaggerUi } from '@fastify/swagger-ui'
import { ZodTypeProvider, serializerCompiler, validatorCompiler, jsonSchemaTransform } from 'fastify-type-provider-zod'
import pino from 'pino'

import { env } from '@/lib/config/env'
import { errorHandler } from '@/lib/errors/handler'
import { authRoutes } from '@/modules/auth/routes'
import { dailyRoutes } from '@/modules/daily-recommendation/routes'
import { articlesRoutes } from '@/modules/articles/routes'
import { sourcesRoutes } from '@/modules/sources/routes'
import { healthRoutes } from '@/lib/routes/health'
import { authPlugin } from '@/lib/auth/plugin'
import { prisma } from '@/lib/prisma'

const logger = pino({
  level: env.LOG_LEVEL ?? 'info',
  transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty', options: { colorize: true } } : undefined
})

export const app = Fastify({
  logger,
  ajv: { customOptions: { removeAdditional: 'all' } }
}).withTypeProvider<ZodTypeProvider>()

// Prisma instance available on app
app.decorate('prisma', prisma)

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

// Rota raiz 

app.get('/', (request, reply) => {
  reply.send("Rodando")
})

// Security & basics
await app.register(fastifyHelmet, {
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false
})
await app.register(fastifyCors, {
  origin: env.CORS_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
})
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: '1 minute',
  hook: 'onRequest'
})

// Keep logout available even if a stale/malformed cookie breaks cookie parsing.
app.post('/api/v1/auth/logout', async (_request, reply) => {
  const secure = env.NODE_ENV === 'production' ? '; Secure; SameSite=None' : '; SameSite=Lax'
  const expired = 'Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly'

  reply.header('X-Daily-Read-API-Version', 'logout-early-2026-09-08')
  reply.header('Set-Cookie', [
    `accessToken=; ${expired}${secure}`,
    `refreshToken=; ${expired}${secure}`
  ])

  return { success: true }
})

await app.register(fastifyCookie, {
  secret: env.COOKIE_SECRET,
  parseOptions: { 
    httpOnly: true, 
    secure: env.NODE_ENV === 'production', 
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax' 
  }
})
await app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
  cookie: { cookieName: 'accessToken', signed: false },
  sign: { expiresIn: '15m' }
})

// Auth plugin (adds request.user + requireAuth)
await app.register(authPlugin)

// Swagger/OpenAPI
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Daily Read API',
      description: 'API para o Daily Read - Sua leitura diária de tecnologia',
      version: '0.1.0'
    },
    servers: [{ url: `http://localhost:${env.PORT}/api/v1`, description: 'Development' }],
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'accessToken' },
        refreshToken: { type: 'apiKey', in: 'cookie', name: 'refreshToken' }
      }
    },
    security: [{ cookieAuth: [], refreshToken: [] }]
  },
  transform: jsonSchemaTransform
})
await app.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true }
})

// Error handler
app.setErrorHandler(errorHandler)

// Routes
await app.register(healthRoutes, { prefix: '/api' })
await app.register(authRoutes, { prefix: '/api/v1/auth' })
await app.register(dailyRoutes, { prefix: '/api/v1/daily' })
await app.register(articlesRoutes, { prefix: '/api/v1' })
await app.register(sourcesRoutes, { prefix: '/api/v1' })

// 404 handler
app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({ message: 'Rota não encontrada', code: 'NOT_FOUND', path: request.url })
})

export async function start() {
  try {
    await app.listen({ port: env.PORT, host: env.HOST })
    app.log.info(`🚀 Server running at http://${env.HOST}:${env.PORT}`)
    app.log.info(`📚 Swagger UI at http://${env.HOST}:${env.PORT}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  start()
}
