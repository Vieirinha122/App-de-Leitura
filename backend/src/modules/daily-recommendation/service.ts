import { PrismaClient, Prisma } from '@prisma/client'
import { addDays, startOfDay, endOfDay, format, subDays } from 'date-fns'

const prisma = new PrismaClient()

export interface DailyRecommendationResult {
  id: string
  userId: string
  articleId: string
  date: Date
  createdAt: Date
  reason: string
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
    return formatRecommendation(recommendation, readingHistory, 'Selecionado entre os artigos ainda não lidos')
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

  return formatRecommendation(recommendation, null, 'Selecionado com base no histórico e na rotação de fontes')
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
  return formatRecommendation(recommendation, readingHistory, 'Leitura recomendada em um dia anterior')
}

async function findNextArticleForUser(userId: string) {
  const [readHistory, recommendations, lastRecommendation, preferences] = await Promise.all([
    prisma.readingHistory.findMany({
      where: { userId, completedAt: { not: null } },
      select: { articleId: true, rating: true, article: { select: { sourceId: true, categoryId: true } } }
    }),
    prisma.dailyRecommendation.findMany({
      where: { userId },
      select: { articleId: true }
    }),
    prisma.dailyRecommendation.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
      include: { article: { select: { sourceId: true } } }
    }),
    prisma.userPreference.findMany({ where: { userId } })
  ])

  const excludedIds = [...new Set([
    ...readHistory.map((item) => item.articleId),
    ...recommendations.map((item) => item.articleId)
  ])]

  const blockedSources = new Set(preferences.filter((item) => item.kind === 'source' && item.blocked).map((item) => item.targetId))
  const blockedCategories = new Set(preferences.filter((item) => item.kind === 'category' && item.blocked).map((item) => item.targetId))

  const candidates = await prisma.article.findMany({
    where: {
      status: 'new',
      id: { notIn: excludedIds.length > 0 ? excludedIds : undefined },
      sourceId: { notIn: [...blockedSources] },
      categoryId: { notIn: [...blockedCategories] }
    },
    include: { source: true, category: true },
    orderBy: { collectedAt: 'asc' },
    take: 100
  })

  if (candidates.length === 0) {
    return prisma.article.findFirst({
      where: { status: 'new' },
      include: { source: true, category: true },
      orderBy: { collectedAt: 'asc' }
    })
  }

  const sourceWeights = new Map<string, number>()
  const categoryWeights = new Map<string, number>()
  for (const preference of preferences) {
    if (preference.kind === 'source') sourceWeights.set(preference.targetId, preference.weight)
    if (preference.kind === 'category') categoryWeights.set(preference.targetId, preference.weight)
  }
  for (const item of readHistory) {
    const weight = item.rating === 'like' ? 2 : item.rating === 'dislike' ? -3 : 0
    if (weight === 0) continue
    sourceWeights.set(item.article.sourceId, (sourceWeights.get(item.article.sourceId) ?? 0) + weight)
    if (item.article.categoryId) {
      categoryWeights.set(item.article.categoryId, (categoryWeights.get(item.article.categoryId) ?? 0) + weight)
    }
  }

  const sourceWasUsedYesterday = lastRecommendation?.article.sourceId
  const isWeekday = [1, 2, 3, 4, 5].includes(new Date().getDay())
  const scored = candidates.map((article, index) => {
    // Nos dias úteis, favorece leituras curtas para reduzir o atrito do ritual diário.
    const readingTimeBonus = isWeekday && article.readingTimeMinutes
      ? Math.max(0, 10 - article.readingTimeMinutes) / 2
      : 0

    return {
      article,
      score:
        (sourceWeights.get(article.sourceId) ?? 0) +
        (article.categoryId ? categoryWeights.get(article.categoryId) ?? 0 : 0) +
        readingTimeBonus +
        (article.sourceId === sourceWasUsedYesterday ? -5 : 0) -
        index * 0.01
    }
  })

  const alternatives = sourceWasUsedYesterday
    ? scored.filter((item) => item.article.sourceId !== sourceWasUsedYesterday)
    : scored

  return (alternatives.length > 0 ? alternatives : scored)
    .sort((left, right) => right.score - left.score)[0].article
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
  const completedAt = new Date()

  await prisma.$transaction([
    prisma.readingHistory.upsert({
      where: {
        userId_articleId: { userId, articleId }
      },
      update: {
        completedAt,
        rating,
        notes
      },
      create: {
        userId,
        articleId,
        completedAt,
        rating,
        notes
      }
    }),
    // A conclusão é uma transição de domínio: o artigo fica disponível como "lido" na Biblioteca.
    prisma.article.update({
      where: { id: articleId },
      data: { status: 'read' }
    })
  ])
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

function formatRecommendation(rec: any, readingHistory: any = null, reason: string): DailyRecommendationResult {
  return {
    id: rec.id,
    userId: rec.userId,
    articleId: rec.articleId,
    date: rec.date,
    createdAt: rec.createdAt,
    reason,
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