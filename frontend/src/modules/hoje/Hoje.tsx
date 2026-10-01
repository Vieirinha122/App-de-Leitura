import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Calendar, ExternalLink, BookOpen, ArrowRight, Flame, Award, Brain, HelpCircle, Lightbulb, Loader2, RotateCcw, Clock, Heart, ThumbsUp, ThumbsDown, Bookmark, Check } from 'lucide-react'
import { format, addDays, isToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { fetchDailyRecommendation, fetchPreviousDaily, openArticle, completeArticle, fetchStats, fetchNextArticle } from './service'
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
  const [seenArticleIds, setSeenArticleIds] = useState<string[]>([])

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
    if (!daily?.article) return
    setIaLoading(true)
    try {
      const endpoint = type === 'summary' ? 'summarize' : type === 'questions' ? 'questions' : 'explain'
      const { data } = await api.post<{ bullets?: string[]; questions?: string[]; explanation?: string }>(`/api/v1/ai/${endpoint}`, { articleId: daily.article.id })
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

  const handleSave = async (articleId: string) => {
    try {
      await api.patch(`/api/v1/articles/${articleId}`, { status: 'saved' })
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      addToast({ type: 'success', title: 'Artigo salvo', message: 'Disponível na sua lista de salvos.' })
    } catch {
      addToast({ type: 'error', title: 'Erro', message: 'Não foi possível salvar o artigo.' })
    }
  }

  const handleNextArticle = async () => {
    if (isFetchingNext || !daily?.article) return
    setIsFetchingNext(true)
    try {
      const currentId = daily.article.id
      const newSeen = [...seenArticleIds, currentId]
      const next = await fetchNextArticle(currentId, newSeen)
      if (next?.article) {
        setSeenArticleIds(newSeen)
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
  const sourceName = article.source?.name ?? 'Fonte desconhecida'
  // Remove o texto residual do RSS ("Read the full post → ...")
  const summary = article.summary?.replace(/Read the full post[\s\S]*$/i, '').trim()

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 sm:px-6 lg:h-[calc(100dvh-4.25rem)] lg:max-w-7xl lg:overflow-hidden lg:px-8">
      {/* Header with date navigation */}
      <header className="mb-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-overline text-amber-600 font-semibold mb-0.5">
              {isCurrentDay ? 'Leitura de hoje' : 'Leitura do dia'}
            </p>
            <h1 className="font-display text-display-lg text-ink-900 text-balance leading-snug">
              {isCurrentDay ? 'Sua leitura diária.' : format(parseISO(currentDate), 'EEEE, d MMMM yyyy', { locale: ptBR })}
            </h1>
            <p className="mt-1 text-body text-ink-500">
              Um bom artigo. Um pouco de contexto. Tempo para pensar.
            </p>
          </div>

          <div className="flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
            <button
              onClick={() => navigateDay(-1)}
              disabled={!isCurrentDay && currentDate <= '2024-01-01'}
              className="btn-secondary p-2"
              aria-label="Dia anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-ink-200 rounded-lg w-full sm:w-auto justify-center">
              <Calendar className="h-5 w-5 text-ink-400" />
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="bg-transparent border-none outline-none text-body font-medium text-ink-900 w-full sm:w-auto text-center sm:text-left"
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
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="card px-4 py-2.5 flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center">
              <Flame className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-caption text-ink-500">Streak</p>
              <p className="font-display font-bold text-ink-900">{stats?.currentStreak ?? 0} dias</p>
            </div>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center">
              <Award className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-caption text-ink-500">Maior</p>
              <p className="font-display font-bold text-ink-900">{stats?.longestStreak ?? 0}</p>
            </div>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-sage-50 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-sage-500" />
            </div>
            <div>
              <p className="text-caption text-ink-500">Este mês</p>
              <p className="font-display font-bold text-ink-900">{stats?.articlesThisMonth ?? 0}</p>
            </div>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-3">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-sage-50 flex items-center justify-center">
              <Clock className="h-4 w-4 text-sage-500" />
            </div>
            <div>
              <p className="text-caption text-ink-500">Tempo</p>
              <p className="font-display font-bold text-ink-900">{stats?.totalReadingTimeMinutes ?? 0} min</p>
            </div>
          </div>
        </div>
      </header>

      {/* Duas colunas: artigo à esquerda, ações de aprofundamento e avaliação à direita */}
      <div className="flex-1 min-h-0 grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_360px] pb-3">
        {/* Article Card */}
        <article className="relative flex min-h-0 flex-col rounded-2xl border border-ink-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-card animate-fade-in sm:p-5 lg:overflow-y-auto">
          {/* Content wrapper grouped naturally */}
          <div className="flex flex-col gap-4">
            {/* Header: Tag & Source */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-overline text-ink-500 font-bold tracking-widest">SELECIONADO PARA VOCÊ</span>
              </div>
              <div className="flex items-center gap-1"><span className="badge-neutral flex-shrink-0">{sourceName}</span><button className="btn-ghost !min-h-10 !min-w-10 !p-0 sm:hidden" onClick={() => handleSave(article.id)} aria-label="Guardar na biblioteca"><Bookmark className="h-4 w-4" /></button></div>
            </div>

            {/* Title */}
            <h2 className="font-display text-display-md sm:text-display-lg text-ink-900 leading-tight">
              {article.title}
            </h2>

            {/* Summary */}
            {summary && (
              <p className="text-body-lg text-ink-600 leading-relaxed text-justify line-clamp-6">
                {summary}
              </p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 text-caption text-ink-400">
              {article.publishedAt && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-ink-400" />
                  Publicado em {format(parseISO(article.publishedAt), 'd MMM yyyy', { locale: ptBR })}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-ink-400" />
                {article.readingTimeMinutes ?? 5} min de leitura
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-2">
              <button
                onClick={() => handleOpen(article.id, article.url)}
                className="btn-primary"
              >
                <ExternalLink className="h-5 w-5" />
                <span>Ler artigo</span>
              </button>

              <button
                onClick={() => handleComplete(article.id, 'like')}
                className="btn-secondary"
              >
                <Check className="h-5 w-4" />
                Marcar como lido
              </button>

              <button
                onClick={handleNextArticle}
                className="btn-ghost"
                disabled={isFetchingNext}
              >
                <span>Outro artigo</span>
                <ArrowRight className="h-5 w-4" />
              </button>
            </div>

            {/* Feedback / Ratings section right below CTA buttons */}
            <div className="border-t border-ink-100 pt-3">
              <p className="text-overline text-ink-400 font-bold mb-2 tracking-wider">COMO FOI A LEITURA?</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <button 
                  onClick={() => handleComplete(article.id, 'like')}
                  className="cursor-pointer p-2.5 flex flex-col items-center justify-center gap-1 rounded-xl border border-ink-200/80 bg-ink-50/50 hover:bg-amber-50 hover:border-amber-300 transition-all group"
                >
                  <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center shadow-soft group-hover:bg-amber-100 transition-colors">
                    <Heart className="h-3.5 w-3.5 text-ink-400 group-hover:text-amber-600 transition-colors" />
                  </div>
                  <span className="text-xs font-bold text-ink-900 leading-tight">Gostei</span>
                  <span className="text-[10px] text-ink-400 leading-none">Valeu a pena</span>
                </button>

                <button 
                  onClick={() => handleComplete(article.id, 'neutral')}
                  className="cursor-pointer p-2.5 flex flex-col items-center justify-center gap-1 rounded-xl border border-ink-200/80 bg-ink-50/50 hover:bg-ink-100 hover:border-ink-300 transition-all group"
                >
                  <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center shadow-soft transition-colors">
                    <ThumbsUp className="h-3.5 w-3.5 text-ink-400 group-hover:text-ink-900 transition-colors" />
                  </div>
                  <span className="text-xs font-bold text-ink-900 leading-tight">OK</span>
                  <span className="text-[10px] text-ink-400 leading-none">Interessante</span>
                </button>

                <button 
                  onClick={() => handleComplete(article.id, 'dislike')}
                  className="cursor-pointer p-2.5 flex flex-col items-center justify-center gap-1 rounded-xl border border-ink-200/80 bg-ink-50/50 hover:bg-rose-50 hover:border-rose-300 transition-all group"
                >
                  <div className="h-7 w-7 rounded-full bg-white flex items-center justify-center shadow-soft group-hover:bg-rose-100 transition-colors">
                    <ThumbsDown className="h-3.5 w-3.5 text-ink-400 group-hover:text-rose-600 transition-colors" />
                  </div>
                  <span className="text-xs font-bold text-ink-900 leading-tight">Não gostei</span>
                  <span className="text-[10px] text-ink-400 leading-none">Não relevante</span>
                </button>
              </div>
            </div>
          </div>
        </article>

        {/* Coluna lateral */}
        <aside className="flex flex-col gap-3.5 lg:h-full lg:min-h-0 lg:overflow-y-auto">
          {/* Ações de IA */}
          <section className="card p-4 sm:p-5">
            <p className="text-overline text-ink-500 font-bold mb-3 tracking-widest uppercase">APROFUNDAR</p>
            
            {iaResult && !iaLoading ? (
              // Estado: resultado carregado
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body-sm font-bold text-amber-600">
                    {iaResult.type === 'summary' ? 'Resumo da IA' : iaResult.type === 'questions' ? 'Perguntas de fixação' : 'Explicação'}
                  </p>
                </div>

                {Array.isArray(iaResult.content) ? (
                  <ul className="space-y-3">
                    {iaResult.content.map((item, idx) => (
                      <li key={idx} className="flex gap-3 text-body-sm text-ink-700 leading-relaxed">
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-2" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-body-sm text-ink-700 text-justify leading-relaxed">{iaResult.content}</p>
                )}

                <button
                  className="btn-ghost w-full justify-center gap-2 text-caption font-bold"
                  onClick={() => setIaResult(null)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Voltar para as opções
                </button>
              </div>
            ) : (
              // Estado: botões de ação estilo lista editorial
              <div className="space-y-2.5">
                <p className="text-body-sm text-ink-400 mb-3">Escolha um caminho para continuar pensando.</p>
                
                <button
                  className="w-full flex items-center justify-between p-3 bg-ink-50 rounded-xl border border-transparent hover:border-amber-200 hover:bg-white transition-all group"
                  onClick={() => executarAcaoIa('summary')}
                  disabled={iaLoading}
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shadow-soft shrink-0">
                      <Brain className="h-4.5 w-4.5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-body-sm font-bold text-ink-900">Resumir</p>
                      <p className="text-[10px] text-ink-400">As ideias em poucos pontos</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-300 group-hover:text-amber-500 transition-colors" />
                </button>

                <button
                  className="w-full flex items-center justify-between p-3 bg-ink-50 rounded-xl border border-transparent hover:border-amber-200 hover:bg-white transition-all group"
                  onClick={() => executarAcaoIa('questions')}
                  disabled={iaLoading}
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shadow-soft shrink-0">
                      <HelpCircle className="h-4.5 w-4.5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-body-sm font-bold text-ink-900">Perguntas</p>
                      <p className="text-[10px] text-ink-400">Puxar o fio da história</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-300 group-hover:text-amber-500 transition-colors" />
                </button>

                <button
                  className="w-full flex items-center justify-between p-3 bg-ink-50 rounded-xl border border-transparent hover:border-amber-200 hover:bg-white transition-all group"
                  onClick={() => executarAcaoIa('explanation')}
                  disabled={iaLoading}
                >
                  <div className="flex items-center gap-3 text-left">
                    <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center shadow-soft shrink-0">
                      <Lightbulb className="h-4.5 w-4.5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-body-sm font-bold text-ink-900">Explicar</p>
                      <p className="text-[10px] text-ink-400">Contexto para entender melhor</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-300 group-hover:text-amber-500 transition-colors" />
                </button>

                {iaLoading && (
                  <div className="pt-2 flex justify-center items-center gap-3 text-caption text-ink-400">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" /> 
                    Gerando conteúdo...
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Para Depois section */}
          <section className="hidden border-ink-200 p-4 lg:block">
            <p className="text-overline text-ink-500 font-bold mb-2 tracking-widest uppercase">PARA DEPOIS</p>
            <p className="text-body-sm text-ink-500 mb-3">Guarde para ler quando tiver mais tempo.</p>
            <button 
              onClick={() => handleComplete(article.id, 'like')}
              className="w-full btn-secondary justify-between"
            >
              <span>Guardar na biblioteca</span>
              <Bookmark className="h-4 w-4" />
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
