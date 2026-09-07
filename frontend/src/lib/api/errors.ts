export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
    public readonly requestId?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Não autorizado', requestId?: string) {
    super(message, 401, 'UNAUTHORIZED', undefined, requestId)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Acesso negado', requestId?: string) {
    super(message, 403, 'FORBIDDEN', undefined, requestId)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Não encontrado', requestId?: string) {
    super(message, 404, 'NOT_FOUND', undefined, requestId)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends ApiError {
  constructor(
    message = 'Dados inválidos',
    public readonly fields?: Record<string, string[]>,
    requestId?: string
  ) {
    super(message, 422, 'VALIDATION_ERROR', fields, requestId)
    this.name = 'ValidationError'
  }
}

export class ServerError extends ApiError {
  constructor(message = 'Erro interno do servidor', requestId?: string) {
    super(message, 500, 'SERVER_ERROR', undefined, requestId)
    this.name = 'ServerError'
  }
}

type ErrorPayload = {
  message?: string
  code?: string
  details?: unknown
  fields?: Record<string, string[]>
}

export function parseApiError(payload: unknown, status: number, requestId?: string): ApiError {
  const error = payload as ErrorPayload | null

  if (status === 401) {
    return new UnauthorizedError(error?.message, requestId)
  }

  if (status === 403) {
    return new ForbiddenError(error?.message, requestId)
  }

  if (status === 404) {
    return new NotFoundError(error?.message, requestId)
  }

  if (status === 422) {
    return new ValidationError(error?.message, error?.fields, requestId)
  }

  if (status >= 500) {
    return new ServerError(error?.message, requestId)
  }

  return new ApiError(
    error?.message ?? `Erro HTTP ${status}`,
    status,
    error?.code,
    error?.details,
    requestId
  )
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}