import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError } from '@/lib/errors/handler'
import { PrismaClient } from '@prisma/client'

import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: { id: string; email: string }
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    optionalAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export async function authPlugin(app: FastifyInstance) {
  if (!app.hasRequestDecorator('user')) {
    app.decorateRequest('user', null)
  }

  app.addHook('preHandler', async (request, reply) => {
    // Skip auth for public routes
    const publicPaths = [
      '/api/health',
      '/api/health/ready',
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/docs',
      '/docs/',
      '/docs/json',
      '/docs/yaml'
    ]

    if (publicPaths.some(p => request.url.startsWith(p))) {
      return
    }

    // Try to get user from access token (cookie or header)
    const accessToken = request.cookies.accessToken || request.headers.authorization?.replace('Bearer ', '')
    if (!accessToken) {
      throw new UnauthorizedError('Token de acesso não fornecido')
    }

    try {
      const decoded = app.jwt.verify(accessToken) as { userId: string }
      const user = await app.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      })
      if (!user) {
        throw new UnauthorizedError('Usuário não encontrado')
      }
      request.user = { id: user.id, email: user.email }
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err
      throw new UnauthorizedError('Token de acesso inválido ou expirado')
    }
  })

  if (!app.hasDecorator('optionalAuth')) {
    app.decorate('optionalAuth', async (request: FastifyRequest, reply: FastifyReply) => {
      const accessToken = request.cookies.accessToken || request.headers.authorization?.replace('Bearer ', '')
      if (!accessToken) return

      try {
        const decoded = app.jwt.verify(accessToken) as { userId: string }
        const user = await app.prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, email: true }
        })
        if (user) request.user = { id: user.id, email: user.email }
      } catch {
        // Silently ignore - optional auth
      }
    })
  }
}

// Decorator para rotas que requerem autenticação
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    throw new UnauthorizedError('Autenticação necessária')
  }
}