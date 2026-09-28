import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Mapeamento de source name -> category name
const sourceCategoryMap: Record<string, string> = {
  'Simon Willison': 'Programação',
  'Hugging Face Blog': 'AI Engineering',
  'Ahead of AI': 'AI Engineering',
  'The Batch': 'AI Engineering',
  'Martin Fowler': 'Engenharia de Software',
  'InfoQ': 'Engenharia de Software',
  'Latent Space': 'AI Engineering',
  'Aeon': 'Ideias',
  'G1 — Notícias': 'Ciência',
  'Feed principal': 'Ideias',
  'Infomoney': 'Economia',
  'Mind Hacks': 'Psicologia',
};

async function main() {
  console.log('🔄 Atualizando categoryId das fontes existentes...');
  
  for (const [sourceName, categoryName] of Object.entries(sourceCategoryMap)) {
    const category = await prisma.category.findUnique({ where: { name: categoryName } });
    if (!category) {
      console.log(`⚠️ Categoria "${categoryName}" não encontrada para source "${sourceName}"`);
      continue;
    }
    
    const source = await prisma.source.findFirst({ where: { name: sourceName } });
    if (!source) {
      console.log(`⚠️ Source "${sourceName}" não encontrado`);
      continue;
    }
    
    await prisma.source.update({
      where: { id: source.id },
      data: { categoryId: category.id }
    });
    
    console.log(`✅ ${sourceName} -> ${categoryName} (${category.id})`);
  }
  
  console.log('✅ Atualização concluída!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });