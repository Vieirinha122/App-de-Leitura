import Parser from 'rss-parser'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const parser = new Parser()

export type SyncResult = {
  sourceId: string
  imported: number
  skipped: number
  message: string
}

export async function syncSource(sourceId: string): Promise<SyncResult> {
  const source = await prisma.source.findUnique({ where: { id: sourceId } })
  if (!source) throw new Error('Fonte não encontrada')
  if (!source.feedUrl) throw new Error('Esta fonte não possui feed RSS configurado')

  const feed = await parser.parseURL(source.feedUrl)
  let imported = 0
  let skipped = 0

  for (const item of feed.items) {
    const url = item.link?.trim()
    const title = item.title?.trim()
    if (!url || !title) {
      skipped++
      continue
    }

    const existing = await prisma.article.findUnique({ where: { url } })
    if (existing) {
      skipped++
      continue
    }

    await prisma.article.create({
      data: {
        title,
        url,
        summary: item.contentSnippet?.trim() || item.content?.trim() || null,
        publishedAt: item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null,
        collectedAt: new Date(),
        status: 'new',
        tags: [],
        sourceId
      }
    })
    imported++
  }

  return {
    sourceId,
    imported,
    skipped,
    message: `${imported} artigo(s) importado(s), ${skipped} ignorado(s)`
  }
}