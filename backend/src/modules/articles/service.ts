import { PrismaClient, Prisma } from '@prisma/client'
import { format } from 'date-fns'

const prisma = new PrismaClient()

export interface ArticleFilters {
  categoryId?: string
  sourceId?: string
  status?: 'new' | 'saved' | 'read' | 'archived'
  rating?: 'dislike' | 'neutral' | 'like' | null
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'publishedAt' | 'collectedAt' | 'readingTimeMinutes'
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedArticles {
  data: ArticleWithRelations[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export interface ArticleWithRelations {
  id: string
  title: string
  url: string
  summary: string | null
  readingTimeMinutes: number | null
  publishedAt: Date | null
  collectedAt: Date
  status: string
  tags: string[]
  sourceId: string
  categoryId: string | null
  createdAt: Date
  updatedAt: Date
  source: {
    id: string
    name: string
    url: string
  }
  category: {
    id: string
    name: string
  } | null
  readingHistory: {
    id: string
    userId: string
    articleId: string
    openedAt: Date | null
    completedAt: Date | null
    rating: string | null
    notes: string | null
  } | null
}

export async function getArticles(userId: string, filters: ArticleFilters = {}): Promise<PaginatedArticles> {
  const {
    categoryId,
    sourceId,
    status,
    rating,
    search,
    page = 1,
    pageSize = 20,
    sortBy = 'collectedAt',
    sortOrder = 'desc'
  } = filters

  // Build where clause for articles
  const where: Prisma.ArticleWhereInput = {}

  if (categoryId) where.categoryId = categoryId
  if (sourceId) where.sourceId = sourceId
  if (status) where.status = status
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } }
    ]
  }

  // Handle rating filter by querying ReadingHistory first
  let articleIdsWithRating: string[] | undefined
  if (rating !== undefined) {
    const historyWhere: Prisma.ReadingHistoryWhereInput = {
      userId,
      ...(rating !== null ? { rating } : { rating: { not: null } })
    }
    const history = await prisma.readingHistory.findMany({
      where: historyWhere,
      select: { articleId: true }
    })
    articleIdsWithRating = history.map(h => h.articleId)
    
    if (rating === null) {
      // Articles WITHOUT rating for this user
      where.id = { notIn: articleIdsWithRating.length > 0 ? articleIdsWithRating : undefined }
    } else {
      // Articles WITH specific rating
      where.id = { in: articleIdsWithRating }
    }
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        source: true,
        category: true,
        history: {
          where: { userId },
          take: 1
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.article.count({ where })
  ])

  return {
    data: articles.map(formatArticle),
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
}

export async function getArticleById(userId: string, articleId: string): Promise<ArticleWithRelations | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      source: true,
      category: true,
      history: {
        where: { userId },
        take: 1
      }
    }
  })
  if (!article) return null
  return formatArticle(article)
}

export async function updateArticleStatus(
  userId: string,
  articleId: string,
  status: 'new' | 'saved' | 'read' | 'archived'
): Promise<ArticleWithRelations | null> {
  const article = await prisma.$transaction(async (tx) => {
    if (status === 'read') {
      await tx.readingHistory.upsert({
        where: { userId_articleId: { userId, articleId } },
        update: { completedAt: new Date() },
        create: { userId, articleId, completedAt: new Date() }
      })
    }

    return tx.article.update({
      where: { id: articleId },
      data: { status },
      include: {
        source: true,
        category: true,
        history: {
          where: { userId },
          take: 1
        }
      }
    })
  })
  return formatArticle(article)
}

export async function getHistory(
  userId: string,
  filters: {
    month?: string
    year?: number
    categoryId?: string
    sourceId?: string
    page?: number
    pageSize?: number
  } = {}
): Promise<PaginatedArticles> {
  const { month, year, categoryId, sourceId, page = 1, pageSize = 20 } = filters

  const where: Prisma.ReadingHistoryWhereInput = {
    userId,
    completedAt: { not: null }
  }

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 1)
    where.completedAt = { gte: start, lt: end }
  } else if (year) {
    const start = new Date(year, 0, 1)
    const end = new Date(year + 1, 0, 1)
    where.completedAt = { gte: start, lt: end }
  }

  if (categoryId) where.article = { categoryId }
  if (sourceId) where.article = { ...where.article, sourceId } as any

  const [history, total] = await Promise.all([
    prisma.readingHistory.findMany({
      where,
      include: {
        article: {
          include: { source: true, category: true }
        }
      },
      orderBy: { completedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.readingHistory.count({ where })
  ])

  return {
    data: history.map(h => formatArticle(h.article, h)),
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
}

function formatArticle(article: any, readingHistory?: any): ArticleWithRelations {
  const rh = readingHistory || article.history?.[0]
  return {
    id: article.id,
    title: article.title,
    url: article.url,
    summary: article.summary,
    readingTimeMinutes: article.readingTimeMinutes,
    publishedAt: article.publishedAt,
    collectedAt: article.collectedAt,
    status: article.status,
    tags: article.tags,
    sourceId: article.sourceId,
    categoryId: article.categoryId,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    source: article.source ? { id: article.source.id, name: article.source.name, url: article.source.url } : null as any,
    category: article.category ? { id: article.category.id, name: article.category.name } : null,
    readingHistory: rh ? {
      id: rh.id,
      userId: rh.userId,
      articleId: rh.articleId,
      openedAt: rh.openedAt ?? null,
      completedAt: rh.completedAt ?? null,
      rating: rh.rating ?? null,
      notes: rh.notes ?? null
    } : null
  }
}