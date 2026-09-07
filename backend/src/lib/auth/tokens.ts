import { FastifyInstance } from 'fastify'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

export function createAccessToken(app: FastifyInstance, userId: string): string {
  return app.jwt.sign({ userId }, { expiresIn: '15m' })
}

export function createRefreshToken(app: FastifyInstance, userId: string): string {
  const tokenId = randomBytes(16).toString('hex')
  return app.jwt.sign({ userId, tokenId }, { expiresIn: '30d' })
}

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) // 30 days
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt
    }
  })
}

export async function verifyRefreshToken(app: FastifyInstance, token: string): Promise<{ userId: string; tokenId: string }> {
  try {
    return app.jwt.verify(token) as { userId: string; tokenId: string }
  } catch {
    throw new Error('Invalid refresh token')
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revokedAt: new Date() }
  })
}

export async function validateRefreshToken(token: string): Promise<boolean> {
  const stored = await prisma.refreshToken.findUnique({ where: { token } })
  return !!stored && !stored.revokedAt && stored.expiresAt > new Date()
}