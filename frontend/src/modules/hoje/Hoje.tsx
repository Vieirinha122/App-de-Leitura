import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Calendar, ExternalLink, BookOpen, ArrowRight, Flame, Award, Brain, HelpCircle, Lightbulb, Loader2, CheckCircle2, RotateCcw } from 'lucide-react'
import { format, addDays, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { fetchDailyRecommendation, fetchPreviousDaily, openArticle, completeArticle, fetchStats, fetchNextArticle } from './service'
import Rating from '@/components/Rating'
import { useUIStore } from '@/lib/stores/uiStore'
import { api } from '@/lib/api/client'

interface Stats {
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

export default function Hoje() {
  const { addToast } = useUIStore()
  const queryClient = useQueryClient()
  const [currentDate, setCurrentDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [iaResult, setIaResult] = useState<{ type: 'summary' | 'questions' | 'explanation'; content: string[] | string } | null>(null)
  const [iaLoading, setIaLoading] = useState(false)
  const [isFetchingNext, setIsFetchingNext] = useState(false)

  const isCurrentDay = isToday(parseISO(currentDate))
  const fetcher = isCurrentDay ? fetchDailyRecommendation : () => fetchPreviousDaily(currentDate)

  const { data: daily, isLoading, error, refetch } = useQuery({
    queryKey: ['daily', currentDate],
    queryFn: fetcher,
    enabled: !!currentDate,
    staleTime: 1000 * 60 * 30
  })

  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: fetchStats,
    staleTime: 1000 * 60 * 60
  })

  async function executarAcaoIa(type: 'summary' | 'questions' | 'explanation') {
    if (!article) return
    setIaLoading(true)
    try {
      const endpoint = type === 'summary' ? 'summarize' : type === 'questions' ? 'questions' : 'explain'
      const { data } = await api.post<{ bullets?: string[]; questions?: string[]; explanation?: string }>(`/api/v1/ai/${endpoint}`, { articleId: article.id })
      setIaResult({ type, content: data.bullets ?? data.questions ?? data.explanation ?? '' })
      addToast({ type: 'success', title: 'Conteúdo gerado' })
    } catch (error) {
      addToast({ type: 'error', title: 'Erro na IA', message: error instanceof Error ? error.message : 'Não foi possível gerar o conteúdo' })
    } finally {
      setIaLoading(false)
    }
  }

  const navigateDay = (delta: number) => {
    const newDate = format(addDays(parseISO(currentDate), delta), 'yyyy-MM-dd')
    setCurrentDate(newDate)
  }

  const handleOpen = async (articleId: string, url: string) => {
    try {
      await openArticle(articleId)
      window.open(url, '_blank', 'noopener,noreferrer')
      addToast({ type: 'success', title: 'Artigo aberto', message: 'Registrado como iniciado' })
    } catch {
      addToast({ type: 'error', title: 'Erro', message: 'Não foi possível registrar a abertura' })
    }
  }

  const handleComplete = async (articleId: string, rating: 'dislike' | 'neutral' | 'like') => {
    try {
      await completeArticle(articleId, rating)
      addToast({ type: 'success', title: 'Avaliação registrada', message: 'Obrigada pelo feedback!' })
      // Invalida cache do daily e stats para refletir atualização
      queryClient.invalidateQueries({ queryKey: ['daily', currentDate] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    } catch {
      addToast({ type: 'error', title: 'Erro', message: 'Não foi possível registrar a avaliação' })
    }
  }

  const handleNextArticle = async () => {
    if (isFetchingNext) return
    setIsFetchingNext(true)
    try {
      const next = await fetchNextArticle()
      if (next?.article) {
        addToast({ type: 'success', title: 'Novo artigo', message: 'Aqui está outro artigo para você' })
        // Atualiza o cache do daily com o novo artigo (sem substituir a recomendação oficial)
        queryClient.setQueryData(['daily', currentDate], next)
        setIaResult(null)
      } else {
        addToast({ type: 'error', title: 'Sem mais artigos', message: 'Não há mais artigos disponíveis para hoje' })
      }
    } catch {
      addToast({ type: 'error', title: 'Erro', message: 'Não foi possível buscar outro artigo' })
    } finally {
      setIsFetchingNext(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center px-4">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-12 w-12">
            <svg className="h-full w-full text-ink-200 animate-spin" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="31.4 31.4" />
            </svg>
          </div>
          <p className="text-body text-ink-500">Buscando sua leitura de hoje...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container-narrow py-12 text-center">
        <p className="text-body text-ink-600 mb-4">Não foi possível carregar a leitura.</p>
        <button className="btn-primary" onClick={() => refetch()}>Tentar novamente</button>
      </div>
    )
  }

  if (!daily || !daily.article) {
    return (
      <div className="container-narrow py-12 text-center">
        <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-ink-100 flex items-center justify-center">
          <BookOpen className="h-10 w-10 text-ink-400" />
        </div>
        <h2 className="font-display text-display-md text-ink-900 mb-3">Nenhuma leitura para hoje</h2>
        <p className="text-body-lg text-ink-500 mb-6 max-w-prose mx-auto">
          {isCurrentDay
            ? 'Ainda não há artigos disponíveis. Adicione fontes na aba Fontes ou aguarde a próxima coleta.'
            : 'Não há leitura registrada para esta data.'}
        </p>
        {isCurrentDay && (
          <a href="/fontes" className="btn-accent">
            Ir para Fontes
          </a>
        )}
      </div>
    )
  }

  const article = daily.article!
  const tags = article.tags?.slice(0, 3) ?? []
  const sourceName = article.source?.name ?? 'Fonte desconhecida'
  const categoryName = article.category?.name ?? 'Sem categoria'
  // Remove o texto residual do RSS ("Read the full post → ...")
  const summary = article.summary?.replace(/Read the full post[\s\S]*$/i, '').trim()

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header with date navigation */}
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-overline text-amber-600 font-semibold mb-1">
              {isCurrentDay ? 'Leitura de hoje' : 'Leitura do dia'}
            </p>
            <h1 className="font-display text-display-lg text-ink-900 text-balance">
              {isCurrentDay ? 'Sua leitura diária' : format(parseISO(currentDate), 'EEEE, d MMMM yyyy', { locale: ptBR })}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateDay(-1)}
              disabled={!isCurrentDay && currentDate <= '2024-01-01'}
              className="btn-secondary p-2"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-ink-200 rounded-lg">
              <Calendar className="h-5 w-5 text-ink-400" />
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="bg-transparent border-none outline-none text-body font-medium text-ink-900 w-auto"
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <button
              onClick={() => navigateDay(1)}
              disabled={isCurrentDay}
              className="btn-secondary p-2"
              aria-label="Próximo dia"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 rounded-full">
            <Flame className="h-4 w-4 text-amber-500" />
            <span>Streak: <strong className="text-ink-900">{stats?.currentStreak ?? 0}</strong> dias</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 rounded-full">
            <Award className="h-4 w-4 text-amber-500" />
            <span>Maior: <strong className="text-ink-900">{stats?.longestStreak ?? 0}</strong></span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 rounded-full">
            <BookOpen className="h-4 w-4 text-sage-500" />
            <span>Este mês: <strong className="text-ink-900">{stats?.articlesThisMonth ?? 0}</strong></span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 rounded-full">
            <BookOpen className="h-4 w-4 text-sage-500" />
            <span>Total: <strong className="text-ink-900">{stats?.articlesThisYear ?? 0}</strong></span>
          </div>
        </div>
      </header>

      {/* Duas colunas: artigo à esquerda, ações de aprofundamento e avaliação à direita */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Article Card */}
        <article className="card card-hover p-6 sm:p-8 animate-fade-in">
          {daily.reason && (
            <p className="mb-4 text-body-sm text-ink-500">
              <span className="font-medium text-ink-700">Por que esta leitura?</span> {daily.reason}
            </p>
          )}

          {/* Category badge */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="badge-sage">{categoryName}</span>
            <span className="badge-neutral">{sourceName}</span>
            {tags.map((tag) => (
              <span key={tag} className="badge-neutral">{tag}</span>
            ))}
          </div>

          {/* Title */}
          <h2 className="font-display text-display-md text-ink-900 mb-4 text-balance leading-tight">
            {article.title}
          </h2>

          {/* Summary */}
          {summary && (
            <p className="mb-6 line-clamp-5 text-body-lg text-ink-600 text-justify">{summary}</p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mb-6 text-body-sm text-ink-500">
            {article.publishedAt && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Publicado em {format(parseISO(article.publishedAt), 'd MMM yyyy', { locale: ptBR })}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-ink-200">
            <button
              onClick={() => handleOpen(article.id, article.url)}
              className="btn-primary flex-1 sm:flex-none"
            >
              <ExternalLink className="h-5 w-5" />
              <span>Ler artigo</span>
              <ArrowRight className="h-5 w-5" />
            </button>

            <button
              onClick={() => handleComplete(article.id, 'like')}
              className="btn-secondary flex-1 sm:flex-none"
            >
              <BookOpen className="h-5 w-5" />
              Marcar como lido
            </button>

            <button
              onClick={handleNextArticle}
              className="btn-ghost flex-1 sm:flex-none"
              disabled={isFetchingNext}
            >
              {isFetchingNext ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <ChevronRight className="h-5 w-5" />
                  <span>Outro artigo</span>
                </>
              )}
            </button>
          </div>
        </article>

        {/* Coluna lateral */}
        <aside className="space-y-6 lg:sticky lg:top-6">
          {/* Ações de IA */}
          <section className="card p-5">
            {iaResult && !iaLoading ? (
              // Estado: resultado carregado
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-overline text-amber-600 font-semibold tracking-wide">
                    {iaResult.type === 'summary' ? 'RESUMO DA IA' : iaResult.type === 'questions' ? 'PERGUNTAS DE FIXAÇÃO' : 'EXPLICAÇÃO'}
                  </p>
                </div>

                {Array.isArray(iaResult.content) ? (
                  <div className="space-y-2">
                    <p className="text-body-sm text-ink-600">
                      {iaResult.type === 'summary' && 'Aqui estão os pontos principais do artigo:'}
                      {iaResult.type === 'questions' && 'Perguntas para fixar o que você leu:'}
                      {iaResult.type === 'explanation' && 'Conceitos-chave explicados de forma simples:'}
                    </p>
                    <ul className="space-y-2 pl-1">
                      {iaResult.content.map((item, idx) => (
                        <li key={idx} className="flex gap-3 text-body-sm text-ink-700 leading-relaxed">
                          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-body-sm text-ink-700">{iaResult.content}</p>
                )}

                <button
                  className="btn-ghost w-full justify-center gap-2 text-body-sm"
                  onClick={() => setIaResult(null)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Ver outras opções
                </button>
              </div>
            ) : (
              // Estado: botões de ação
              <>
                <p className="mb-3 text-body-sm font-medium text-ink-700 text-center">Aprofundar esta leitura</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="btn-secondary flex-col gap-1 px-2 py-3 text-body-sm"
                      onClick={() => executarAcaoIa('summary')}
                      disabled={iaLoading}
                    >
                      <Brain className="h-5 w-5" />
                      <span>Resumir</span>
                    </button>

                    <button
                      className="btn-secondary flex-col gap-1 px-2 py-3 text-body-sm"
                      onClick={() => executarAcaoIa('questions')}
                      disabled={iaLoading}
                    >
                      <HelpCircle className="h-5 w-5" />
                      <span>Perguntas</span>
                    </button>

                    <button
                      className="btn-secondary flex-col gap-1 px-2 py-3 text-body-sm"
                      onClick={() => executarAcaoIa('explanation')}
                      disabled={iaLoading}
                    >
                      <Lightbulb className="h-5 w-5" />
                      <span>Explicar</span>
                    </button>
                  </div>

                {iaLoading && (
                  <p className="mt-4 flex justify-center items-center gap-2 text-body-sm text-ink-500 text-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando conteúdo...
                  </p>
                )}
              </>
            )}
          </section>

          {/* Rating */}
          <section className="card p-5">
            <p className="text-overline text-ink-500 font-semibold tracking-wide mb-1">COMO FOI A LEITURA?</p>
            <p className="text-caption text-ink-500 mb-4">Seu feedback melhora as próximas escolhas.</p>
            <Rating
              value={null}
              onChange={(rating) => handleComplete(article.id, rating)}
              size="md"
            />
          </section>
        </aside>
      </div>
    </div>
  )
}