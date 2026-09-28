import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { discoverAndSaveSourcesForTopics } from './ai-discovery.js'
import { syncSourcesForUserTopics } from './sync-service.js'

const prisma = new PrismaClient()

/**
 * Schema para o onboarding de tópicos do usuário
 * CUIDs do Prisma: começam com 'c' seguido de 24 chars alfanuméricos
 */
export const onboardingTopicsSchema = z.object({
  topicIds: z.array(z.string().regex(/^c[a-z0-9]{24}$/, 'ID de tópico inválido')).min(1, 'Selecione pelo menos um tópico').max(10, 'Máximo 10 tópicos')
})

export type OnboardingTopicsInput = z.infer<typeof onboardingTopicsSchema>

/**
 * Armazena status dos jobs de onboarding em memória
 * Em produção, usar BullMQ/Redis ou tabela de jobs no banco
 */
interface OnboardingJob {
  status: 'processing' | 'completed' | 'failed'
  progress: number
  result?: { message: string; sourcesCreated: number; articlesImported: number }
  error?: string
}

const onboardingJobs = new Map<string, OnboardingJob>()

/**
 * Lista todos os tópicos disponíveis (curados)
 */
export async function listTopics() {
  return prisma.topic.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true
    }
  })
}

/**
 * Retorna os tópicos selecionados pelo usuário autenticado
 */
export async function getMyTopics(userId: string) {
  return prisma.userTopic.findMany({
    where: { userId },
    include: {
      topic: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true
        }
      }
    },
    orderBy: { topic: { name: 'asc' } }
  })
}

/**
 * Processa o onboarding de tópicos do usuário
 * - Valida se os tópicos existem
 * - Remove tópicos antigos do usuário
 * - Cria novos UserTopic
 * - Marca onboardingCompleted = true no User
 * - Dispara job assíncrono para descoberta de fontes + sync RSS
 * - Retorna jobId para polling do frontend
 */
export async function processOnboarding(userId: string, input: OnboardingTopicsInput) {
  // Verifica se os tópicos existem
  const topics = await prisma.topic.findMany({
    where: { id: { in: input.topicIds } },
    select: { id: true }
  })

  if (topics.length !== input.topicIds.length) {
    const foundIds = new Set(topics.map(t => t.id))
    const missing = input.topicIds.filter(id => !foundIds.has(id))
    throw new Error(`Tópicos não encontrados: ${missing.join(', ')}`)
  }

  // Transação: limpa antigos + cria novos + marca onboarding completo
  await prisma.$transaction(async (tx) => {
    // Remove tópicos anteriores do usuário
    await tx.userTopic.deleteMany({ where: { userId } })

    // Cria novos UserTopic
    await tx.userTopic.createMany({
      data: input.topicIds.map(topicId => ({ userId, topicId }))
    })

    // Marca onboarding como completo
    await tx.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true }
    })
  })

  // Cria job de onboarding
  const jobId = `onboarding-${userId}-${Date.now()}`
  onboardingJobs.set(jobId, { status: 'processing', progress: 0 })

  // Dispara processamento assíncrono (não bloqueia a resposta)
  setImmediate(async () => {
    try {
      const job = onboardingJobs.get(jobId)
      if (!job) return

      console.log(`🚀 Iniciando job de onboarding ${jobId} para user ${userId}`)

      // Etapa 1: AI Discovery - descobre e salva fontes para os tópicos
      job.progress = 10
      onboardingJobs.set(jobId, job)

      const discoveryResult = await discoverAndSaveSourcesForTopics(input.topicIds)
      console.log(`🔍 Discovery concluído: ${discoveryResult.sourcesCreated} fontes criadas, ${discoveryResult.sourcesLinked} vinculadas`)

      // Falha explícita se nenhuma fonte foi criada/vinculada
      if (discoveryResult.sourcesCreated === 0 && discoveryResult.sourcesLinked === 0) {
        const errorMsg = 'Nenhuma fonte válida foi encontrada para os tópicos selecionados. Verifique logs do discovery.'
        console.error(`❌ ${errorMsg}`)
        throw new Error(errorMsg)
      }

      job.progress = 50
      onboardingJobs.set(jobId, job)

      // Etapa 2: Sync - sincroniza artigos das fontes dos tópicos do usuário
      const syncResult = await syncSourcesForUserTopics(userId)
      console.log(`🔄 Sync concluído: ${syncResult.totalImported} artigos importados de ${syncResult.totalSources} fontes`)

      job.progress = 90
      onboardingJobs.set(jobId, job)

      // Etapa 3: Gera primeira recomendação diária (opcional, pode ser feito pelo cron)
      // A daily recommendation já busca automaticamente dos tópicos do usuário

      // Marca como concluído
      onboardingJobs.set(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          message: 'Onboarding concluído com sucesso',
          sourcesCreated: discoveryResult.sourcesCreated,
          articlesImported: syncResult.totalImported
        }
      })

      console.log(`✅ Job ${jobId} concluído com sucesso`)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido no onboarding'
      console.error(`❌ Erro no job ${jobId}:`, msg)
      onboardingJobs.set(jobId, {
        status: 'failed',
        progress: 100,
        error: msg
      })
    }
  })

  return { jobId, status: 'processing' }
}

/**
 * Verifica status do job de onboarding (para polling do frontend)
 */
export async function getOnboardingStatus(jobId: string) {
  const job = onboardingJobs.get(jobId)

  if (!job) {
    return { status: 'failed', error: 'Job não encontrado ou expirado' }
  }

  return {
    status: job.status,
    progress: job.progress,
    result: job.result,
    error: job.error
  }
}