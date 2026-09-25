import { apiFetch } from '@/lib/api/client'

// Tipos para o onboarding
export type Topic = {
  id: string
  name: string
  slug: string
  description: string
}

export type OnboardingResponse = {
  jobId: string
  message: string
}

export type OnboardingStatus = {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  message?: string
  error?: string
}

/**
 * Busca a lista de tópicos curados disponíveis
 */
export async function fetchTopics(): Promise<Topic[]> {
  const { data } = await apiFetch<{ topics: Topic[] }>('/api/v1/topics')
  return data.topics
}

/**
 * Envia os tópicos selecionados pelo usuário para iniciar o onboarding assíncrono
 */
export async function startOnboarding(topicIds: string[]): Promise<OnboardingResponse> {
  const { data } = await apiFetch<OnboardingResponse>('/api/v1/topics/my/onboarding', {
    method: 'POST',
    body: JSON.stringify({ topicIds })
  })
  return data
}

/**
 * Verifica o status do job de onboarding
 */
export async function checkOnboardingStatus(jobId: string): Promise<OnboardingStatus> {
  const { data } = await apiFetch<OnboardingStatus>(`/api/v1/topics/my/onboarding/status/${jobId}`)
  return data
}