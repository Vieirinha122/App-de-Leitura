import Parser from 'rss-parser'
import { PrismaClient } from '@prisma/client'
import { parseArticleFromFeed } from './article-parser'
import { scrapeSiteForArticles } from './scraper-service'

const prisma = new PrismaClient()
const parser = new Parser()

export type SyncResult = {
  sourceId: string
  imported: number
  skipped: number
  message: string
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
 * Cria um artigo no banco, ignorando duplicados pela URL.
 * Retorna true se criou, false se já existia.
 */
async function createArticleIfNotExists(
  sourceId: string,
  categoryId: string,
  parsed: { title: string; url: string; summary: string | null; publishedAt: Date | null; tags: string[] }
): Promise<boolean> {
  const existing = await prisma.article.findUnique({ where: { url: parsed.url } })
  if (existing) return false

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
  return true
}

export async function syncSource(sourceId: string): Promise<SyncResult> {
  const source = await prisma.source.findUnique({ 
    where: { id: sourceId },
    select: { id: true, url: true, feedUrl: true, categoryId: true, type: true }
  })
  if (!source) throw new Error('Fonte não encontrada')
  
  // Garante que temos um categoryId válido (fallback para 'Ideias')
  const categoryId = source.categoryId ?? await getDefaultCategoryId()

  let imported = 0
  let skipped = 0

  // Fonte de scraping (sem feedUrl) usa o scraper diretamente
  if (!source.feedUrl) {
    if (source.type !== 'scraped') {
      throw new Error('Esta fonte não possui feed RSS configurado')
    }

    console.log(`🕵️ Scraping fonte: ${source.url}`)
    const articles = await scrapeSiteForArticles(source.url)
    for (const parsed of articles) {
      const created = await createArticleIfNotExists(sourceId, categoryId, parsed)
      if (created) imported++
      else skipped++
    }
    return {
      sourceId,
      imported,
      skipped,
      message: `${imported} artigo(s) importado(s) via scraping, ${skipped} duplicado(s)`
    }
  }

  // Fonte com feed RSS/Atom usa o parser tradicional
  const feed = await parser.parseURL(source.feedUrl)

  for (const item of feed.items) {
    const parsed = parseArticleFromFeed(item, source.url)
    if (!parsed) {
      skipped++
      continue
    }

    const created = await createArticleIfNotExists(sourceId, categoryId, parsed)
    if (created) imported++
    else skipped++
  }

  return {
    sourceId,
    imported,
    skipped,
    message: `${imported} artigo(s) importado(s), ${skipped} ignorado(s)`
  }
}