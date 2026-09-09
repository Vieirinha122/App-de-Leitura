import { api } from '@/lib/api/client'
import type { DailyRecommendation } from '@/types/domain'

export async function fetchDailyRecommendation(): Promise<DailyRecommendation | null> {
  const { data } = await api.get<DailyRecommendation | null>('/api/v1/daily')
  return data
}

export async function fetchPreviousDaily(date: string): Promise<DailyRecommendation | null> {
  const { data } = await api.get<DailyRecommendation | null>(`/api/v1/daily/previous?date=${date}`)
  return data
}

export async function openArticle(articleId: string): Promise<void> {
  await api.post<void>(`/api/v1/daily/${articleId}/open`, {})
}

export async function completeArticle(
  articleId: string,
  rating: 'dislike' | 'neutral' | 'like',
  notes?: string
): Promise<void> {
  await api.post<void>(`/api/v1/daily/${articleId}/complete`, { rating, notes })
}

export interface Stats {
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

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>('/api/v1/daily/stats')
  return data
}