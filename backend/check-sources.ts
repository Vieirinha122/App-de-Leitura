import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const sources = await prisma.source.findMany({ include: { category: true } });
  sources.forEach(s => {
    console.log('Source:', s.name, '| categoryId:', s.categoryId, '| category:', s.category?.name || 'NULL');
  });
}
main().finally(() => prisma.$disconnect());