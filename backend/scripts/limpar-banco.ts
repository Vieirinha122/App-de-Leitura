import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function limparBanco() {
  console.log('🔍 Buscando artigos com URLs de exemplo...')

  // 1. Artigos com URLs de exemplo (example.com, localhost, test, etc)
  const urlsExemplo = [
    'example.com',
    'localhost',
    'test.',
    'dummy',
    'placeholder',
    'sample',
  ]

  const artigosExemplo = await prisma.article.findMany({
    where: {
      OR: urlsExemplo.map((url) => ({
        url: { contains: url, mode: 'insensitive' },
      })),
    },
    select: { id: true, title: true, url: true, publishedAt: true },
  })

  console.log(`\n📋 Encontrados ${artigosExemplo.length} artigos com URLs de exemplo:`)
  artigosExemplo.forEach((a) => console.log(`  - ${a.title} (${a.url})`))

  if (artigosExemplo.length > 0) {
    const idsExemplo = artigosExemplo.map((a) => a.id)
    await prisma.readingHistory.deleteMany({ where: { articleId: { in: idsExemplo } } })
    await prisma.article.deleteMany({ where: { id: { in: idsExemplo } } })
    console.log(`🗑️  ${artigosExemplo.length} artigos de exemplo removidos`)
  }

  // 2. Artigos muito antigos (antes de 2023) e não lidos
  const dataCorte = new Date('2023-01-01')
  const artigosAntigos = await prisma.article.findMany({
    where: {
      publishedAt: { lt: dataCorte },
      history: { none: {} },
    },
    select: { id: true, title: true, publishedAt: true, source: { select: { name: true } } },
  })

  console.log(`\n📋 Encontrados ${artigosAntigos.length} artigos antes de 2023 (não lidos):`)
  artigosAntigos.forEach((a) => console.log(`  - ${a.title} (${a.publishedAt?.toISOString().split('T')[0]}) [${a.source.name}]`))

  if (artigosAntigos.length > 0) {
    const confirmar = process.argv.includes('--confirm')
    if (!confirmar) {
      console.log('\n⚠️  Para confirmar a exclusão, rode com: npx tsx scripts/limpar-banco.ts --confirm')
      console.log('   (Isso remove permanentemente artigos não lidos publicados antes de 2023)')
      return
    }

    const idsAntigos = artigosAntigos.map((a) => a.id)
    await prisma.readingHistory.deleteMany({ where: { articleId: { in: idsAntigos } } })
    await prisma.article.deleteMany({ where: { id: { in: idsAntigos } } })
    console.log(`🗑️  ${artigosAntigos.length} artigos antigos removidos`)
  }

  // Estatísticas finais
  const total = await prisma.article.count()
  const comFeed = await prisma.article.count({
    where: { source: { feedUrl: { not: null } } },
  })
  console.log(`\n📊 Total de artigos no banco: ${total}`)
  console.log(`\n📊 Com feedUrl: ${comFeed}`)

  await prisma.$disconnect()
}

limparBanco().catch(console.error)