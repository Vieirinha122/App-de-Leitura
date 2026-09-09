import { api } from '@/lib/api/client'
import type { Article, HistoryFilters, PaginatedResponse } from '@/types/domain'

export async function fetchHistory(filters: HistoryFilters = {}): Promise<PaginatedResponse<Article>> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const { data } = await api.get<PaginatedResponse<Article>>(`/api/v1/history?${params.toString()}`)
  return data
}

export interface Stats {
  currentStreak: number
  articlesThisMonth: number
  totalReadingTimeMinutes: number
}

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>('/api/v1/daily/stats')
  return data
}