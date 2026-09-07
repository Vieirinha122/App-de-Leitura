import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly fields?: Record<string, string[]>) {
    super(message, 422, 'VALIDATION_ERROR', fields)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de recurso') {
    super(message, 409, 'CONFLICT')
    this.name = 'ConflictError'
  }
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.id

  // Zod validation errors
  if (error instanceof ZodError) {
    const fields: Record<string, string[]> = {}
    for (const issue of error.issues) {
      const path = issue.path.join('.')
      if (!fields[path]) fields[path] = []
      fields[path].push(issue.message)
    }
    return reply.status(422).send({
      message: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      fields,
      requestId
    })
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[])?.join(', ') ?? 'campo'
      return reply.status(409).send({
        message: `${target} já existe`,
        code: 'CONFLICT',
        requestId
      })
    }
    if (error.code === 'P2025') {
      return reply.status(404).send({
        message: 'Registro não encontrado',
        code: 'NOT_FOUND',
        requestId
      })
    }
  }

  // App errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.code,
      details: error.details,
      requestId
    })
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(422).send({
      message: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      details: error.validation,
      requestId
    })
  }

  // Unknown errors
  request.log.error({ err: error, requestId }, 'Unhandled error')
  return reply.status(500).send({
    message: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR',
    requestId
  })
}