import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const cats = await prisma.category.findMany();
  cats.forEach(c => console.log(c.name, c.id));
}
main().finally(() => prisma.$disconnect());