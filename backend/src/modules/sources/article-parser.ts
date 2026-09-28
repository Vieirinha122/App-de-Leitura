/**
 * Utilitário para extrair dados de artigo a partir de itens de feed RSS/Atom.
 * Centraliza o parsing de campos (URL, título, data, resumo) em um único lugar,
 * evitando duplicação entre sources/sync-service.ts e topics/sync-service.ts.
 *
 * Principais melhorias:
 * - Trata links Atom que vêm como objeto { href } em vez de string
 * - Fallback para item.guid / item.id quando item.link está ausente
 * - Faz parse de múltiplas tags de data (pubDate, isoDate, dc:date, updated)
 * - Valida datas (new Date('invalid') → null)
 * - Loga quando um item é ignorado ou chega sem data
 */
import type { Item } from 'rss-parser'

export interface ArticleFromFeed {
  title: string
  url: string
  summary: string | null
  publishedAt: Date | null
  tags: string[]
}

/**
 * Extrai a URL do artigo a partir de um item do feed.
 * Em feeds Atom, `item.link` pode ser um objeto { href } em vez de string.
 * Também tenta `item.guid` e `item.id` como fallback.
 */
function extrairUrl(item: Item): string | undefined {
  // Em Atom, rss-parser normaliza item.link para string, mas alguns feeds
  // retornam um objeto { href } no campo 'link'
  if (item.link) {
    if (typeof item.link === 'string') return item.link.trim()
    if (typeof item.link === 'object' && 'href' in item.link) {
      return (item.link as { href: string }).href.trim()
    }
  }

  // Fallback: guid (RSS) ou id (Atom) contêm a URL do artigo
  const guid = (item as any).guid
  if (guid && typeof guid === 'object' && 'value' in guid) {
    return guid.value.trim()
  }
  if (guid && typeof guid === 'string') return guid.trim()

  return (item as any).id?.trim()
}

/**
 * Extrai e valida a data de publicação do item.
 * Tenta em ordem: isoDate, pubDate, date, dc:date, updated.
 * Retorna null se nenhuma data for parseável.
 */
function extrairDataPublicacao(item: Item): Date | null {
  const candidatos = [
    item.isoDate,
    item.pubDate,
    (item as any).date,
    (item as any)['dc:date'],
    (item as any).updated,
    (item as any).published,
  ]

  for (const val of candidatos) {
    if (!val) continue
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d
  }

  return null
}

/**
 * Faz parse de um item de feed e retorna os dados normalizados do artigo.
 * Retorna null se o item não tem URL ou título (não pode criar artigo sem esses).
 */
export function parseArticleFromFeed(item: Item, sourceName: string): ArticleFromFeed | null {
  const url = extrairUrl(item)
  const title = item.title?.trim()

  if (!url || !title) {
    console.warn(`⚠️ Item sem URL ou título ignorado (source: ${sourceName})`)
    return null
  }

  const publishedAt = extrairDataPublicacao(item)
  if (!publishedAt) {
    console.log(`📅 Sem data de publicação: "${title}" (source: ${sourceName})`)
  }

  return {
    title,
    url,
    summary: item.contentSnippet?.trim() || item.content?.trim() || null,
    publishedAt,
    tags: (item as any).categories?.map((c: string) => c.trim()).filter(Boolean) ?? []
  }
}
