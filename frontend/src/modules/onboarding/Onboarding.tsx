import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Check, AlertCircle, Sparkles } from 'lucide-react'
import { useUIStore } from '@/lib/stores/uiStore'
import { fetchTopics, startOnboarding, checkOnboardingStatus, type Topic, type OnboardingStatus } from './service'

const MIN_TOPICS = 1
const SUGGESTED_MAX = 5

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { addToast: notify } = useUIStore()

  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [isLoadingTopics, setIsLoadingTopics] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)

  // Carrega tópicos disponíveis
  useEffect(() => {
    async function loadTopics() {
      try {
        const topicsData = await fetchTopics()
        setTopics(topicsData)
      } catch (error) {
        console.error('Erro ao carregar tópicos:', error)
        notify({ type: 'error', title: 'Erro', message: 'Não foi possível carregar os tópicos' })
      } finally {
        setIsLoadingTopics(false)
      }
    }
    loadTopics()
  }, [notify])

  // Alterna seleção de tópico
  const toggleTopic = useCallback((topicId: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev)
      if (next.has(topicId)) {
        next.delete(topicId)
      } else if (next.size < SUGGESTED_MAX) {
        next.add(topicId)
      }
      return next
    })
  }, [])

  // Polling do status do job
  const startPolling = useCallback((id: string) => {
    const interval = setInterval(async () => {
      try {
        const statusData = await checkOnboardingStatus(id)
        setStatus(statusData)

        if (statusData.status === 'completed') {
          stopPolling()
          notify({ type: 'success', title: 'Pronto!', message: 'Seu daily read está personalizado' })
          navigate('/hoje', { replace: true })
        } else if (statusData.status === 'failed') {
          stopPolling()
          notify({ type: 'error', title: 'Erro', message: statusData.error || 'Falha ao preparar seu daily read' })
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error)
        stopPolling()
        notify({ type: 'error', title: 'Erro', message: 'Perda de conexão com o servidor' })
      }
    }, 2000)

    setPollInterval(interval)
  }, [notify, navigate])

  // Inicia onboarding
  const handleStartOnboarding = async () => {
    if (selectedTopics.size < MIN_TOPICS) {
      notify({ type: 'error', title: 'Selecione ao menos um tópico', message: 'Escolha pelo menos 1 tema para continuar' })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await startOnboarding(Array.from(selectedTopics))
      setJobId(response.jobId)
      notify({ type: 'success', title: 'Iniciando...', message: response.message })
      startPolling(response.jobId)
    } catch (error) {
      console.error('Erro ao iniciar onboarding:', error)
      notify({ type: 'error', title: 'Erro', message: 'Não foi possível iniciar o onboarding' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const stopPolling = useCallback(() => {
    if (pollInterval) {
      clearInterval(pollInterval)
      setPollInterval(null)
    }
  }, [pollInterval])

  // Cleanup no unmount
  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  // Estados de UI
  const isSelectionPhase = !jobId
  const isPollingPhase = jobId && status?.status !== 'completed' && status?.status !== 'failed'
  const isComplete = status?.status === 'completed'

  if (isLoadingTopics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="text-body text-ink-600">Carregando temas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {isSelectionPhase ? (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 text-brand-600 mb-4">
                <Sparkles className="h-8 w-8" />
              </div>
              <h1 className="font-display text-display-lg text-ink-900 mb-3">
                Bem-vindo ao Daily Read
              </h1>
              <p className="text-body-lg text-ink-600 max-w-xl mx-auto">
                Escolha os temas que mais te interessam. Vamos buscar as melhores fontes
                confiáveis para criar sua leitura diária personalizada.
              </p>
            </div>

            {/* Header com contador de sugestões */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-semibold text-heading text-ink-900">
                Temas disponíveis
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-body-sm text-ink-600">
                  {selectedTopics.size} de {SUGGESTED_MAX} sugeridos
                </span>
                <div className="hidden sm:block w-32 h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className="h-full   transition-all duration-300"
                    style={{ width: `${Math.min((selectedTopics.size / SUGGESTED_MAX) * 100, 100)}%`, backgroundColor: 'var(--color-amber-500)' }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="group" aria-label="Tópicos disponíveis">
              {topics.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  isSelected={selectedTopics.has(topic.id)}
                  onToggle={() => toggleTopic(topic.id)}
                  disabled={!selectedTopics.has(topic.id) && selectedTopics.size >= SUGGESTED_MAX}
                />
              ))}
            </div>

            <button
              onClick={handleStartOnboarding}
              disabled={isSubmitting || selectedTopics.size < MIN_TOPICS}
              className="btn-primary w-full py-3 mt-8 text-body lg:max-w-md lg:mx-auto lg:block"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Preparando...</span>
                </>
              ) : (
                `Continuar com ${selectedTopics.size} tema${selectedTopics.size !== 1 ? 's' : ''}`
              )}
            </button>

            <p className="mt-4 text-center text-caption text-ink-500">
              Você pode ajustar seus temas depois em Configurações
            </p>
          </div>
        ) : isPollingPhase ? (
          <div className="animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-100 text-brand-600 mb-6">
              <Loader2 className="h-10 w-10 animate-spin" />
            </div>
            <h2 className="font-display text-display-md text-ink-900 mb-3">
              Preparando seu daily read…
            </h2>
            <p className="text-body text-ink-600 mb-6">
              Estamos buscando as melhores fontes, validando feeds RSS e selecionando
              o primeiro artigo perfeito para você.
            </p>

            {status && (
              <div className="space-y-3 text-sm text-ink-500 max-w-md mx-auto">
                <div className="flex items-center justify-center gap-2 text-ink-600">
                  <span className="font-mono text-brand-600">Job:</span>
                  <span className="font-mono bg-ink-100 px-2 py-1 rounded">{jobId?.slice(0, 12)}…</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <span>Status:</span>
                  <span className="font-medium text-brand-600 capitalize">{status.status}</span>
                </div>
                {status.progress !== undefined && (
                  <div className="w-full max-w-xs mx-auto">
                    <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-600 transition-all duration-300"
                        style={{ width: `${status.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-caption text-ink-500 text-center">
                      {status.progress}% concluído
                    </p>
                  </div>
                )}
                {status.message && (
                  <p className="text-body-sm text-ink-500 italic">{status.message}</p>
                )}
              </div>
            )}

            <p className="mt-8 text-caption text-ink-400">
              Isso pode levar alguns segundos…
            </p>
          </div>
        ) : isComplete ? (
          <div className="animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mb-6">
              <Check className="h-10 w-10" />
            </div>
            <h2 className="font-display text-display-md text-ink-900 mb-3">
              Tudo pronto!
            </h2>
            <p className="text-body text-ink-600">
              Redirecionando para sua leitura diária…
            </p>
          </div>
        ) : (
          <div className="animate-fade-in text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-rose-100 text-rose-600 mb-6">
              <AlertCircle className="h-10 w-10" />
            </div>
            <h2 className="font-display text-display-md text-ink-900 mb-3">
              Algo deu errado
            </h2>
            <p className="text-body text-ink-600 mb-6">
              {status?.error || 'Não foi possível preparar seu daily read. Tente novamente.'}
            </p>
            <button
              onClick={() => {
                setJobId(null)
                setStatus(null)
                setSelectedTopics(new Set())
              }}
              className="btn-secondary"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function TopicCard({ topic, isSelected, onToggle, disabled }: {
  topic: Topic
  isSelected: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`relative group w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
        isSelected
          ? 'border-brand-500 bg-brand-50 shadow-sm'
          : 'border-ink-200 bg-white hover:border-ink-300 hover:shadow-sm'
      } ${disabled && !isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-pressed={isSelected}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isSelected ? (
            <div className="w-5 h-5 rounded border-2 border-brand-500 bg-brand-500 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-black" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded border-2 border-ink-300 bg-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium text-body ${isSelected ? 'text-ink-900' : 'text-ink-700'}`}>
            {topic.name}
          </h3>
          <p className="mt-1 text-body-sm text-ink-500 line-clamp-2">{topic.description}</p>
        </div>
        {disabled && !isSelected && (
          <span className="flex-shrink-0 px-2 py-1 text-caption text-ink-400 bg-ink-100 rounded-full">
            Limite
          </span>
        )}
      </div>
      {isSelected && (
        <div className="absolute inset-0 rounded-xl border-2 border-brand-500/30 animate-pulse" />
      )}
    </button>
  )
}