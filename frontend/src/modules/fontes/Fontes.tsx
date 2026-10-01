import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CircleOff, Edit3, Plus, RefreshCw, Rss, Search, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useUIStore } from '@/lib/stores/uiStore'
import type { Source } from '@/types/domain'

type SourceForm = {
  name: string
  url: string
  feedUrl: string
  type: Source['type']
  enabled: boolean
}

const emptyForm: SourceForm = { name: '', url: '', feedUrl: '', type: 'rss', enabled: true }

// Busca as fontes cadastradas para preencher a tabela de curadoria.
async function fetchSources(): Promise<Source[]> {
  const { data } = await api.get<Source[]>('/api/v1/sources')
  return data
}

type Preference = { kind: 'source' | 'category'; targetId: string; blocked: boolean; weight: number }
type DiscoveredFeed = { url: string; title: string; type: 'rss' | 'atom' }
type SuggestedSource = { name: string; url: string; feedUrl: string; type: 'rss'; language: 'pt-BR' | 'pt-PT'; topic: string }

// Busca bloqueios e pesos personalizados usados pelo recomendador.
async function fetchPreferences(): Promise<Preference[]> {
  const { data } = await api.get<Preference[]>('/api/v1/preferences')
  return data
}

// Salva uma preferência de fonte ou categoria no backend.
async function savePreference(preference: Preference): Promise<Preference> {
  const { data } = await api.put<Preference>('/api/v1/preferences', preference)
  return data
}

// Descobre feeds RSS/Atom declarados pelo site informado pelo usuário.
// Busca sugestões do catálogo interno que ainda não foram cadastradas.
async function fetchSuggestions(query = '', topic = ''): Promise<SuggestedSource[]> {
  const params = new URLSearchParams()
  if (query) params.set('query', query)
  if (topic) params.set('topic', topic)
  const { data } = await api.get<SuggestedSource[]>(`/api/v1/sources/suggestions?${params.toString()}`)
  return data
}

async function discoverFeeds(url: string): Promise<DiscoveredFeed[]> {
  const { data } = await api.post<{ feeds: DiscoveredFeed[] }>('/api/v1/sources/discover', { url })
  return data.feeds
}

// Cria uma fonte nova ou atualiza uma fonte existente.
async function saveSource(form: SourceForm, id?: string): Promise<Source> {
  const payload = { ...form, feedUrl: form.feedUrl || undefined }
  const { data } = id
    ? await api.patch<Source>(`/api/v1/sources/${id}`, payload)
    : await api.post<Source>('/api/v1/sources', payload)
  return data
}

