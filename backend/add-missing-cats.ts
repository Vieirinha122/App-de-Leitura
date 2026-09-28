import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // Adicionar categorias faltantes
  await prisma.category.upsert({
    where: { name: 'Economia' },
    update: {},
    create: { name: 'Economia' }
  });
  console.log('✅ Categoria "Economia" criada/verificada');
  
  await prisma.category.upsert({
    where: { name: 'Psicologia' },
    update: {},
    create: { name: 'Psicologia' }
  });
  console.log('✅ Categoria "Psicologia" criada/verificada');
  
  // Agora atualizar as fontes que faltaram
  const sourceCategoryMap = {
    'Infomoney': 'Economia',
    'Mind Hacks': 'Psicologia',
  };
  
  for (const [sourceName, categoryName] of Object.entries(sourceCategoryMap)) {
    const category = await prisma.category.findUnique({ where: { name: categoryName } });
    const source = await prisma.source.findFirst({ where: { name: sourceName } });
    if (source && category) {
      await prisma.source.update({
        where: { id: source.id },
        data: { categoryId: category.id }
      });
      console.log(`✅ ${sourceName} -> ${categoryName}`);
    }
  }
}
main().finally(() => prisma.$disconnect());