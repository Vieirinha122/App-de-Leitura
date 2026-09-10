import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Check, Grid2X2, List, Search } from 'lucide-react'
import type { Article, ArticleFilters } from '@/types/domain'
import { fetchArticles, updateArticleStatus } from './service'
import { useUIStore } from '@/lib/stores/uiStore'
import { api } from '@/lib/api/client'

type Category = { id: string; name: string }
type Preference = { kind: 'source' | 'category'; targetId: string; blocked: boolean; weight: number }

async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/api/v1/categories')
  return data
}

async function savePreference(preference: Preference): Promise<Preference> {
  const { data } = await api.put<Preference>('/api/v1/preferences', preference)
  return data
}

function ArticleCard({ article, onStatusChange }: { article: Article; onStatusChange: (article: Article, status: Article['status']) => void }) {
  const statusLabel = { new: 'Novo', saved: 'Salvo', read: 'Lido', archived: 'Arquivado' }[article.status]
  return (
    <article className="card card-hover p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="badge-sage">{article.category?.name ?? 'Sem categoria'}</span>
        <span className="badge-neutral">{statusLabel}</span>
      </div>
      <div>
        <h2 className="font-display text-heading-md text-ink-900 line-clamp-2">{article.title}</h2>
        <p className="mt-2 text-body-sm text-ink-500 line-clamp-3">{article.summary ?? 'Sem resumo disponível.'}</p>
      </div>
      <div className="mt-auto flex items-center justify-between text-caption text-ink-500">
        <span>{article.source?.name ?? 'Fonte desconhecida'}</span>
        <span>{article.readingTimeMinutes ? `${article.readingTimeMinutes} min` : '—'}</span>
      </div>
      <div className="flex gap-2 border-t border-ink-100 pt-3">
        <a href={article.url} target="_blank" rel="noreferrer" className="btn-primary flex-1 text-body-sm">Ler</a>
        <button className="btn-ghost" onClick={() => onStatusChange(article, article.status === 'saved' ? 'new' : 'saved')} aria-label="Salvar artigo">
          <Bookmark className={`h-4 w-4 ${article.status === 'saved' ? 'fill-current' : ''}`} />
        </button>
        <button className="btn-ghost" onClick={() => onStatusChange(article, 'read')} aria-label="Marcar como lido">
          <Check className="h-4 w-4" />
        </button>
      </div>
    </article>
  )
}

export default function Biblioteca() {
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<ArticleFilters>({ page: 1, pageSize: 20 })
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const articlesQuery = useQuery({ queryKey: ['articles', filters], queryFn: () => fetchArticles(filters) })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const preferencesQuery = useQuery({ queryKey: ['preferences'], queryFn: async () => (await api.get<Preference[]>('/api/v1/preferences')).data })
  const preferenceMutation = useMutation({
    mutationFn: savePreference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      queryClient.invalidateQueries({ queryKey: ['daily'] })
      addToast({ type: 'success', title: 'Preferência atualizada' })
    },
    onError: () => addToast({ type: 'error', title: 'Erro', message: 'Não foi possível atualizar a preferência' })
  })
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Article['status'] }) => updateArticleStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      queryClient.invalidateQueries({ queryKey: ['daily'] })
      addToast({ type: 'success', title: 'Status atualizado' })
    },
    onError: () => addToast({ type: 'error', title: 'Erro', message: 'Não foi possível atualizar o artigo' })
  })

  const articles = articlesQuery.data?.data ?? []
  const meta = articlesQuery.data?.meta

  return (
    <div className="container-full py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-overline text-amber-600 font-semibold">Acervo</p>
          <h1 className="font-display text-display-lg text-ink-900">Biblioteca</h1>
          <p className="text-body text-ink-500">Tudo que entrou no seu radar de leitura.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-ink-200 bg-white p-1">
          <button className={`btn-ghost p-2 ${view === 'grid' ? 'bg-ink-100 text-ink-900' : ''}`} onClick={() => setView('grid')} aria-label="Visualização em grade"><Grid2X2 className="h-4 w-4" /></button>
          <button className={`btn-ghost p-2 ${view === 'list' ? 'bg-ink-100 text-ink-900' : ''}`} onClick={() => setView('list')} aria-label="Visualização em lista"><List className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-ink-200 bg-white p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="input pl-10" placeholder="Buscar por título ou resumo" value={filters.search ?? ''} onChange={(event) => setFilters({ ...filters, search: event.target.value || undefined, page: 1 })} />
        </label>
        <select className="input sm:max-w-48" value={filters.status ?? ''} onChange={(event) => setFilters({ ...filters, status: (event.target.value || undefined) as ArticleFilters['status'], page: 1 })}>
          <option value="">Todos os status</option>
          <option value="new">Novos</option>
          <option value="saved">Salvos</option>
          <option value="read">Lidos</option>
          <option value="archived">Arquivados</option>
        </select>
      </div>

      <div className="mb-6 rounded-xl border border-ink-200 bg-white p-4">
        <p className="mb-3 text-body-sm font-medium text-ink-700">Preferências por categoria</p>
        <div className="flex flex-wrap gap-2">
          {(categoriesQuery.data ?? []).map((category) => {
            const blocked = preferencesQuery.data?.some((item) => item.kind === 'category' && item.targetId === category.id && item.blocked) ?? false
            return (
              <button
                key={category.id}
                className={blocked ? 'badge-error cursor-pointer' : 'badge-neutral cursor-pointer hover:bg-ink-200'}
                onClick={() => preferenceMutation.mutate({ kind: 'category', targetId: category.id, blocked: !blocked, weight: 0 })}
                disabled={preferenceMutation.isPending}
              >
                {blocked ? 'Bloqueada: ' : ''}{category.name}
              </button>
            )
          })}
        </div>
      </div>

      {articlesQuery.isLoading ? <p className="py-12 text-center text-ink-500">Carregando biblioteca...</p> : articles.length === 0 ? <p className="py-12 text-center text-ink-500">Nenhum artigo encontrado.</p> : (
        <div className={view === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3'}>
          {articles.map((article) => <ArticleCard key={article.id} article={article} onStatusChange={(item, status) => mutation.mutate({ id: item.id, status })} />)}
        </div>
      )}
      {meta && meta.totalPages > 1 && <div className="mt-6 flex items-center justify-between text-body-sm text-ink-500"><span>{meta.total} artigos</span><button className="btn-secondary" disabled={(filters.page ?? 1) >= meta.totalPages} onClick={() => setFilters({ ...filters, page: (filters.page ?? 1) + 1 })}>Próxima página</button></div>}
    </div>
  )
}