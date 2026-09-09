import { PrismaClient, Prisma } from '@prisma/client'
import { addDays, startOfDay, endOfDay, format, subDays } from 'date-fns'

const prisma = new PrismaClient()

export interface DailyRecommendationResult {
  id: string
  userId: string
  articleId: string
  date: Date
  createdAt: Date
  article: {
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
}

export async function getDailyRecommendation(userId: string, date: Date = new Date()): Promise<DailyRecommendationResult | null> {
  const dayStart = startOfDay(date)

  // Check if there's already a recommendation for today
  let recommendation = await prisma.dailyRecommendation.findUnique({
    where: {
      userId_date: {
        userId,
        date: dayStart
      }
    },
    include: {
      article: {
        include: {
          source: true,
          category: true
        }
      }
    }
  })

  if (recommendation) {
    // Fetch reading history separately for this user/article
    const readingHistory = await prisma.readingHistory.findFirst({
      where: { userId, articleId: recommendation.articleId }
    })
    return formatRecommendation(recommendation, readingHistory)
  }

  // No recommendation yet - generate one
  const article = await findNextArticleForUser(userId)
  if (!article) {
    return null
  }

  // Create the recommendation
  recommendation = await prisma.dailyRecommendation.create({
    data: {
      userId,
      articleId: article.id,
      date: dayStart
    },
    include: {
      article: {
        include: {
          source: true,
          category: true
        }
      }
    }
  })

  return formatRecommendation(recommendation, null)
}

export async function getPreviousRecommendation(userId: string, date: Date): Promise<DailyRecommendationResult | null> {
  const dayStart = startOfDay(date)

  const recommendation = await prisma.dailyRecommendation.findUnique({
    where: {
      userId_date: {
        userId,
        date: dayStart
      }
    },
    include: {
      article: {
        include: {
          source: true,
          category: true
        }
      }
    }
  })

  if (!recommendation) return null

  const readingHistory = await prisma.readingHistory.findFirst({
    where: { userId, articleId: recommendation.articleId }
  })
  return formatRecommendation(recommendation, readingHistory)
}

async function findNextArticleForUser(userId: string) {
  // Get user's reading history to know which articles they've read
  const readArticleIds = await prisma.readingHistory.findMany({
    where: {
      userId,
      completedAt: { not: null }
    },
    select: { articleId: true }
  })
  const readIds = readArticleIds.map(r => r.articleId)

  // Get articles already recommended to this user
  const recommendedArticleIds = await prisma.dailyRecommendation.findMany({
    where: { userId },
    select: { articleId: true }
  })
  const recommendedIds = recommendedArticleIds.map(r => r.articleId)

  // Exclude read and already recommended articles
  const excludeIds = [...new Set([...readIds, ...recommendedIds])]

  // Get all categories with articles
  const categories = await prisma.category.findMany({
    include: {
      articles: {
        where: {
          status: 'new',
          id: { notIn: excludeIds.length > 0 ? excludeIds : undefined }
        },
        orderBy: { collectedAt: 'asc' },
        take: 50 // Limit per category for performance
      }
    }
  })

  // Simple rotation: pick from categories round-robin based on day of year
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const categoryIndex = dayOfYear % categories.length
  const selectedCategory = categories[categoryIndex]

  if (selectedCategory?.articles.length > 0) {
    return selectedCategory.articles[0]
  }

  // Fallback: any unread article
  return prisma.article.findFirst({
    where: {
      status: 'new',
      id: { notIn: excludeIds.length > 0 ? excludeIds : undefined }
    },
    orderBy: { collectedAt: 'asc' }
  })
}

export async function markArticleOpened(userId: string, articleId: string): Promise<void> {
  await prisma.readingHistory.upsert({
    where: {
      userId_articleId: { userId, articleId }
    },
    update: {
      openedAt: new Date()
    },
    create: {
      userId,
      articleId,
      openedAt: new Date()
    }
  })
}

export async function markArticleCompleted(
  userId: string,
  articleId: string,
  rating: 'dislike' | 'neutral' | 'like',
  notes?: string
): Promise<void> {
  await prisma.readingHistory.upsert({
    where: {
      userId_articleId: { userId, articleId }
    },
    update: {
      completedAt: new Date(),
      rating,
      notes
    },
    create: {
      userId,
      articleId,
      completedAt: new Date(),
      rating,
      notes
    }
  })
}

export async function getUserStats(userId: string) {
  const history = await prisma.readingHistory.findMany({
    where: {
      userId,
      completedAt: { not: null }
    },
    include: {
      article: {
        include: { category: true, source: true }
      }
    }
  })

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisYearStart = new Date(now.getFullYear(), 0, 1)

  const thisMonth = history.filter(h => h.completedAt && h.completedAt >= thisMonthStart).length
  const thisYear = history.filter(h => h.completedAt && h.completedAt >= thisYearStart).length
  const totalReadingTime = history.reduce((acc, h) => acc + (h.article.readingTimeMinutes || 0), 0)

  // Calculate streak
  const completedDates = history
    .filter(h => h.completedAt)
    .map(h => startOfDay(h.completedAt!).getTime())
    .sort((a, b) => b - a)

  let currentStreak = 0
  let longestStreak = 0
  let tempStreak = 0
  let lastDate: number | null = null

  for (const dateMs of completedDates) {
    if (lastDate === null) {
      tempStreak = 1
    } else if (lastDate - dateMs === 86400000) { // 1 day difference
      tempStreak++
    } else if (lastDate - dateMs > 86400000) {
      tempStreak = 1
    }
    lastDate = dateMs
    longestStreak = Math.max(longestStreak, tempStreak)
  }

  // Current streak (from today backwards)
  const todayMs = startOfDay(now).getTime()
  const yesterdayMs = todayMs - 86400000
  if (completedDates.includes(todayMs) || completedDates.includes(yesterdayMs)) {
    currentStreak = tempStreak
  } else {
    currentStreak = 0
  }

  // By category
  const byCategoryMap = new Map<string, { categoryId: string; categoryName: string; count: number }>()
  for (const h of history) {
    if (h.article.category) {
      const key = h.article.category.id
      const existing = byCategoryMap.get(key)
      if (existing) existing.count++
      else byCategoryMap.set(key, { categoryId: key, categoryName: h.article.category.name, count: 1 })
    }
  }

  // By source
  const bySourceMap = new Map<string, { sourceId: string; sourceName: string; count: number }>()
  for (const h of history) {
    const key = h.article.source.id
    const existing = bySourceMap.get(key)
    if (existing) existing.count++
    else bySourceMap.set(key, { sourceId: key, sourceName: h.article.source.name, count: 1 })
  }

  // By month
  const byMonthMap = new Map<string, { month: string; count: number }>()
  for (const h of history) {
    if (h.completedAt) {
      const monthKey = format(h.completedAt, 'yyyy-MM')
      const existing = byMonthMap.get(monthKey)
      if (existing) existing.count++
      else byMonthMap.set(monthKey, { month: monthKey, count: 1 })
    }
  }

  return {
    currentStreak,
    longestStreak,
    articlesThisMonth: thisMonth,
    articlesThisYear: thisYear,
    totalReadingTimeMinutes: totalReadingTime,
    averageReadingTimeMinutes: history.length > 0 ? Math.round(totalReadingTime / history.length) : 0,
    byCategory: Array.from(byCategoryMap.values()),
    bySource: Array.from(bySourceMap.values()),
    byMonth: Array.from(byMonthMap.values()).sort((a, b) => b.month.localeCompare(a.month))
  }
}

function formatRecommendation(rec: any, readingHistory: any = null): DailyRecommendationResult {
  return {
    id: rec.id,
    userId: rec.userId,
    articleId: rec.articleId,
    date: rec.date,
    createdAt: rec.createdAt,
    article: {
      id: rec.article.id,
      title: rec.article.title,
      url: rec.article.url,
      summary: rec.article.summary,
      readingTimeMinutes: rec.article.readingTimeMinutes,
      publishedAt: rec.article.publishedAt,
      collectedAt: rec.article.collectedAt,
      status: rec.article.status,
      tags: rec.article.tags,
      sourceId: rec.article.sourceId,
      categoryId: rec.article.categoryId,
      source: {
        id: rec.article.source.id,
        name: rec.article.source.name,
        url: rec.article.source.url
      },
      category: rec.article.category ? {
        id: rec.article.category.id,
        name: rec.article.category.name
      } : null,
      readingHistory: readingHistory ? {
        id: readingHistory.id,
        userId: readingHistory.userId,
        articleId: readingHistory.articleId,
        openedAt: readingHistory.openedAt,
        completedAt: readingHistory.completedAt,
        rating: readingHistory.rating,
        notes: readingHistory.notes
      } : null
    }
  }
}