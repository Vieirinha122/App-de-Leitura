import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, Flame } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { fetchHistory, fetchStats, type Stats } from './service'

export default function Historico() {
  const historyQuery = useQuery({ queryKey: ['history'], queryFn: () => fetchHistory({ page: 1, pageSize: 50 }) })
  const statsQuery = useQuery<Stats>({ queryKey: ['stats'], queryFn: fetchStats })
  const items = historyQuery.data?.data ?? []

  return (
    <div className="container-narrow py-8">
      <header className="mb-8">
        <p className="text-overline text-amber-600 font-semibold">Ritual</p>
        <h1 className="font-display text-display-lg text-ink-900">Histórico</h1>
        <p className="text-body text-ink-500">Uma visão do que você vem aprendendo.</p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><Flame className="mb-3 h-5 w-5 text-amber-500" /><p className="text-caption text-ink-500">Streak atual</p><strong className="font-display text-display-sm text-ink-900">{statsQuery.data?.currentStreak ?? 0} dias</strong></div>
        <div className="card p-4"><Calendar className="mb-3 h-5 w-5 text-sage-500" /><p className="text-caption text-ink-500">Este mês</p><strong className="font-display text-display-sm text-ink-900">{statsQuery.data?.articlesThisMonth ?? 0} artigos</strong></div>
        <div className="card p-4"><Clock className="mb-3 h-5 w-5 text-sage-500" /><p className="text-caption text-ink-500">Tempo total</p><strong className="font-display text-display-sm text-ink-900">{statsQuery.data?.totalReadingTimeMinutes ?? 0} min</strong></div>
      </section>

      {historyQuery.isLoading ? <p className="py-12 text-center text-ink-500">Carregando histórico...</p> : items.length === 0 ? <p className="py-12 text-center text-ink-500">Suas leituras concluídas aparecerão aqui.</p> : (
        <div className="relative border-l border-ink-200 pl-6">
          {items.map((article) => (
            <article key={`${article.id}-${article.readingHistory?.completedAt}`} className="relative mb-6 card p-5">
              <span className="absolute -left-[2rem] top-6 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
              <p className="text-caption text-ink-500">{article.readingHistory?.completedAt ? format(parseISO(article.readingHistory.completedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Data não informada'}</p>
              <h2 className="mt-1 font-display text-heading-md text-ink-900">{article.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-body-sm text-ink-500"><span>{article.source?.name}</span><span>•</span><span>{article.readingTimeMinutes ?? '—'} min</span>{article.readingHistory?.rating && <><span>•</span><span>Avaliação: {article.readingHistory.rating}</span></>}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}