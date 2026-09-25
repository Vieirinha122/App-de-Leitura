import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/plugin'
import { listTopics, getMyTopics, processOnboarding, getOnboardingStatus, onboardingTopicsSchema } from './service.js'

/**
 * Rotas de tópicos (onboarding e preferências)
 * Todas protegidas por autenticação (exceto listagem pública de tópicos curados)
 */
export async function topicsRoutes(app: FastifyInstance) {
  /**
   * GET /topics
   * Lista todos os tópicos curados disponíveis (público)
   * Usado na tela de onboarding /boas-vindas
   */
  app.get('/topics', async (_req: FastifyRequest, reply: FastifyReply) => {
    const topics = await listTopics()
    return reply.send({ topics })
  })

  /**
   * GET /topics/my
   * Retorna tópicos selecionados pelo usuário autenticado
   * Requer autenticação
   */
  app.get('/topics/my', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user.id
    const userTopics = await getMyTopics(userId)
    return reply.send({ topics: userTopics.map(ut => ut.topic) })
  })

  /**
   * POST /topics/my/onboarding
   * Processa onboarding de tópicos do usuário
   * - Valida tópicos selecionados
   * - Salva UserTopic + marca onboardingCompleted
   * - Dispara job assíncrono de descoberta de fontes + sync RSS
   * - Retorna jobId para polling
   * Requer autenticação
   */
  app.post('/topics/my/onboarding', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user.id

    // Valida body com Zod
    const parseResult = onboardingTopicsSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        details: parseResult.error.flatten().fieldErrors
      })
    }

    try {
      const result = await processOnboarding(userId, parseResult.data)
      return reply.status(202).send(result) // 202 Accepted - processamento assíncrono
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao processar onboarding'
      return reply.status(400).send({ error: message })
    }
  })

  /**
   * GET /topics/my/onboarding/status/:jobId
   * Polling de status do job de onboarding
   * Frontend chama repetidamente até status = 'completed'
   * Requer autenticação
   */
  app.get('/topics/my/onboarding/status/:jobId', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { jobId } = req.params as { jobId: string }
    const status = await getOnboardingStatus(jobId)
    return reply.send(status)
  })

  /**
   * PUT /topics/my
   * Atualiza tópicos do usuário (para tela de preferências futura)
   * Requer autenticação
   */
  const updateMyTopicsSchema = z.object({
    topicIds: z.array(z.string().regex(/^c[a-z0-9]{24}$/, 'ID de tópico inválido')).min(1).max(10)
  })

  app.put('/topics/my', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user.id

    const parseResult = updateMyTopicsSchema.safeParse(req.body)
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Dados inválidos',
        details: parseResult.error.flatten().fieldErrors
      })
    }

    // Reutiliza a mesma lógica do onboarding (substitui tópicos)
    try {
      const result = await processOnboarding(userId, parseResult.data)
      return reply.send({ ...result, message: 'Tópicos atualizados com sucesso' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar tópicos'
      return reply.status(400).send({ error: message })
    }
  })
}