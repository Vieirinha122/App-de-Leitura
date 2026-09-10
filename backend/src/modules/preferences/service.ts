import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function listPreferences(userId: string) {
  return prisma.userPreference.findMany({ where: { userId } })
}

export async function setPreference(userId: string, kind: 'source' | 'category', targetId: string, blocked: boolean, weight: number) {
  return prisma.userPreference.upsert({
    where: { userId_kind_targetId: { userId, kind, targetId } },
    update: { blocked, weight },
    create: { userId, kind, targetId, blocked, weight }
  })
}