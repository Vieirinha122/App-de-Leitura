import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { app } from '@/app'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { createAccessToken } from '@/lib/auth/tokens'

// Teste de integração para POST /api/v1/topics/my/onboarding
describe('POST /api/v1/topics/my/onboarding', () => {
  let testUser: { id: string; name: string; email: string; passwordHash: string }
  let accessToken: string

  beforeAll(async () => {
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    // Limpa banco antes de cada teste
    await prisma.userTopic.deleteMany()
    await prisma.sourceTopic.deleteMany()
    await prisma.topic.deleteMany()
    await prisma.user.deleteMany()
    await prisma.source.deleteMany()
    await prisma.refreshToken.deleteMany()

    // Cria tópicos necessários para os testes
    await prisma.topic.createMany({
      data: [
        { name: 'Tecnologia', slug: 'tecnologia', description: 'Tech' },
        { name: 'Ciência', slug: 'ciencia', description: 'Science' },
        { name: 'Filosofia', slug: 'filosofia', description: 'Philosophy' },
      ],
    })

    // Cria usuário de teste
    const passwordHash = await hashPassword('senha123456')
    testUser = await prisma.user.create({
      data: {
        name: 'Usuário Teste',
        email: 'teste@email.com',
        passwordHash,
      },
    })

    // Gera access token
    accessToken = createAccessToken(app, testUser.id)
  })

  it('deve retornar 400 se body estiver vazio', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      cookies: {
        accessToken,
      },
      payload: {},
    })

    expect(response.statusCode).toBe(400)
  })

  it('deve retornar 400 se topicIds não for array', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      cookies: {
        accessToken,
      },
      payload: {
        topicIds: 'não-é-array',
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('deve retornar 400 se topicIds estiver vazio', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      cookies: {
        accessToken,
      },
      payload: {
        topicIds: [],
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('deve retornar 400 se topicIds tiver mais de 10 itens', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      cookies: {
        accessToken,
      },
      payload: {
        topicIds: Array(11).fill('topic-id'),
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it('deve retornar 404 se algum topicId não existir', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      cookies: {
        accessToken,
      },
      payload: {
        topicIds: ['topic-inexistente-1', 'topic-inexistente-2'],
      },
    })

    expect(response.statusCode).toBe(404)
  })

  it('deve criar UserTopic e retornar jobId quando topics válidos são enviados', async () => {
    // Cria topics no banco
    const topic1 = await prisma.topic.create({
      data: { name: 'Tecnologia', slug: 'tecnologia' },
    })
    const topic2 = await prisma.topic.create({
      data: { name: 'Ciência', slug: 'ciencia' },
    })
    const topic3 = await prisma.topic.create({
      data: { name: 'Filosofia', slug: 'filosofia' },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      cookies: {
        accessToken,
      },
      payload: {
        topicIds: [topic1.id, topic2.id, topic3.id],
      },
    })

    expect(response.statusCode).toBe(202)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('jobId')
    expect(typeof body.jobId).toBe('string')

    // Verifica se UserTopic foi criado
    const userTopics = await prisma.userTopic.findMany({
      where: { userId: testUser.id },
    })
    expect(userTopics).toHaveLength(3)
  })

  it('não deve duplicar UserTopic se onboarding for chamado duas vezes', async () => {
    const topic1 = await prisma.topic.create({
      data: { name: 'Tecnologia', slug: 'tecnologia' },
    })
    const topic2 = await prisma.topic.create({
      data: { name: 'Ciência', slug: 'ciencia' },
    })

    // Primeira chamada
    await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      cookies: { accessToken },
      payload: { topicIds: [topic1.id, topic2.id] },
    })

    // Segunda chamada com mesmo usuário
    await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      cookies: { accessToken },
      payload: { topicIds: [topic1.id] },
    })

    const userTopics = await prisma.userTopic.findMany({
      where: { userId: testUser.id },
    })
    // Deve manter os 2 topics originais (idempotente)
    expect(userTopics).toHaveLength(2)
  })

  it('deve retornar 401 se não autenticado', async () => {
    const topic = await prisma.topic.create({
      data: { name: 'Tecnologia', slug: 'tecnologia' },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/topics/my/onboarding',
      payload: { topicIds: [topic.id] },
    })

    expect(response.statusCode).toBe(401)
  })
})