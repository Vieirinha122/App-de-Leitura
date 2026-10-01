import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Check, ChevronLeft, ChevronRight, Grid2X2, List, Search, X } from 'lucide-react'
import type { Article, ArticleFilters } from '@/types/domain'
import type { Topic } from '@/modules/onboarding/service'
import { fetchArticles, updateArticleStatus } from './service'
import { useUIStore } from '@/lib/stores/uiStore'
import { api } from '@/lib/api/client'

type Category = { id: string; name: string }

async function fetchCategories(): Promise<Category[]> {
  const { data } = await api.get<Category[]>('/api/v1/categories')
  return data
}

async function fetchTopics(): Promise<Topic[]> {
  const { data } = await api.get<{ topics: Topic[] }>('/api/v1/topics')
  return data.topics
}

async function fetchMyTopics(): Promise<Topic[]> {
  const { data } = await api.get<{ topics: Topic[] }>('/api/v1/topics/my')
  return data.topics
}

async function updateMyTopics(topicIds: string[]) {
  const { data } = await api.put('/api/v1/topics/my', { topicIds })
  return data
}

function ArticleCard({ article, onStatusChange }: { article: Article; onStatusChange: (article: Article, status: Article['status']) => void }) {
  const statusLabel = { new: 'Novo', saved: 'Salvo', read: 'Lido', archived: 'Arquivado' }[article.status]

  return (
    <article className="card card-hover flex flex-col gap-4 p-5">
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
  const [filters, setFilters] = useState<ArticleFilters>({ page: 1, pageSize: 10 })
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [topicsInitialized, setTopicsInitialized] = useState(false)
  const [isTopicsOpen, setIsTopicsOpen] = useState(false)
  const articlesQuery = useQuery({ queryKey: ['articles', filters], queryFn: () => fetchArticles(filters) })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
  const topicsQuery = useQuery({ queryKey: ['topics'], queryFn: fetchTopics })
  const myTopicsQuery = useQuery({ queryKey: ['my-topics'], queryFn: fetchMyTopics })
  const topicsMutation = useMutation({
    mutationFn: updateMyTopics,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-topics'] })
      queryClient.invalidateQueries({ queryKey: ['daily'] })
      addToast({ type: 'success', title: 'Tópicos atualizados', message: 'Estamos preparando recomendações e fontes para você.' })
    },
    onError: () => addToast({ type: 'error', title: 'Erro', message: 'Não foi possível atualizar seus tópicos' })
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

  useEffect(() => {
    if (!topicsInitialized && myTopicsQuery.data) {
      setSelectedTopics(new Set(myTopicsQuery.data.map((topic) => topic.id)))
      setTopicsInitialized(true)
    }
  }, [myTopicsQuery.data, topicsInitialized])

  function toggleTopic(topicId: string) {
    setSelectedTopics((current) => {
      const next = new Set(current)
      if (next.has(topicId)) next.delete(topicId)
      else if (next.size < 10) next.add(topicId)
      return next
    })
  }

  return (
    <div className="container-full flex min-h-[calc(100dvh-4rem)] flex-col py-5 sm:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-overline text-amber-600 font-semibold">Acervo</p>
          <h1 className="font-display text-display-lg text-ink-900">Biblioteca</h1>
          <p className="text-body text-ink-500">Tudo que entrou no seu radar de leitura.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setIsTopicsOpen(true)}>Personalizar tópicos</button>
          <div className="hidden gap-1 rounded-lg border border-ink-200 bg-white p-1 md:flex">
          <button className={`btn-ghost p-2 ${view === 'grid' ? 'bg-ink-100 text-ink-900' : ''}`} onClick={() => setView('grid')} aria-label="Visualização em grade"><Grid2X2 className="h-4 w-4" /></button>
          <button className={`btn-ghost p-2 ${view === 'list' ? 'bg-ink-100 text-ink-900' : ''}`} onClick={() => setView('list')} aria-label="Visualização em lista"><List className="h-4 w-4" /></button>
          </div>
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
        <select className="input sm:max-w-52" value={filters.categoryId ?? ''} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value || undefined, page: 1 })}>
          <option value="">Todas as categorias</option>
          {(categoriesQuery.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>

      {isTopicsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/30 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="topics-title">
          <section className="card flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden p-4 sm:p-6" aria-labelledby="topics-title">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div>
            <h2 id="topics-title" className="font-display text-heading-sm text-ink-900">Seus tópicos</h2>
            <p className="mt-1 max-w-2xl text-body-sm text-ink-500">Personalize suas próximas recomendações e as fontes que o Daily Read procura para você.</p>
          </div>
          <div className="flex items-center gap-2"><span className="badge-neutral w-fit shrink-0">{selectedTopics.size}/10 selecionados</span><button type="button" className="btn-ghost p-2" onClick={() => setIsTopicsOpen(false)} aria-label="Fechar tópicos"><X className="h-4 w-4" /></button></div>
        </div>
        <div className="grid flex-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {(topicsQuery.data ?? []).map((topic) => {
            const isSelected = selectedTopics.has(topic.id)
            const disabled = !isSelected && selectedTopics.size >= 10
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                disabled={disabled || topicsMutation.isPending}
                className={`flex min-h-28 w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${isSelected ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-white hover:border-ink-300'} ${disabled || topicsMutation.isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                aria-pressed={isSelected}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${isSelected ? 'border-brand-500 bg-brand-500 text-black' : 'border-ink-300 bg-white'}`}>
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0"><span className="block font-medium text-ink-900">{topic.name}</span><span className="mt-1 block text-body-sm text-ink-500 line-clamp-2">{topic.description}</span></span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-ink-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-ink-500">Escolha entre 1 e 10 tópicos. Você pode alterar isso quando quiser.</p>
          <button className="btn-primary shrink-0" disabled={selectedTopics.size === 0 || topicsMutation.isPending} onClick={() => topicsMutation.mutate([...selectedTopics], { onSuccess: () => setIsTopicsOpen(false) })}>{topicsMutation.isPending ? 'Salvando...' : 'Salvar tópicos'}</button>
        </div>
          </section>
        </div>
      )}

      {articlesQuery.isLoading ? <p className="flex-1 py-12 text-center text-ink-500">Carregando biblioteca...</p> : articles.length === 0 ? <p className="flex-1 py-12 text-center text-ink-500">Nenhum artigo encontrado.</p> : (
        <div className={view === 'grid' ? 'grid flex-1 content-start gap-4 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-1 flex-col gap-3'}>
          {articles.map((article) => <ArticleCard key={article.id} article={article} onStatusChange={(item, status) => mutation.mutate({ id: item.id, status })} />)}
        </div>
      )}
      {meta && <footer className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 text-body-sm text-ink-500"><span>Mostrando {articles.length === 0 ? 0 : ((meta.page - 1) * meta.pageSize) + 1}–{Math.min(meta.page * meta.pageSize, meta.total)} de {meta.total}</span><div className="flex items-center gap-2"><button className="btn-ghost !min-h-11 !min-w-11 !p-0" disabled={meta.page <= 1} onClick={() => setFilters({ ...filters, page: Math.max(1, meta.page - 1) })} aria-label="Página anterior"><ChevronLeft className="h-5 w-5" /></button><span className="text-caption">Página {meta.page} de {meta.totalPages}</span><button className="btn-ghost !min-h-11 !min-w-11 !p-0" disabled={meta.page >= meta.totalPages} onClick={() => setFilters({ ...filters, page: Math.min(meta.totalPages, meta.page + 1) })} aria-label="Próxima página"><ChevronRight className="h-5 w-5" /></button></div></footer>}
    </div>
  )
}
