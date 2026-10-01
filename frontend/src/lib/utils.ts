import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function containerNarrow(className?: string): string {
  return `max-w-prose mx-auto px-4 sm:px-6 lg:px-8 ${className ?? ''}`
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'agora mesmo'
  if (diffMins < 60) return `${diffMins}min atrás`
  if (diffHours < 24) return `${diffHours}h atrás`
  if (diffDays < 7) return `${diffDays}d atrás`
  return d.toLocaleDateString('pt-BR')
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length - 1) + '…'
}

/**
 * Gera um UUID v4 com fallback para navegadores que não implementam crypto.randomUUID
 * (alguns WebViews Android mais antigos expõem crypto mas sem randomUUID).
 * Usa crypto.getRandomValues que é suportado desde 2012 na maioria dos navegadores.
 */
export function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  // Fallback: constrói UUID v4 manualmente a partir de bytes aleatórios
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // Define versão 4 (UUID) e variante RFC 4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}