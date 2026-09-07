import { FastifyReply } from 'fastify'
import { env } from '@/lib/config/env'

const isProduction = env.NODE_ENV === 'production'

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/'
}

const accessTokenOptions = {
  ...cookieOptions,
  maxAge: 15 * 60 // 15 minutes
}

const refreshTokenOptions = {
  ...cookieOptions,
  maxAge: 30 * 24 * 60 * 60 // 30 days
}

export function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string): void {
  reply.setCookie('accessToken', accessToken, accessTokenOptions)
  reply.setCookie('refreshToken', refreshToken, refreshTokenOptions)
}

export function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie('accessToken', { ...cookieOptions, path: '/' })
  reply.clearCookie('refreshToken', { ...cookieOptions, path: '/' })
}

export function getAccessToken(reply: FastifyReply): string | undefined {
  return reply.request?.cookies?.accessToken
}

export function getRefreshToken(reply: FastifyReply): string | undefined {
  return reply.request?.cookies?.refreshToken
}