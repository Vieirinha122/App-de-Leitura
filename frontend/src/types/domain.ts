// Domain types matching the Prisma schema

export type Category = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export type Source = {
  id: string
  name: string
  url: string
  feedUrl: string | null
  type: 'rss' | 'newsletter' | 'manual' | 'api'
  enabled: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    articles: number
  }
}

export type Article = {
  id: string
  title: string
  url: string
  summary: string | null
  readingTimeMinutes: number | null
  publishedAt: string | null
  collectedAt: string
  status: 'new' | 'saved' | 'read' | 'archived'
  tags: string[]
  sourceId: string
  categoryId: string | null
  createdAt: string
  updatedAt: string

  // Relations
  source?: Source
  category?: Category | null
  readingHistory?: ReadingHistory | null
}

export type ReadingHistory = {
  id: string
  userId: string
  articleId: string
  openedAt: string | null
  completedAt: string | null
  rating: 'dislike' | 'neutral' | 'like' | null
  notes: string | null
  createdAt: string
  updatedAt: string

  article?: Article
}

export type DailyRecommendation = {
  id: string
  userId: string
  articleId: string
  date: string // YYYY-MM-DD
  createdAt: string

  article?: Article
}

// API Response types
export type PaginatedResponse<T> = {
  data: T[]
  meta: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

export type ArticleFilters = {
  categoryId?: string
  sourceId?: string
  status?: Article['status']
  rating?: ReadingHistory['rating']
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'publishedAt' | 'collectedAt' | 'readingTimeMinutes'
  sortOrder?: 'asc' | 'desc'
}

export type HistoryFilters = {
  month?: string // YYYY-MM
  year?: number
  categoryId?: string
  sourceId?: string
  page?: number
  pageSize?: number
}

export type Stats = {
  currentStreak: number
  longestStreak: number
  articlesThisMonth: number
  articlesThisYear: number
  totalReadingTimeMinutes: number
  averageReadingTimeMinutes: number
  byCategory: { categoryId: string; categoryName: string; count: number }[]
  bySource: { sourceId: string; sourceName: string; count: number }[]
  byMonth: { month: string; count: number }[]
}

// Form types
export type CreateSourceInput = {
  name: string
  url: string
  feedUrl?: string
  type: 'rss' | 'newsletter' | 'manual' | 'api'
}

export type UpdateSourceInput = Partial<CreateSourceInput> & { enabled?: boolean }

export type CreateArticleInput = {
  title: string
  url: string
  summary?: string
  readingTimeMinutes?: number
  publishedAt?: string
  sourceId: string
  categoryId?: string
  tags?: string[]
}

export type UpdateArticleInput = Partial<CreateArticleInput> & { status?: Article['status'] }

export type UpdateReadingHistoryInput = {
  openedAt?: string
  completedAt?: string
  rating?: 'dislike' | 'neutral' | 'like'
  notes?: string
}