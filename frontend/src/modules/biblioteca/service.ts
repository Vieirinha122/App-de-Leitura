import { api } from '@/lib/api/client'
import type { Article, ArticleFilters, PaginatedResponse } from '@/types/domain'

export async function fetchArticles(filters: ArticleFilters = {}): Promise<PaginatedResponse<Article>> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const { data } = await api.get<PaginatedResponse<Article>>(`/api/v1/articles?${params.toString()}`)
  return data
}

export async function updateArticleStatus(articleId: string, status: Article['status']): Promise<Article> {
  const { data } = await api.patch<Article>(`/api/v1/articles/${articleId}`, { status })
  return data
}