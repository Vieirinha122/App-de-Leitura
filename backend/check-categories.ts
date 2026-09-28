import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const articles = await prisma.article.findMany({
    take: 10,
    include: { category: true },
    orderBy: { createdAt: 'desc' }
  });
  articles.forEach(a => {
    console.log('Article:', a.title?.substring(0, 50));
    console.log('  categoryId:', a.categoryId);
    console.log('  category:', a.category?.name || 'NULL');
    console.log('---');
  });
  const count = await prisma.article.count();
  console.log('Total articles:', count);
  const withCat = await prisma.article.count({ where: { categoryId: { not: null } } });
  console.log('Articles with categoryId:', withCat);
  const withoutCat = await prisma.article.count({ where: { categoryId: null } });
  console.log('Articles without categoryId:', withoutCat);
}
main().finally(() => prisma.$disconnect());