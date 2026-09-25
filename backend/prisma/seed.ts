import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const sources = [
  { name: 'Simon Willison', url: 'https://simonwillison.net', feedUrl: 'https://simonwillison.net/atom/everything/', type: 'rss' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog', feedUrl: 'https://huggingface.co/blog/rss.xml', type: 'rss' },
  { name: 'Ahead of AI', url: 'https://magazine.sebastianraschka.com', feedUrl: 'https://magazine.sebastianraschka.com/feed', type: 'rss' },
  { name: 'The Batch', url: 'https://www.deeplearning.ai/the-batch/', feedUrl: 'https://www.deeplearning.ai/the-batch/feed/', type: 'rss' },
  { name: 'Martin Fowler', url: 'https://martinfowler.com', feedUrl: 'https://martinfowler.com/feed.atom', type: 'rss' },
  { name: 'InfoQ', url: 'https://www.infoq.com', feedUrl: 'https://feed.infoq.com', type: 'rss' },
  { name: 'Latent Space', url: 'https://www.latent.space', feedUrl: 'https://www.latent.space/feed', type: 'rss' },
  { name: 'Aeon', url: 'https://aeon.co', feedUrl: 'https://aeon.co/feed.rss', type: 'rss' }
]

const categories = [
  'Programação',
  'Engenharia de Software',
  'AI Engineering',
  'Machine Learning',
  'LLMs',
  'Ciência',
  'Ideias'
]

const topics = [
  { name: 'Tecnologia', slug: 'tecnologia', description: 'Novidades em programação, ferramentas, frameworks e engenharia de software' },
  { name: 'Ciência', slug: 'ciencia', description: 'Descobertas científicas, pesquisa, física, biologia, astronomia' },
  { name: 'Filosofia', slug: 'filosofia', description: 'Pensamento crítico, ética, lógica, história das ideias' },
  { name: 'História', slug: 'historia', description: 'Eventos históricos, civilizações, biografias, arqueologia' },
  { name: 'Economia', slug: 'economia', description: 'Mercados, finanças, macroeconomia, negócios, investimentos' },
  { name: 'Psicologia', slug: 'psicologia', description: 'Comportamento humano, saúde mental, neurociência, cognição' },
  { name: 'Meio Ambiente', slug: 'meio-ambiente', description: 'Sustentabilidade, clima, conservação, energias renováveis' },
  { name: 'Cultura', slug: 'cultura', description: 'Artes, literatura, música, cinema, sociedade' },
  { name: 'Política', slug: 'politica', description: 'Política nacional/internacional, políticas públicas, geopolítica' },
  { name: 'Educação', slug: 'educacao', description: 'Aprendizado, pedagogia, edtech, desenvolvimento de habilidades' }
]

async function main() {
  console.log('🌱 Starting seed...')

  // Create topics
  console.log('🏷️ Creating topics...')
  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: { name: topic.name, description: topic.description },
      create: topic
    })
  }
  console.log('✅ Topics created')

  // Create categories
  console.log('📂 Creating categories...')
  for (const catName of categories) {
    await prisma.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName }
    })
  }
  console.log('✅ Categories created')

  // Create sources
  console.log('📰 Creating sources...')
  for (const source of sources) {
    const existing = await prisma.source.findFirst({ where: { name: source.name } })
    if (!existing) {
      await prisma.source.create({ data: source })
    }
  }
  console.log('✅ Sources created')

  console.log('🎉 Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })