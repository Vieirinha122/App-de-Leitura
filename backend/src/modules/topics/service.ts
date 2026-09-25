import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

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
 * - Retorna jobId para polling do processamento assíncrono (descoberta de fontes + sync)
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

  // TODO: Disparar job assíncrono para:
  // 1. AI-assisted source discovery por tópico
  // 2. Validação RSS via discovery-service
  // 3. Salvar Sources + SourceTopics
  // 4. Rodar sync RSS inicial
  // 5. Gerar primeira recomendação diária
  // Por enquanto retorna jobId mock para o polling do frontend
  const jobId = `onboarding-${userId}-${Date.now()}`

  return { jobId, status: 'processing' }
}

/**
 * Verifica status do job de onboarding (para polling do frontend)
 */
export async function getOnboardingStatus(jobId: string) {
  // TODO: Implementar verificação real via BullMQ/Redis ou tabela de jobs
  // Por enquanto retorna concluído após 2 segundos (simulação)
  const timestamp = parseInt(jobId.split('-').pop() || '0')
  const elapsed = Date.now() - timestamp

  if (elapsed >= 2000) {
    return { status: 'completed', result: { message: 'Onboarding concluído com sucesso' } }
  }

  return { status: 'processing', progress: Math.min(90, Math.floor(elapsed / 20)) }
}