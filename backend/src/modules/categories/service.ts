import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function listCategories() {
  return prisma.category.findMany({ orderBy: { name: 'asc' } })
}