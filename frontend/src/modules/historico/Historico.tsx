import { useQuery } from '@tanstack/react-query'
import { Calendar, Clock, ExternalLink, Flame } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { fetchHistory, fetchStats, type Stats } from './service'

export default function Historico() {
  const historyQuery = useQuery({ queryKey: ['history'], queryFn: () => fetchHistory({ page: 1, pageSize: 50 }) })
  const statsQuery = useQuery<Stats>({ queryKey: ['stats'], queryFn: fetchStats })
  const items = historyQuery.data?.data ?? []

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8 xl:max-w-5xl">
      <header className="mb-8">
        <p className="text-overline text-amber-600 font-semibold">Ritual</p>
        <h1 className="font-display text-display-lg text-ink-900">Histórico</h1>
        <p className="text-body text-ink-500">Uma visão do que você vem aprendendo.</p>
      </header>

      <section className="mb-8 grid grid-cols-3 gap-3">
        <div className="card p-2 text-center"><Flame className="mx-auto mb-1 h-4 w-4 text-amber-500" /><p className="text-caption text-ink-500">Streak</p><strong className="block font-display text-xs sm:text-display-sm text-ink-900">{statsQuery.data?.currentStreak ?? 0} dias</strong></div>
        <div className="card p-2 text-center"><Calendar className="mx-auto mb-1 h-4 w-4 text-sage-500" /><p className="text-caption text-ink-500">Este mês</p><strong className="block font-display text-xs sm:text-display-sm text-ink-900">{statsQuery.data?.articlesThisMonth ?? 0} artigos</strong></div>
        <div className="card p-2 text-center"><Clock className="mx-auto mb-1 h-4 w-4 text-sage-500" /><p className="text-caption text-ink-500">Total</p><strong className="block font-display text-xs sm:text-display-sm text-ink-900">{statsQuery.data?.totalReadingTimeMinutes ?? 0} min</strong></div>
      </section>

      {historyQuery.isLoading ? <p className="py-12 text-center text-ink-500">Carregando histórico...</p> : items.length === 0 ? <p className="py-12 text-center text-ink-500">Suas leituras concluídas aparecerão aqui.</p> : (
        <div className="relative border-l border-ink-200 pl-6">
          {items.map((article) => (
            <article key={`${article.id}-${article.readingHistory?.completedAt}`} className="relative mb-6 w-full card p-5">
              <span className="absolute -left-[2rem] top-6 h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
              <p className="text-caption text-ink-500">{article.readingHistory?.completedAt ? format(parseISO(article.readingHistory.completedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Data não informada'}</p>
              <h2 className="mt-1 font-display text-heading-md text-ink-900">{article.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-body-sm text-ink-500"><span>{article.source?.name}</span><span>•</span><span>{article.readingTimeMinutes ?? '—'} min</span>{article.readingHistory?.rating && <><span>•</span><span>Avaliação: {article.readingHistory.rating}</span></>}</div>
              <div className="mt-4 border-t border-ink-100 pt-3"><a href={article.url} target="_blank" rel="noreferrer" className="btn-secondary min-h-11"><ExternalLink className="h-4 w-4" />Ler artigo</a></div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
