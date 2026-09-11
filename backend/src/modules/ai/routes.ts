import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/plugin'
import { prisma } from '@/lib/prisma'
import { explicarArtigo, gerarPerguntasArtigo, gerarResumoArtigo } from './openai-client'

const articleBody = z.object({ articleId: z.string() })
const limitePorRota = { max: 10, timeWindow: '1 minute' }

async function contextoDoArtigo(articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId }, include: { source: true } })
  if (!article) throw new Error('Artigo não encontrado')
  return article
}

export async function aiRoutes(app: FastifyInstance) {
  // Gera ou recupera o resumo cacheado do artigo.
  app.post('/ai/summarize', { schema: { body: articleBody, tags: ['AI'] }, config: { rateLimit: limitePorRota }, preHandler: [requireAuth] }, async (request) => {
    const { articleId } = request.body as z.infer<typeof articleBody>
    const article = await contextoDoArtigo(articleId)
    if (article.aiSummary) return article.aiSummary
    const result = await gerarResumoArtigo({ title: article.title, summary: article.summary, source: article.source.name })
    await prisma.article.update({ where: { id: articleId }, data: { aiSummary: result } })
    return result
  })

  // Gera ou recupera perguntas de fixação cacheadas do artigo.
  app.post('/ai/questions', { schema: { body: articleBody, tags: ['AI'] }, config: { rateLimit: limitePorRota }, preHandler: [requireAuth] }, async (request) => {
    const { articleId } = request.body as z.infer<typeof articleBody>
    const article = await contextoDoArtigo(articleId)
    if (article.aiQuestions) return article.aiQuestions
    const result = await gerarPerguntasArtigo({ title: article.title, summary: article.summary, source: article.source.name })
    await prisma.article.update({ where: { id: articleId }, data: { aiQuestions: result } })
    return result
  })

  // Gera ou recupera a explicação contextual cacheada do artigo.
  app.post('/ai/explain', { schema: { body: articleBody, tags: ['AI'] }, config: { rateLimit: limitePorRota }, preHandler: [requireAuth] }, async (request) => {
    const { articleId } = request.body as z.infer<typeof articleBody>
    const article = await contextoDoArtigo(articleId)
    if (article.aiExplanation) return { explanation: article.aiExplanation, language: 'pt-BR' as const }
    const result = await explicarArtigo({ title: article.title, summary: article.summary, source: article.source.name })
    await prisma.article.update({ where: { id: articleId }, data: { aiExplanation: result.explanation } })
    return result
  })
}