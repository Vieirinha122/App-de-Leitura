import Parser from 'rss-parser'
import { PrismaClient } from '@prisma/client'
import { parseArticleFromFeed } from '@/modules/sources/article-parser'
import { scrapeSiteForArticles, ScrapedArticle } from '@/modules/sources/scraper-service'

const prisma = new PrismaClient()
const parser = new Parser()

export type SyncSourceResult = {
  sourceId: string
  sourceName: string
  imported: number
  skipped: number
  errors: string[]
}

export type SyncTopicsResult = {
  totalSources: number
  totalImported: number
  totalSkipped: number
  sources: SyncSourceResult[]
  errors: string[]
}

/**
 * Obtém um categoryId padrão (fallback) - cria 'Ideias' se não existir
 */
async function getDefaultCategoryId(): Promise<string> {
  let category = await prisma.category.findUnique({
    where: { name: 'Ideias' }
  })
  if (!category) {
    category = await prisma.category.upsert({
      where: { name: 'Ideias' },
      update: {},
      create: { name: 'Ideias' }
    })
  }
  return category.id
}

/**
 * Sincroniza uma única fonte.
 * Fontes com feedUrl usam o RSS parser. Fontes 'scraped' usam o scraper.
 */
async function syncSingleSource(sourceId: string): Promise<SyncSourceResult> {
  const source = await prisma.source.findUnique({ 
    where: { id: sourceId },
    select: { id: true, name: true, url: true, feedUrl: true, enabled: true, categoryId: true, type: true }
  })

  if (!source) {
    return { sourceId, sourceName: 'Desconhecida', imported: 0, skipped: 0, errors: ['Fonte não encontrada'] }
  }

  if (!source.enabled) {
    return { sourceId, sourceName: source.name, imported: 0, skipped: 0, errors: ['Fonte desabilitada'] }
  }

  // Garante que temos um categoryId válido (fallback para 'Ideias')
  const categoryId = source.categoryId ?? await getDefaultCategoryId()

  const errors: string[] = []
  let imported = 0
  let skipped = 0

  try {
    // Fonte de scraping (sem feedUrl): usa o scraper diretamente
    if (!source.feedUrl) {
      if (source.type !== 'scraped') {
        return { sourceId, sourceName: source.name, imported: 0, skipped: 0, errors: ['Fonte não possui feed RSS nem scraping'] }
      }

      console.log(`🕵️ Scraping fonte: ${source.url}`)
      const articles = await scrapeSiteForArticles(source.url)

      for (const parsed of articles) {
        // Verifica se artigo já existe (pela URL única)
        const existing = await prisma.article.findUnique({ where: { url: parsed.url } })
        if (existing) {
          skipped++
          continue
        }

        try {
          await prisma.article.create({
            data: {
              title: parsed.title,
              url: parsed.url,
              summary: parsed.summary,
              publishedAt: parsed.publishedAt,
              collectedAt: new Date(),
              status: 'new',
              tags: parsed.tags,
              sourceId,
              categoryId
            }
          })
          imported++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro ao criar artigo'
          errors.push(`${parsed.title}: ${msg}`)
          skipped++
        }
      }

      return {
        sourceId,
        sourceName: source.name,
        imported,
        skipped,
        errors
      }
    }

    // Fonte com feed RSS/Atom: usa parser tradicional
    const feed = await parser.parseURL(source.feedUrl)

    for (const item of feed.items) {
      const parsed = parseArticleFromFeed(item, source.name)
      if (!parsed) {
        skipped++
        continue
      }

      // Verifica se artigo já existe (pela URL única)
      const existing = await prisma.article.findUnique({ where: { url: parsed.url } })
      if (existing) {
        skipped++
        continue
      }

      try {
        await prisma.article.create({
          data: {
            title: parsed.title,
            url: parsed.url,
            summary: parsed.summary,
            publishedAt: parsed.publishedAt,
            collectedAt: new Date(),
            status: 'new',
            tags: [],
            sourceId,
            categoryId // Categoria garantida (da fonte ou fallback)
          }
        })
        imported++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao criar artigo'
        errors.push(`${parsed.title}: ${msg}`)
        skipped++
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro no sync'
    errors.push(`Sync: ${msg}`)
  }

  return {
    sourceId,
    sourceName: source.name,
    imported,
    skipped,
    errors
  }
}

/**
 * Sincroniza todas as fontes vinculadas aos tópicos do usuário
 * Usado no onboarding para popular artigos iniciais
 */
export async function syncSourcesForUserTopics(userId: string): Promise<SyncTopicsResult> {
  // Busca tópicos do usuário
  const userTopics = await prisma.userTopic.findMany({
    where: { userId },
    select: { topicId: true }
  })

  if (userTopics.length === 0) {
    return { totalSources: 0, totalImported: 0, totalSkipped: 0, sources: [], errors: ['Usuário não possui tópicos selecionados'] }
  }

  const topicIds = userTopics.map(ut => ut.topicId)

  // Busca todas as fontes vinculadas a esses tópicos (via SourceTopic)
  const sourceTopics = await prisma.sourceTopic.findMany({
    where: { topicId: { in: topicIds } },
    include: {
      source: {
        select: { id: true, name: true, feedUrl: true, enabled: true, categoryId: true, type: true }
      }
    }
  })

  // Filtra fontes únicas e habilitadas (com feedUrl OU tipo scraped)
  const uniqueSources = new Map<string, { id: string; name: string; feedUrl: string | null }>()
  for (const st of sourceTopics) {
    if (st.source.enabled && (st.source.feedUrl || st.source.type === 'scraped')) {
      uniqueSources.set(st.source.id, { id: st.source.id, name: st.source.name, feedUrl: st.source.feedUrl })
    }
  }

  const sourcesToSync = Array.from(uniqueSources.values())
  console.log(`🔄 Sincronizando ${sourcesToSync.length} fontes para user ${userId}`)

  const results: SyncSourceResult[] = []
  const allErrors: string[] = []
  let totalImported = 0
  let totalSkipped = 0

  // Sincroniza cada fonte sequencialmente (para não sobrecarregar)
  for (const source of sourcesToSync) {
    const result = await syncSingleSource(source.id)
    results.push(result)
    totalImported += result.imported
    totalSkipped += result.skipped
    allErrors.push(...result.errors)

    // Pequena pausa entre fontes para ser educado com os servidores
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return {
    totalSources: sourcesToSync.length,
    totalImported,
    totalSkipped,
    sources: results,
    errors: allErrors
  }
}

/**
 * Sincroniza todas as fontes de um tópico específico (para jobs agendados)
 */
export async function syncSourcesForTopic(topicId: string): Promise<SyncTopicsResult> {
  const sourceTopics = await prisma.sourceTopic.findMany({
    where: { topicId },
    include: {
      source: {
        select: { id: true, name: true, feedUrl: true, enabled: true, categoryId: true, type: true }
      }
    }
  })

  const uniqueSources = new Map<string, { id: string; name: string; feedUrl: string | null }>()
  for (const st of sourceTopics) {
    if (st.source.enabled && (st.source.feedUrl || st.source.type === 'scraped')) {
      uniqueSources.set(st.source.id, { id: st.source.id, name: st.source.name, feedUrl: st.source.feedUrl })
    }
  }

  const sourcesToSync = Array.from(uniqueSources.values())
  console.log(`🔄 Sincronizando ${sourcesToSync.length} fontes para tópico ${topicId}`)

  const results: SyncSourceResult[] = []
  const allErrors: string[] = []
  let totalImported = 0
  let totalSkipped = 0

  for (const source of sourcesToSync) {
    const result = await syncSingleSource(source.id)
    results.push(result)
    totalImported += result.imported
    totalSkipped += result.skipped
    allErrors.push(...result.errors)

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return {
    totalSources: sourcesToSync.length,
    totalImported,
    totalSkipped,
    sources: results,
    errors: allErrors
  }
}