export default function Fontes() {
  const queryClient = useQueryClient()
  const { addToast } = useUIStore()
  const [form, setForm] = useState<SourceForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [discoverUrl, setDiscoverUrl] = useState('')
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([])
  const [selectedFeed, setSelectedFeed] = useState<DiscoveredFeed | null>(null)
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null)
  const [suggestionQuery, setSuggestionQuery] = useState('')
  const [suggestionTopic, setSuggestionTopic] = useState('')
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourceStatus, setSourceStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [sourcesPerPage, setSourcesPerPage] = useState(4)
  const sourcesQuery = useQuery({ queryKey: ['sources'], queryFn: fetchSources })
  const preferencesQuery = useQuery({ queryKey: ['preferences'], queryFn: fetchPreferences })
  const suggestionsQuery = useQuery({ queryKey: ['source-suggestions', suggestionQuery, suggestionTopic], queryFn: () => fetchSuggestions(suggestionQuery, suggestionTopic) })
  // Atualiza bloqueios e pesos e invalida a recomendação atual.
  // Cadastra uma fonte sugerida e deixa a sincronização automática cuidar dos artigos.
  const addSuggestionMutation = useMutation({
    mutationFn: (source: SuggestedSource) => saveSource({ name: source.name, url: source.url, feedUrl: source.feedUrl, type: source.type, enabled: true }),
    onSuccess: (source) => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: ['source-suggestions'] })
      addToast({ type: 'success', title: 'Fonte adicionada', message: `${source.name} está pronta para sincronizar.` })
    },
    onError: () => addToast({ type: 'error', title: 'Erro', message: 'Não foi possível adicionar a fonte sugerida' })
  })

  const preferenceMutation = useMutation({
    mutationFn: savePreference,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      queryClient.invalidateQueries({ queryKey: ['daily'] })
      addToast({ type: 'success', title: 'Preferência atualizada' })
    },
    onError: () => addToast({ type: 'error', title: 'Erro', message: 'Não foi possível atualizar a preferência' })
  })

  // Controla a descoberta guiada de feeds a partir de uma URL de portal.
  const discoverMutation = useMutation({
    mutationFn: () => discoverFeeds(discoverUrl),
    onSuccess: (feeds) => {
      setDiscoveredFeeds(feeds)
      setSelectedFeed(feeds[0] ?? null)
      if (feeds.length === 0) addToast({ type: 'warning', title: 'Nenhum feed encontrado', message: 'Tente colar a URL RSS manualmente.' })
    },
    onError: (error) => addToast({ type: 'error', title: 'Não foi possível encontrar feeds', message: error instanceof Error ? error.message : 'Verifique a URL' })
  })

  // Salva a fonte e inicia o primeiro sync quando existe um feed RSS.
  const saveMutation = useMutation({
    mutationFn: () => saveSource(form, editingId),
    onSuccess: async (source) => {
      await queryClient.cancelQueries({ queryKey: ['sources'] })
      queryClient.setQueryData<Source[]>(['sources'], (current = []) => {
        const existingIndex = current.findIndex((item) => item.id === source.id)
        if (existingIndex < 0) return [...current, source].sort((left, right) => left.name.localeCompare(right.name))
        const next = [...current]
        next[existingIndex] = source
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      setForm(emptyForm)
      setEditingId(undefined)
      setIsFormOpen(false)
      setDiscoverUrl('')
      setDiscoveredFeeds([])
      setSelectedFeed(null)

      if (!editingId && source.feedUrl) {
        setSyncingSourceId(source.id)
        addToast({ type: 'info', title: 'Fonte criada', message: 'Sincronizando artigos…' })
        try {
          const { data } = await api.post<{ message: string }>(`/api/v1/sources/${source.id}/sync`, {})
          queryClient.invalidateQueries({ queryKey: ['sources'] })
          queryClient.invalidateQueries({ queryKey: ['articles'] })
          addToast({ type: 'success', title: 'Sincronização concluída', message: data.message })
        } catch (error) {
          addToast({ type: 'error', title: 'Fonte criada, mas o sync falhou', message: error instanceof Error ? error.message : 'Sincronize manualmente pela tabela' })
        } finally {
          setSyncingSourceId(null)
        }
      } else {
        addToast({ type: 'success', title: editingId ? 'Fonte atualizada' : 'Fonte criada' })
      }
    },
    onError: (error) => addToast({ type: 'error', title: 'Erro', message: error instanceof Error ? error.message : 'Não foi possível salvar' })
  })

  // Remove uma fonte e atualiza a tabela sem recarregar a página.
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/v1/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      addToast({ type: 'success', title: 'Fonte removida' })
    },
    onError: () => addToast({ type: 'error', title: 'Erro', message: 'Não foi possível remover a fonte' })
  })

  // Sincroniza manualmente uma fonte específica e controla seu loading por id.
  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingSourceId(id)
      try {
        const { data } = await api.post<{ message: string }>(`/api/v1/sources/${id}/sync`, {})
        return data
      } finally {
        setSyncingSourceId(null)
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      addToast({ type: 'success', title: 'Sincronização concluída', message: data.message })
    },
    onError: (error) => addToast({ type: 'error', title: 'Erro na sincronização', message: error instanceof Error ? error.message : 'Feed inválido' })
  })

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(undefined)
    setIsFormOpen(true)
  }

  const openEdit = (source: Source) => {
    setForm({ name: source.name, url: source.url, feedUrl: source.feedUrl ?? '', type: source.type, enabled: source.enabled })
    setEditingId(source.id)
    setIsFormOpen(true)
  }

  const sources = sourcesQuery.data ?? []
  const filteredSources = useMemo(() => {
    const normalizedQuery = sourceQuery.trim().toLocaleLowerCase('pt-BR')
    return sources.filter((source) => {
      const matchesQuery = !normalizedQuery || [source.name, source.url, source.type]
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      const matchesStatus = sourceStatus === 'all' || (sourceStatus === 'active' ? source.enabled : !source.enabled)
      return matchesQuery && matchesStatus
    })
  }, [sourceQuery, sourceStatus, sources])
  const totalPages = Math.max(1, Math.ceil(filteredSources.length / sourcesPerPage))
  const pageStart = (currentPage - 1) * sourcesPerPage
  const paginatedSources = filteredSources.slice(pageStart, pageStart + sourcesPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [sourceQuery, sourceStatus])

  useEffect(() => {
    const updatePageSize = () => {
      const isDesktop = window.matchMedia('(min-width: 768px)').matches
      const availableHeight = window.innerHeight - (isDesktop ? 290 : 340)
      setSourcesPerPage(Math.max(3, Math.floor(availableHeight / (isDesktop ? 66 : 132))))
    }
    updatePageSize()
    window.addEventListener('resize', updatePageSize)
    return () => window.removeEventListener('resize', updatePageSize)
  }, [])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const rangeStart = filteredSources.length === 0 ? 0 : pageStart + 1
  const rangeEnd = Math.min(pageStart + sourcesPerPage, filteredSources.length)

  return (
    <div className="container-full flex min-h-[calc(100dvh-4rem)] flex-col py-5 md:block md:min-h-0 md:py-8">
      <header className="mb-4 flex items-start justify-between gap-4 sm:mb-6 sm:items-end">
        <div>
          <h1 className="font-display text-display-lg text-ink-900">Fontes</h1>
          <p className="text-body text-ink-500">Gerencie de onde suas leituras vêm.</p>
        </div>
        <button className="btn-primary h-11 w-11 shrink-0 !rounded-xl !p-0 sm:w-auto sm:!px-5" onClick={openCreate} aria-label="Nova fonte"><Plus className="h-5 w-5" /><span className="hidden sm:inline">Nova fonte</span></button>
      </header>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-950/30 p-2 sm:p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="source-form-title">
        <form className="card grid max-h-[calc(100dvh-2rem)] w-full max-w-[22rem] gap-3 overflow-y-auto p-3 [&_.input]:!py-2 sm:max-w-3xl md:grid-cols-2 md:gap-x-5 md:gap-y-4 md:p-5 md:[&_.input]:!py-3" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate() }}>
          <div className="md:col-span-2 flex items-center justify-between"><h2 id="source-form-title" className="font-display text-heading-md">{editingId ? 'Editar fonte' : 'Nova fonte'}</h2><button type="button" className="btn-ghost p-2" onClick={() => setIsFormOpen(false)} aria-label="Fechar formulário"><X className="h-4 w-4" /></button></div>
          <label className="label">Nome<input className="input mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="label">URL<input className="input mt-1" type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></label>
          <label className="label">Feed RSS<input className="input mt-1" type="url" value={form.feedUrl} onChange={(e) => setForm({ ...form, feedUrl: e.target.value })} /></label>
          <label className="label">Tipo<select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Source['type'] })}><option value="rss">RSS</option><option value="newsletter">Newsletter</option><option value="manual">Manual</option><option value="api">API</option></select></label>
          <section className="md:col-span-2 border-t border-ink-100 pt-4" aria-labelledby="discover-source-title">
            <h3 id="discover-source-title" className="font-display text-heading-sm text-ink-900">Encontrar uma fonte</h3>
            <p className="mt-1 text-body-sm text-ink-500">Cole o endereço do site para localizar o feed automaticamente.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-3"><input className="input flex-1" type="url" placeholder="https://exemplo.com" value={discoverUrl} onChange={(event) => setDiscoverUrl(event.target.value)} /><button className="btn-secondary shrink-0" type="button" disabled={!discoverUrl || discoverMutation.isPending} onClick={() => discoverMutation.mutate()}>{discoverMutation.isPending ? 'Buscando...' : 'Buscar feed'}</button></div>
            {discoveredFeeds.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{discoveredFeeds.map((feed) => <button key={feed.url} type="button" onClick={() => { setSelectedFeed(feed); setForm({ ...form, name: form.name || feed.title, url: discoverUrl, feedUrl: feed.url, type: 'rss' }) }} className={`rounded-lg border p-3 text-left text-body-sm transition-colors ${selectedFeed?.url === feed.url ? 'border-amber-500 bg-amber-50' : 'border-ink-200 hover:border-ink-300'}`}><strong className="block text-ink-900">{feed.title}</strong><span className="mt-1 block truncate text-caption text-ink-500">{feed.url}</span></button>)}</div>}
          </section>
          <div className="md:col-span-2 sticky bottom-0 flex items-center justify-between border-t border-ink-100 bg-white pt-3"><label className="flex items-center gap-2 text-body-sm text-ink-700"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Fonte ativa</label><button className="btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar fonte'}</button></div>
        </form>
        </div>
      )}

      <section className="hidden">
        <div className="mb-4">
          <h2 className="font-display text-heading-md text-ink-900">Fontes em português</h2>
          <p className="text-body-sm text-ink-500">Sugestões organizadas por tema. As fontes já adicionadas não aparecem aqui.</p>
        </div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <input className="input flex-1" placeholder="Buscar fonte ou tema" value={suggestionQuery} onChange={(event) => setSuggestionQuery(event.target.value)} />
          <select className="input sm:max-w-48" value={suggestionTopic} onChange={(event) => setSuggestionTopic(event.target.value)}><option value="">Todos os temas</option><option value="Notícias">Notícias</option><option value="Ciência">Ciência</option><option value="História">História</option><option value="Filosofia">Filosofia</option><option value="Tecnologia">Tecnologia</option></select>
        </div>
        <div className="mb-6 flex flex-wrap gap-3">
          {(suggestionsQuery.data ?? []).map((source) => <div key={source.feedUrl} className="flex min-w-64 flex-1 items-center justify-between rounded-lg border border-ink-200 p-3"><div><strong className="block text-body-sm text-ink-900">{source.name}</strong><span className="text-caption text-ink-500">{source.topic} · {source.language}</span></div><button className="btn-outline-accent px-3 py-1.5 text-caption" onClick={() => addSuggestionMutation.mutate(source)} disabled={addSuggestionMutation.isPending}>Adicionar</button></div>)}
          {!suggestionsQuery.isLoading && (suggestionsQuery.data ?? []).length === 0 && <p className="text-body-sm text-ink-500">Nenhuma fonte sugerida encontrada para esse filtro.</p>}
        </div>

        <div className="mb-4">
          <h2 className="font-display text-heading-md text-ink-900">Encontrar uma fonte</h2>
          <p className="text-body-sm text-ink-500">Cole o endereço de um site e vamos procurar feeds RSS ou Atom automaticamente.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input className="input flex-1" type="url" placeholder="https://g1.globo.com/" value={discoverUrl} onChange={(event) => setDiscoverUrl(event.target.value)} />
          <button className="btn-accent" type="button" disabled={!discoverUrl || discoverMutation.isPending} onClick={() => discoverMutation.mutate()}>
            {discoverMutation.isPending ? 'Procurando...' : 'Encontrar feeds'}
          </button>
        </div>
        {discoveredFeeds.length === 0 && discoverUrl && !discoverMutation.isPending && discoverMutation.isSuccess && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-body-sm text-amber-800">Não encontramos um feed automático. Tente colar a URL RSS diretamente no formulário manual.</p>
        )}
        {discoveredFeeds.length > 0 && (
          <div className="mt-5 space-y-2">
            <p className="text-body-sm font-medium text-ink-700">Feeds encontrados</p>
            {discoveredFeeds.map((feed) => (
              <label key={feed.url} className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 p-3 hover:bg-ink-50">
                <input type="radio" name="discovered-feed" checked={selectedFeed?.url === feed.url} onChange={() => setSelectedFeed(feed)} className="mt-1" />
                <span><strong className="block text-body-sm text-ink-900">{feed.title}</strong><span className="block text-caption text-ink-500">{feed.type.toUpperCase()} · {feed.url}</span></span>
              </label>
            ))}
            <button type="button" className="btn-primary mt-2" disabled={!selectedFeed} onClick={() => {
              if (!selectedFeed) return
              setForm({ name: selectedFeed.title, url: discoverUrl, feedUrl: selectedFeed.url, type: 'rss', enabled: true })
              setEditingId(undefined)
              setIsFormOpen(true)
              addToast({ type: 'info', title: 'Feed selecionado', message: 'Revise os dados e clique em Salvar fonte.' })
            }}>Usar feed selecionado</button>
          </div>
        )}
      </section>

      {sourcesQuery.isLoading ? <p className="py-12 text-center text-ink-500">Carregando fontes...</p> : (<>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-card md:hidden">
          <div className="border-b border-ink-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="font-display text-heading-md text-ink-900">Fontes conectadas</h2><p className="text-body-sm text-ink-500">{filteredSources.length} fontes encontradas</p></div>
              <div className="flex gap-2"><label className="relative flex-1 sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input !py-2.5 pl-9 text-body-sm" placeholder="Buscar uma fonte" value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} /></label><select className="input !w-28 !py-2.5 text-body-sm" value={sourceStatus} onChange={(event) => setSourceStatus(event.target.value as typeof sourceStatus)} aria-label="Filtrar fontes"><option value="all">Todas</option><option value="active">Ativas</option><option value="inactive">Inativas</option></select></div>
            </div>
          </div>
          <div className="divide-y divide-ink-100">
            {paginatedSources.map((source) => <article key={source.id} className="p-4 sm:px-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-medium text-ink-900">{source.name}</h3><p className="mt-1 truncate text-caption text-ink-500">{source.url}</p></div><span className={source.enabled ? 'badge-success shrink-0' : 'badge-neutral shrink-0'}>{source.enabled ? 'Ativa' : 'Inativa'}</span></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className="badge-neutral">{source.type}</span><span className="text-caption text-ink-500">{source._count?.articles ?? 0} artigos</span></div><div className="flex"><button className="btn-ghost !min-h-11 !min-w-11 !p-0" onClick={() => syncMutation.mutate(source.id)} disabled={!source.feedUrl || syncingSourceId === source.id} aria-label={`Sincronizar ${source.name}`}><RefreshCw className={`h-4 w-4 ${syncingSourceId === source.id ? 'animate-spin' : ''}`} /></button><button className="btn-ghost !min-h-11 !min-w-11 !p-0" onClick={() => openEdit(source)} aria-label={`Editar ${source.name}`}><Edit3 className="h-4 w-4" /></button><button className="btn-ghost !min-h-11 !min-w-11 !p-0 text-rose-600" onClick={() => deleteMutation.mutate(source.id)} aria-label={`Remover ${source.name}`}><Trash2 className="h-4 w-4" /></button></div></div></article>)}
            {filteredSources.length === 0 && <div className="py-12 text-center text-ink-500"><Rss className="mx-auto mb-3 h-8 w-8 text-ink-300" />Nenhuma fonte encontrada.</div>}
          </div>
          {filteredSources.length > 0 && <footer className="flex items-center justify-between border-t border-ink-100 px-4 py-3 text-body-sm text-ink-500 sm:px-5"><span>Mostrando {rangeStart}–{rangeEnd} de {filteredSources.length}</span><div className="flex items-center gap-2"><button className="btn-ghost !min-h-11 !min-w-11 !p-0" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} aria-label="Página anterior"><ChevronLeft className="h-5 w-5" /></button><span className="text-caption">{currentPage} / {totalPages}</span><button className="btn-ghost !min-h-11 !min-w-11 !p-0" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} aria-label="Próxima página"><ChevronRight className="h-5 w-5" /></button></div></footer>}
        </section>
        <section className="hidden overflow-hidden rounded-xl border border-ink-200 bg-white md:block">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-caption text-ink-500"><tr><th className="px-5 py-3 font-medium">Fonte</th><th className="px-5 py-3 font-medium">Tipo</th><th className="px-5 py-3 font-medium">Artigos</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Gerenciar</th></tr></thead>
            <tbody>{paginatedSources.map((source) => { const blocked = preferencesQuery.data?.some((item) => item.kind === 'source' && item.targetId === source.id && item.blocked); return <tr key={source.id} className="border-b border-ink-100 last:border-0"><td className="px-5 py-3"><p className="font-medium text-ink-900">{source.name}</p><p className="text-caption text-ink-500">{source.url}</p></td><td className="px-5 py-3"><span className="badge-neutral">{source.type}</span></td><td className="px-5 py-3 text-ink-600">{source._count?.articles ?? 0}</td><td className="px-5 py-3"><span className={source.enabled ? 'badge-success' : 'badge-neutral'}>{source.enabled ? 'Ativa' : 'Inativa'}</span>{blocked && <span className="ml-2 badge-error">Bloqueada</span>}</td><td className="px-5 py-3"><div className="flex justify-end gap-1"><button className="btn-ghost !min-h-10 !min-w-10 !p-0" onClick={() => syncMutation.mutate(source.id)} disabled={!source.feedUrl || syncingSourceId === source.id || deleteMutation.isPending} aria-label={`Sincronizar ${source.name}`} title="Sincronizar"><RefreshCw className={`h-4 w-4 ${syncingSourceId === source.id ? 'animate-spin' : ''}`} /></button><button className="btn-ghost !min-h-10 !min-w-10 !p-0" onClick={() => preferenceMutation.mutate({ kind: 'source', targetId: source.id, blocked: !blocked, weight: 0 })} disabled={preferenceMutation.isPending} aria-label={`${blocked ? 'Desbloquear' : 'Bloquear'} ${source.name}`} title={blocked ? 'Desbloquear' : 'Bloquear'}><CircleOff className="h-4 w-4" /></button><button className="btn-ghost !min-h-10 !min-w-10 !p-0" onClick={() => openEdit(source)} aria-label={`Editar ${source.name}`} title="Editar"><Edit3 className="h-4 w-4" /></button><button className="btn-ghost !min-h-10 !min-w-10 !p-0 text-rose-600" onClick={() => deleteMutation.mutate(source.id)} aria-label={`Remover ${source.name}`} title="Remover"><Trash2 className="h-4 w-4" /></button></div></td></tr>})}</tbody>
          </table>
          {sources.length === 0 && <div className="py-12 text-center text-ink-500"><Rss className="mx-auto mb-3 h-8 w-8 text-ink-300" />Nenhuma fonte cadastrada.</div>}
          {filteredSources.length > 0 && <footer className="flex items-center justify-between border-t border-ink-100 px-5 py-3 text-body-sm text-ink-500"><span>Mostrando {rangeStart}–{rangeEnd} de {filteredSources.length}</span><div className="flex items-center gap-2"><button className="btn-ghost !min-h-10 !min-w-10 !p-0" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} aria-label="Página anterior"><ChevronLeft className="h-5 w-5" /></button><span className="text-caption">Página {currentPage} de {totalPages}</span><button className="btn-ghost !min-h-10 !min-w-10 !p-0" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} aria-label="Próxima página"><ChevronRight className="h-5 w-5" /></button></div></footer>}
        </section>
        <section className="hidden overflow-hidden rounded-xl border border-ink-200 bg-white">
          <table className="w-full text-left text-body-sm"><thead className="border-b border-ink-200 bg-ink-50 text-caption text-ink-500"><tr><th className="px-5 py-3 font-medium">Fonte</th><th className="px-5 py-3 font-medium">Tipo</th><th className="px-5 py-3 font-medium">Artigos</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Gerenciar</th></tr></thead><tbody>{sources.map((source) => { const blocked = preferencesQuery.data?.some((item) => item.kind === 'source' && item.targetId === source.id && item.blocked); return <tr key={source.id} className="border-b border-ink-100 last:border-0"><td className="px-5 py-4"><p className="font-medium text-ink-900">{source.name}</p><p className="text-caption text-ink-500">{source.url}</p></td><td className="px-5 py-4"><span className="badge-neutral">{source.type}</span></td><td className="px-5 py-4 text-ink-600">{source._count?.articles ?? 0}</td><td className="px-5 py-4"><span className={source.enabled ? 'badge-success' : 'badge-neutral'}>{source.enabled ? 'Ativa' : 'Inativa'}</span>{blocked && <span className="ml-2 badge-error">Bloqueada</span>}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><button className="btn-ghost !min-h-10 !min-w-10 !p-0" onClick={() => syncMutation.mutate(source.id)} disabled={!source.feedUrl || syncingSourceId === source.id || deleteMutation.isPending} aria-label={`Sincronizar ${source.name}`} title="Sincronizar"><RefreshCw className={`h-4 w-4 ${syncingSourceId === source.id ? 'animate-spin' : ''}`} /></button><button className={`btn-ghost !min-h-10 !min-w-10 !p-0 ${blocked ? 'text-amber-700' : ''}`} onClick={() => preferenceMutation.mutate({ kind: 'source', targetId: source.id, blocked: !blocked, weight: 0 })} disabled={preferenceMutation.isPending} aria-label={`${blocked ? 'Desbloquear' : 'Bloquear'} ${source.name}`} title={blocked ? 'Desbloquear' : 'Bloquear'}><CircleOff className="h-4 w-4" /></button><button className="btn-ghost !min-h-10 !min-w-10 !p-0" onClick={() => openEdit(source)} disabled={syncMutation.isPending || deleteMutation.isPending} aria-label={`Editar ${source.name}`} title="Editar"><Edit3 className="h-4 w-4" /></button><button className="btn-ghost !min-h-10 !min-w-10 !p-0 text-rose-600" onClick={() => deleteMutation.mutate(source.id)} disabled={deleteMutation.isPending || syncMutation.isPending} aria-label={`Remover ${source.name}`} title="Remover"><Trash2 className="h-4 w-4" /></button></div></td></tr>})}</tbody></table>
          {sources.length === 0 && <div className="py-12 text-center text-ink-500"><Rss className="mx-auto mb-3 h-8 w-8 text-ink-300" />Nenhuma fonte cadastrada.</div>}
        </section>
        <div className="hidden">
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-caption uppercase text-ink-500"><tr><th className="px-3 py-2 sm:px-4 sm:py-3">Fonte</th><th className="px-3 py-2 sm:px-4 sm:py-3">Tipo</th><th className="px-3 py-2 sm:px-4 sm:py-3 hidden sm:table-cell">Artigos</th><th className="px-3 py-2 sm:px-4 sm:py-3">Status</th><th className="px-2 py-2 sm:px-4 sm:py-3 text-right">Ações</th></tr></thead>
            <tbody>{(sourcesQuery.data ?? []).map((source) => <tr key={source.id} className="border-b border-ink-100 last:border-0"><td className="px-2 py-2 sm:px-4 sm:py-4"><p className="font-medium text-ink-900">{source.name}</p><p className="text-caption text-ink-500 hidden sm:inline-block">{source.url}</p></td><td className="px-2 py-2 sm:px-4 sm:py-4"><span className="badge-neutral">{source.type}</span>{preferencesQuery.data?.some((item) => item.kind === 'source' && item.targetId === source.id && item.blocked) && <span className="ml-2 badge-error">Bloqueada</span>}</td><td className="px-2 py-2 sm:px-4 sm:py-4 text-ink-600 hidden sm:table-cell">{source._count?.articles ?? 0}</td><td className="px-2 py-2 sm:px-4 sm:py-4"><span className={source.enabled ? 'badge-success' : 'badge-neutral'}>{source.enabled ? 'Ativa' : 'Inativa'}</span></td><td className="px-1 py-2 sm:px-4 sm:py-4"><div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1"><button className="btn-ghost p-2" onClick={() => syncMutation.mutate(source.id)} disabled={!source.feedUrl || syncingSourceId === source.id || deleteMutation.isPending} aria-label="Sincronizar fonte"><RefreshCw className={`h-4 w-4 ${syncingSourceId === source.id ? 'animate-spin' : ''}`} /></button><button className="btn-ghost p-2" onClick={() => preferenceMutation.mutate({ kind: 'source', targetId: source.id, blocked: !(preferencesQuery.data?.find((item) => item.kind === 'source' && item.targetId === source.id)?.blocked ?? false), weight: 0 })} disabled={preferenceMutation.isPending} aria-label="Bloquear ou desbloquear fonte">{preferencesQuery.data?.find((item) => item.kind === 'source' && item.targetId === source.id)?.blocked ? 'Desbloquear' : 'Bloquear'}</button><button className="btn-ghost p-2" onClick={() => openEdit(source)} disabled={syncMutation.isPending || deleteMutation.isPending} aria-label="Editar fonte"><Edit3 className="h-4 w-4" /></button><button className="btn-ghost p-2 text-rose-600" onClick={() => deleteMutation.mutate(source.id)} disabled={deleteMutation.isPending || syncMutation.isPending} aria-label="Remover fonte"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody>
          </table>
          {(sourcesQuery.data ?? []).length === 0 && <div className="py-12 text-center text-ink-500"><Rss className="mx-auto mb-3 h-8 w-8 text-ink-300" />Nenhuma fonte cadastrada.</div>}
        </div>
        </div>
      </>)}
    </div>
  )
}
