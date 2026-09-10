import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getDailyRecommendation, getPreviousRecommendation, markArticleOpened, markArticleCompleted, getUserStats } from './service'
import { requireAuth } from '@/lib/auth/plugin'

const dailyResponse = z.object({
  id: z.string(),
  userId: z.string(),
  articleId: z.string(),
  date: z.string().datetime(),
  createdAt: z.string().datetime(),
  reason: z.string(),
  article: z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
    summary: z.string().nullable(),
    readingTimeMinutes: z.number().nullable(),
    publishedAt: z.string().datetime().nullable(),
    collectedAt: z.string().datetime(),
    status: z.string(),
    tags: z.array(z.string()),
    sourceId: z.string(),
    categoryId: z.string().nullable(),
    source: z.object({
      id: z.string(),
      name: z.string(),
      url: z.string()
    }),
    category: z.object({
      id: z.string(),
      name: z.string()
    }).nullable(),
    readingHistory: z.object({
      id: z.string(),
      userId: z.string(),
      articleId: z.string(),
      openedAt: z.string().datetime().nullable(),
      completedAt: z.string().datetime().nullable(),
      rating: z.string().nullable(),
      notes: z.string().nullable()
    }).nullable()
  })
})

const statsResponse = z.object({
  currentStreak: z.number(),
  longestStreak: z.number(),
  articlesThisMonth: z.number(),
  articlesThisYear: z.number(),
  totalReadingTimeMinutes: z.number(),
  averageReadingTimeMinutes: z.number(),
  byCategory: z.array(z.object({
    categoryId: z.string(),
    categoryName: z.string(),
    count: z.number()
  })),
  bySource: z.array(z.object({
    sourceId: z.string(),
    sourceName: z.string(),
    count: z.number()
  })),
  byMonth: z.array(z.object({
    month: z.string(),
    count: z.number()
  }))
})

const openBody = z.object({})
const completeBody = z.object({
  rating: z.enum(['dislike', 'neutral', 'like']),
  notes: z.string().optional()
})

export async function dailyRoutes(app: FastifyInstance) {
  // GET /api/v1/daily - Get today's recommendation
  app.get('/', {
    schema: {
      response: { 200: dailyResponse.nullable() },
      tags: ['Daily'],
      summary: 'Obter leitura recomendada de hoje',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const recommendation = await getDailyRecommendation(request.user!.id)
    if (!recommendation) return null
    return {
      ...recommendation,
      date: recommendation.date.toISOString(),
      createdAt: recommendation.createdAt.toISOString(),
      article: {
        ...recommendation.article,
        publishedAt: recommendation.article.publishedAt?.toISOString() ?? null,
        collectedAt: recommendation.article.collectedAt.toISOString(),
        readingHistory: recommendation.article.readingHistory ? {
          ...recommendation.article.readingHistory,
          openedAt: recommendation.article.readingHistory.openedAt?.toISOString() ?? null,
          completedAt: recommendation.article.readingHistory.completedAt?.toISOString() ?? null
        } : null
      }
    }
  })

  // GET /api/v1/daily/previous?date=YYYY-MM-DD - Get previous day's recommendation
  app.get('/previous', {
    schema: {
      querystring: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      }),
      response: { 200: dailyResponse.nullable() },
      tags: ['Daily'],
      summary: 'Obter leitura de um dia anterior',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const { date } = request.query as { date: string }
    const recommendation = await getPreviousRecommendation(request.user!.id, new Date(date))
    if (!recommendation) return null
    return {
      ...recommendation,
      date: recommendation.date.toISOString(),
      createdAt: recommendation.createdAt.toISOString(),
      article: {
        ...recommendation.article,
        publishedAt: recommendation.article.publishedAt?.toISOString() ?? null,
        collectedAt: recommendation.article.collectedAt.toISOString(),
        readingHistory: recommendation.article.readingHistory ? {
          ...recommendation.article.readingHistory,
          openedAt: recommendation.article.readingHistory.openedAt?.toISOString() ?? null,
          completedAt: recommendation.article.readingHistory.completedAt?.toISOString() ?? null
        } : null
      }
    }
  })

  // POST /api/v1/daily/:id/open - Mark article as opened
  app.post('/:id/open', {
    schema: {
      params: z.object({ id: z.string() }),
      body: openBody,
      response: { 204: z.null() },
      tags: ['Daily'],
      summary: 'Registrar abertura do artigo',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await markArticleOpened(request.user!.id, id)
    return reply.status(204).send()
  })

  // POST /api/v1/daily/:id/complete - Mark article as completed with rating
  app.post('/:id/complete', {
    schema: {
      params: z.object({ id: z.string() }),
      body: completeBody,
      response: { 204: z.null() },
      tags: ['Daily'],
      summary: 'Registrar conclusão e avaliação do artigo',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { rating, notes } = request.body as { rating: 'dislike' | 'neutral' | 'like'; notes?: string }
    await markArticleCompleted(request.user!.id, id, rating, notes)
    return reply.status(204).send()
  })

  // GET /api/v1/daily/stats - Get user reading stats
  app.get('/stats', {
    schema: {
      response: { 200: statsResponse },
      tags: ['Daily'],
      summary: 'Obter estatísticas de leitura do usuário',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request) => {
    return getUserStats(request.user!.id)
  })
}