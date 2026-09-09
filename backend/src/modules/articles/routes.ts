import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getArticles, getArticleById, updateArticleStatus, getHistory } from './service'
import { requireAuth } from '@/lib/auth/plugin'

const articleResponse = z.object({
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

const paginatedResponse = z.object({
  data: z.array(articleResponse),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number()
  })
})

const articleFiltersQuery = z.object({
  categoryId: z.string().optional(),
  sourceId: z.string().optional(),
  status: z.enum(['new', 'saved', 'read', 'archived']).optional(),
  rating: z.enum(['dislike', 'neutral', 'like']).nullable().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['publishedAt', 'collectedAt', 'readingTimeMinutes']).default('collectedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

const historyFiltersQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.coerce.number().int().optional(),
  categoryId: z.string().optional(),
  sourceId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
})

const updateStatusBody = z.object({
  status: z.enum(['new', 'saved', 'read', 'archived'])
})

export async function articlesRoutes(app: FastifyInstance) {
  // GET /api/v1/articles - List articles with filters
  app.get('/articles', {
    schema: {
      querystring: articleFiltersQuery,
      response: { 200: paginatedResponse },
      tags: ['Articles'],
      summary: 'Listar artigos com filtros',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const result = await getArticles(request.user!.id, request.query as any)
    return {
      data: result.data.map(a => ({
        ...a,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        collectedAt: a.collectedAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        readingHistory: a.readingHistory?.id ? {
          id: a.readingHistory.id,
          userId: a.readingHistory.userId,
          articleId: a.readingHistory.articleId,
          openedAt: a.readingHistory.openedAt?.toISOString() ?? null,
          completedAt: a.readingHistory.completedAt?.toISOString() ?? null,
          rating: a.readingHistory.rating ?? null,
          notes: a.readingHistory.notes ?? null
        } : null
      })),
      meta: result.meta
    }
  })

  // GET /api/v1/articles/:id - Get article detail
  app.get('/articles/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      response: { 200: articleResponse.nullable() },
      tags: ['Articles'],
      summary: 'Obter detalhe do artigo',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const { id } = request.params as { id: string }
    const article = await getArticleById(request.user!.id, id)
    if (!article) return null
    return {
      ...article,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      collectedAt: article.collectedAt.toISOString(),
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      readingHistory: article.readingHistory ? {
        ...article.readingHistory,
        openedAt: article.readingHistory.openedAt?.toISOString() ?? null,
        completedAt: article.readingHistory.completedAt?.toISOString() ?? null
      } : null
    }
  })

  // PATCH /api/v1/articles/:id - Update article status
  app.patch('/articles/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      body: updateStatusBody,
      response: { 200: articleResponse },
      tags: ['Articles'],
      summary: 'Atualizar status do artigo',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: 'new' | 'saved' | 'read' | 'archived' }
    const article = await updateArticleStatus(request.user!.id, id, status)
    if (!article) return null
    return {
      ...article,
      publishedAt: article.publishedAt?.toISOString() ?? null,
      collectedAt: article.collectedAt.toISOString(),
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      readingHistory: article.readingHistory ? {
        ...article.readingHistory,
        openedAt: article.readingHistory.openedAt?.toISOString() ?? null,
        completedAt: article.readingHistory.completedAt?.toISOString() ?? null
      } : null
    }
  })

  // GET /api/v1/history - Get reading history with filters
  app.get('/history', {
    schema: {
      querystring: historyFiltersQuery,
      response: { 200: paginatedResponse },
      tags: ['History'],
      summary: 'Listar histórico de leituras concluídas',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const result = await getHistory(request.user!.id, request.query as any)
    return {
      data: result.data.map(a => ({
        ...a,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        collectedAt: a.collectedAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        readingHistory: a.readingHistory?.id ? {
          id: a.readingHistory.id,
          userId: a.readingHistory.userId,
          articleId: a.readingHistory.articleId,
          openedAt: a.readingHistory.openedAt?.toISOString() ?? null,
          completedAt: a.readingHistory.completedAt?.toISOString() ?? null,
          rating: a.readingHistory.rating ?? null,
          notes: a.readingHistory.notes ?? null
        } : null
      })),
      meta: result.meta
    }
  })
}