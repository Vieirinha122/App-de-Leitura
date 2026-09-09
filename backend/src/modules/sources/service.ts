import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export type SourceInput = {
  name: string
  url: string
  feedUrl?: string
  type: 'rss' | 'newsletter' | 'manual' | 'api'
  enabled?: boolean
}

export async function listSources() {
  return prisma.source.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { name: 'asc' }
  })
}

export async function getSource(id: string) {
  return prisma.source.findUnique({
    where: { id },
    include: { _count: { select: { articles: true } } }
  })
}

export async function createSource(input: SourceInput) {
  return prisma.source.create({
    data: input,
    include: { _count: { select: { articles: true } } }
  })
}

export async function updateSource(id: string, input: Partial<SourceInput>) {
  return prisma.source.update({
    where: { id },
    data: input,
    include: { _count: { select: { articles: true } } }
  })
}

export async function deleteSource(id: string) {
  return prisma.source.delete({ where: { id } })
}