import { FastifyInstance } from 'fastify'
import { UnauthorizedError } from '@/lib/errors/handler'

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string }
  }
}

export async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('user', null)

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

  // Decorator for optional auth (doesn't throw if no token)
  app.decorate('optionalAuth', async (request: FastifyInstance['request'], reply: FastifyInstance['reply']) => {
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

// Decorator para rotas que requerem autenticação
export async function requireAuth(request: FastifyInstance['request'], reply: FastifyInstance['reply']) {
  if (!request.user) {
    throw new UnauthorizedError('Autenticação necessária')
  }
}