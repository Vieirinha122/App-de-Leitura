import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, Plus, RefreshCw, Rss, Trash2, X } from 'lucide-react'
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

async function fetchSources(): Promise<Source[]> {
  const { data } = await api.get<Source[]>('/api/v1/sources')
  return data
}

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
  const sourcesQuery = useQuery({ queryKey: ['sources'], queryFn: fetchSources })

  const saveMutation = useMutation({
    mutationFn: () => saveSource(form, editingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      setForm(emptyForm)
      setEditingId(undefined)
      setIsFormOpen(false)
      addToast({ type: 'success', title: editingId ? 'Fonte atualizada' : 'Fonte criada' })
    },
    onError: (error) => addToast({ type: 'error', title: 'Erro', message: error instanceof Error ? error.message : 'Não foi possível salvar' })
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/v1/sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      addToast({ type: 'success', title: 'Fonte removida' })
    },
    onError: () => addToast({ type: 'error', title: 'Erro', message: 'Não foi possível remover a fonte' })
  })

  const syncMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ message: string }>(`/api/v1/sources/${id}/sync`, {})
      return data
    },
    onSuccess: (data) => {
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

  return (
    <div className="container-full py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-overline text-amber-600 font-semibold">Curadoria</p>
          <h1 className="font-display text-display-lg text-ink-900">Fontes</h1>
          <p className="text-body text-ink-500">Gerencie de onde suas leituras vêm.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Nova fonte</button>
      </header>

      {isFormOpen && (
        <form className="card mb-6 grid gap-4 p-5 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); saveMutation.mutate() }}>
          <div className="md:col-span-2 flex items-center justify-between"><h2 className="font-display text-heading-md">{editingId ? 'Editar fonte' : 'Nova fonte'}</h2><button type="button" className="btn-ghost p-2" onClick={() => setIsFormOpen(false)}><X className="h-4 w-4" /></button></div>
          <label className="label">Nome<input className="input mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="label">URL<input className="input mt-1" type="url" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></label>
          <label className="label">Feed RSS<input className="input mt-1" type="url" value={form.feedUrl} onChange={(e) => setForm({ ...form, feedUrl: e.target.value })} /></label>
          <label className="label">Tipo<select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Source['type'] })}><option value="rss">RSS</option><option value="newsletter">Newsletter</option><option value="manual">Manual</option><option value="api">API</option></select></label>
          <label className="flex items-center gap-2 text-body-sm text-ink-700"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Fonte ativa</label>
          <div className="md:col-span-2 flex justify-end"><button className="btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar fonte'}</button></div>
        </form>
      )}

      {sourcesQuery.isLoading ? <p className="py-12 text-center text-ink-500">Carregando fontes...</p> : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-caption uppercase text-ink-500"><tr><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Artigos</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody>{(sourcesQuery.data ?? []).map((source) => <tr key={source.id} className="border-b border-ink-100 last:border-0"><td className="px-4 py-4"><p className="font-medium text-ink-900">{source.name}</p><p className="text-caption text-ink-500">{source.url}</p></td><td className="px-4 py-4"><span className="badge-neutral">{source.type}</span></td><td className="px-4 py-4 text-ink-600">{source._count?.articles ?? 0}</td><td className="px-4 py-4"><span className={source.enabled ? 'badge-success' : 'badge-neutral'}>{source.enabled ? 'Ativa' : 'Inativa'}</span></td><td className="px-4 py-4"><div className="flex justify-end gap-1"><button className="btn-ghost p-2" onClick={() => syncMutation.mutate(source.id)} disabled={!source.feedUrl || syncMutation.isPending} aria-label="Sincronizar fonte"><RefreshCw className="h-4 w-4" /></button><button className="btn-ghost p-2" onClick={() => openEdit(source)} aria-label="Editar fonte"><Edit3 className="h-4 w-4" /></button><button className="btn-ghost p-2 text-rose-600" onClick={() => deleteMutation.mutate(source.id)} aria-label="Remover fonte"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody>
          </table>
          {(sourcesQuery.data ?? []).length === 0 && <div className="py-12 text-center text-ink-500"><Rss className="mx-auto mb-3 h-8 w-8 text-ink-300" />Nenhuma fonte cadastrada.</div>}
        </div>
      )}
    </div>
  )
}