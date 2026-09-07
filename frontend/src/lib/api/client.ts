import { parseApiError, type ApiError } from './errors'

export type ApiResult<T> = {
  data: T
  totalCount: number | null
  requestId: string
}

const AUTH_SKIP_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password'
])

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? '/api'
}

function isAuthSkipPath(path: string): boolean {
  return [...AUTH_SKIP_PATHS].some((suffix) => path.endsWith(suffix) || path.includes(suffix))
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${apiBase()}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    })
    return response.ok
  } catch {
    return false
  }
}

async function authorizedRequest(
  path: string,
  init: RequestInit = {},
  options: { retryOnUnauthorized?: boolean } = {}
): Promise<Response> {
  const requestId = crypto.randomUUID()
  const headers = new Headers(init.headers)

  headers.set('X-Request-ID', requestId)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  })

  // Handle 401 with automatic refresh (except for auth endpoints)
  if (
    response.status === 401 &&
    options.retryOnUnauthorized !== false &&
    !isAuthSkipPath(path)
  ) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      // Retry original request once with new token
      return authorizedRequest(path, init, { retryOnUnauthorized: false })
    }
    // Refresh failed - clear auth state (handled by auth store)
  }

  return response
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: { retryOnUnauthorized?: boolean } = {}
): Promise<ApiResult<T>> {
  const response = await authorizedRequest(path, init, options)
  const requestId = response.headers.get('X-Request-ID') ?? ''
  const totalHeader = response.headers.get('X-Total-Count')
  const totalCount = totalHeader !== null ? Number.parseInt(totalHeader, 10) : null

  if (response.status === 204) {
    return { data: undefined as T, totalCount, requestId }
  }

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as unknown) : null

  if (!response.ok) {
    throw parseApiError(payload, response.status, requestId)
  }

  return { data: payload as T, totalCount, requestId }
}

export type ApiBlobResult = {
  blob: Blob
  filename: string | null
}

function filenameFromDisposition(value: string | null): string | null {
  if (!value) return null
  const match = /filename="?([^";]+)"?/i.exec(value)
  return match?.[1] ?? null
}

export async function apiFetchBlob(path: string, init: RequestInit = {}): Promise<ApiBlobResult> {
  const response = await authorizedRequest(path, init)
  if (!response.ok) {
    const text = await response.text()
    const payload = text ? (JSON.parse(text) as unknown) : null
    throw parseApiError(payload, response.status)
  }
  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get('Content-Disposition'))
  }
}

export async function apiFetchVoid(path: string, init: RequestInit = {}): Promise<void> {
  await apiFetch<undefined>(path, init)
}

// Convenience methods
export const api = {
  get: <T>(path: string, options?: { retryOnUnauthorized?: boolean }) =>
    apiFetch<T>(path, { method: 'GET' }, options),

  post: <T>(path: string, body: unknown, options?: { retryOnUnauthorized?: boolean }) =>
    apiFetch<T>(
      path,
      { method: 'POST', body: JSON.stringify(body) },
      options
    ),

  put: <T>(path: string, body: unknown, options?: { retryOnUnauthorized?: boolean }) =>
    apiFetch<T>(
      path,
      { method: 'PUT', body: JSON.stringify(body) },
      options
    ),

  patch: <T>(path: string, body: unknown, options?: { retryOnUnauthorized?: boolean }) =>
    apiFetch<T>(
      path,
      { method: 'PATCH', body: JSON.stringify(body) },
      options
    ),

  delete: <T>(path: string, options?: { retryOnUnauthorized?: boolean }) =>
    apiFetch<T>(path, { method: 'DELETE' }, options)
}