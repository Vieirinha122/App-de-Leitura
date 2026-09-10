import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type SuggestedSource = {
  name: string
  url: string
  feedUrl: string
  type: 'rss'
  language: 'pt-BR' | 'pt-PT'
  topic: string
}

const fontesSugeridas: SuggestedSource[] = [
  { name: 'Agência Brasil', url: 'https://agenciabrasil.ebc.com.br', feedUrl: 'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml', type: 'rss', language: 'pt-BR', topic: 'Notícias' },
  { name: 'Nexo Jornal', url: 'https://www.nexojornal.com.br', feedUrl: 'https://www.nexojornal.com.br/rss.xml', type: 'rss', language: 'pt-BR', topic: 'Notícias' },
  { name: 'Revista Pesquisa FAPESP', url: 'https://revistapesquisa.fapesp.br', feedUrl: 'https://revistapesquisa.fapesp.br/feed/', type: 'rss', language: 'pt-BR', topic: 'Ciência' },
  { name: 'Filosofia Pop', url: 'https://filosofiapop.com.br', feedUrl: 'https://filosofiapop.com.br/feed/', type: 'rss', language: 'pt-BR', topic: 'Filosofia' },
  { name: 'História Blog', url: 'https://historiablog.org', feedUrl: 'https://historiablog.org/feed/', type: 'rss', language: 'pt-BR', topic: 'História' },
  { name: 'G1 — Notícias', url: 'https://g1.globo.com', feedUrl: 'https://g1.globo.com/rss/g1/', type: 'rss', language: 'pt-BR', topic: 'Notícias' },
  { name: 'Aeon', url: 'https://aeon.co', feedUrl: 'https://aeon.co/feed.rss', type: 'rss', language: 'pt-PT', topic: 'Filosofia' }
]

export async function listSourceSuggestions(query?: string, topic?: string) {
  const sources = await prisma.source.findMany({ select: { url: true, feedUrl: true } })
  const knownUrls = new Set(sources.flatMap((source) => [source.url, source.feedUrl].filter(Boolean)))
  const normalizedQuery = query?.trim().toLocaleLowerCase('pt-BR')

  return fontesSugeridas.filter((source) => {
    if (knownUrls.has(source.url) || knownUrls.has(source.feedUrl)) return false
    if (topic && source.topic !== topic) return false
    if (normalizedQuery && !`${source.name} ${source.topic} ${source.language}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery)) return false
    return true
  })
}

export { fontesSugeridas }