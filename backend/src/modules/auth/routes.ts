import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { createAccessToken, createRefreshToken, verifyRefreshToken, storeRefreshToken, revokeRefreshToken } from '@/lib/auth/tokens'
import { setAuthCookies, clearAuthCookies } from '@/lib/auth/cookies'
import { UnauthorizedError, ValidationError } from '@/lib/errors/handler'
import { requireAuth } from '@/lib/auth/plugin'

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
})

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128)
  })
})

const meResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string().datetime()
})

const authResponse = z.object({
  user: meResponse
})

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/register
  app.post('/register', {
    schema: {
      body: registerSchema.shape.body,
      response: { 201: authResponse },
      tags: ['Auth'],
      summary: 'Registrar novo usuário'
    }
  }, async (request, reply) => {
    const { name, email, password } = request.body as z.infer<typeof registerSchema>['body']

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ValidationError('Email já cadastrado', { email: ['Este email já está em uso'] })
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true, createdAt: true }
    })

    const accessToken = createAccessToken(app, user.id)
    const refreshToken = createRefreshToken(app, user.id)
    await storeRefreshToken(user.id, refreshToken)
    setAuthCookies(reply, accessToken, refreshToken)

    return reply.status(201).send({
      user: {
        ...user,
        createdAt: user.createdAt.toISOString()
      }
    })
  })

  // POST /api/v1/auth/login
  app.post('/login', {
    schema: {
      body: loginSchema.shape.body,
      response: { 200: authResponse },
      tags: ['Auth'],
      summary: 'Login do usuário'
    }
  }, async (request, reply) => {
    const { email, password } = request.body as z.infer<typeof loginSchema>['body']

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      throw new UnauthorizedError('Credenciais inválidas')
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      throw new UnauthorizedError('Credenciais inválidas')
    }

    const accessToken = createAccessToken(app, user.id)
    const refreshToken = createRefreshToken(app, user.id)
    await storeRefreshToken(user.id, refreshToken)
    setAuthCookies(reply, accessToken, refreshToken)

    return { user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt.toISOString() } }
  })

  // POST /api/v1/auth/logout
  app.post('/logout', {
    schema: {
      response: { 200: z.object({ success: z.boolean() }) },
      tags: ['Auth'],
      summary: 'Logout do usuário'
    }
  }, async (request, reply) => {
    const refreshToken = request.cookies?.refreshToken
    clearAuthCookies(reply)

    if (refreshToken) {
      void revokeRefreshToken(refreshToken).catch((error) => {
        request.log.warn({ err: error }, 'Failed to revoke refresh token during logout')
      })
    }

    return { success: true }
  })

  // POST /api/v1/auth/refresh
  app.post('/refresh', {
    schema: {
      response: { 200: z.object({ success: z.literal(true) }) },
      tags: ['Auth'],
      summary: 'Renovar access token via refresh token (cookie HttpOnly)'
    }
  }, async (request, reply) => {
    const refreshToken = request.cookies.refreshToken
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token não fornecido')
    }

    let payload: { userId: string; tokenId: string }
    try {
      payload = await verifyRefreshToken(app, refreshToken)
    } catch {
      throw new UnauthorizedError('Refresh token inválido ou expirado')
    }

    // Verifica se o token existe e não foi revogado
    const isValid = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
      .then((t: any) => !!t && !t.revokedAt && t.expiresAt > new Date())
    if (!isValid) {
      throw new UnauthorizedError('Refresh token revogado ou expirado')
    }

    // Rotaciona: revoga o atual e cria novo (reuse detection)
    await revokeRefreshToken(refreshToken)

    const newAccessToken = createAccessToken(app, payload.userId)
    const newRefreshToken = createRefreshToken(app, payload.userId)
    await storeRefreshToken(payload.userId, newRefreshToken)
    setAuthCookies(reply, newAccessToken, newRefreshToken)

    return { success: true as const }
  })

  // GET /api/v1/auth/me
  app.get('/me', {
    schema: {
      response: { 200: meResponse },
      tags: ['Auth'],
      summary: 'Obter usuário autenticado',
      security: [{ cookieAuth: [] }]
    },
    preHandler: [requireAuth]
  }, async (request) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { id: true, name: true, email: true, createdAt: true }
    })
    if (!user) throw new UnauthorizedError('Usuário não encontrado')
    return { ...user, createdAt: user.createdAt.toISOString() }
  })
}
