import { api } from '@/lib/api/client'
import type { User } from '@/types/domain'

export async function login(email: string, password: string): Promise<void> {
  await api.post<void>('/api/v1/auth/login', { email, password })
}

export async function register(name: string, email: string, password: string): Promise<void> {
  await api.post<void>('/api/v1/auth/register', { name, email, password })
}

export async function logout(): Promise<void> {
  await api.post<void>('/api/v1/auth/logout', {})
}

export async function refreshToken(): Promise<void> {
  await api.post<void>('/api/v1/auth/refresh', {})
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/api/v1/auth/me')
  return data
}