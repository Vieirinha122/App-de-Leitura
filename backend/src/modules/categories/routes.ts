import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/plugin'
import { listCategories } from './service'

export async function categoriesRoutes(app: FastifyInstance) {
  app.get('/categories', {
    schema: {
      response: { 200: z.array(z.object({ id: z.string(), name: z.string() })) },
      tags: ['Categories'],
      summary: 'Listar categorias'
    },
    preHandler: [requireAuth]
  }, async () => listCategories())
}