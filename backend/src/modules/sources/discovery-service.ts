import dns from 'node:dns/promises'
import net from 'node:net'

// Limita o tamanho da resposta para reduzir consumo e exposição a respostas abusivas.
const MAX_RESPONSE_BYTES = 1_000_000
// Interrompe sites lentos para não prender uma requisição do backend indefinidamente.
const REQUEST_TIMEOUT_MS = 10_000

// User-Agent para não ser bloqueado por sites que exigem identificação
const DEFAULT_USER_AGENT = 'DailyRead/1.0 (+https://dailyread.app; bot)'

export type DiscoveredFeed = {
  url: string
  title: string
  type: 'rss' | 'atom'
}

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 0
  }
  return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80:')
}

export async function validarUrlExterna(value: string): Promise<URL> {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A URL precisa usar http ou https')
  if (url.username || url.password) throw new Error('A URL não pode conter credenciais')

  const addresses = await dns.lookup(url.hostname, { all: true })
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('Não é permitido consultar endereços internos')
  }
  return url
}

export async function discoverFeeds(inputUrl: string): Promise<DiscoveredFeed[]> {
  const url = await validarUrlExterna(inputUrl)
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'User-Agent': DEFAULT_USER_AGENT
    },
    redirect: 'follow' // Permite redirects (ex: http->https, www->non-www)
  })

  if (!response.ok) throw new Error(`O site respondeu com HTTP ${response.status}`)
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error('A resposta do site é muito grande')

  const body = await response.text()
  if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('A resposta do site é muito grande')

  const feeds: DiscoveredFeed[] = []
  const linkPattern = /<link\b[^>]*>/gi
  for (const tag of body.match(linkPattern) ?? []) {
    const type = tag.match(/type=["']([^"']+)["']/i)?.[1]?.toLowerCase()
    if (type !== 'application/rss+xml' && type !== 'application/atom+xml') continue
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
    if (!href) continue
    const feedUrl = new URL(href, url).toString()
    feeds.push({
      url: feedUrl,
      title: tag.match(/title=["']([^"']+)["']/i)?.[1] ?? 'Feed principal',
      type: type === 'application/atom+xml' ? 'atom' : 'rss'
    })
  }

  const normalizedHost = url.hostname.replace(/^www\./, '')

  // G1 — retorna feed RSS da seção detectada na URL (ou feed geral se não detectar)
  if (normalizedHost === 'g1.globo.com') {
    const path = url.pathname || '/'
    let section: string | null = null

    // Mapeia seções conhecidas do G1
    if (path.includes('/tecnologia')) section = 'tecnologia'
    else if (path.includes('/politica')) section = 'politica'
    else if (path.includes('/economia')) section = 'economia'
    else if (path.includes('/esportes') || path.includes('/esporte')) section = 'esportes'
    else if (path.includes('/judo') || path.includes('/mundo')) section = 'mundo'
    else if (path.includes('/cultura')) section = 'cultura'
    else if (path.includes('/ciencia') || path.includes('/ciencia_egociencia')) section = 'ciencia_egociencia'
    else if (path.includes('/historia')) section = 'historia'
    else if (path.includes('/meio_ambiente')) section = 'meio_ambiente'

    if (section) {
      // Feed específico da seção encontrada na URL
      feeds.push({
        url: `https://g1.globo.com/rss/g1/${section}/`,
        title: `G1 — ${section.charAt(0).toUpperCase() + section.slice(1)}`,
        type: 'rss'
      })
    } else {
      // URL sem seção detectada — retorna feed geral (menos ideal, mas funciona)
      feeds.push({
        url: 'https://g1.globo.com/rss/g1/',
        title: 'G1 — Notícias',
        type: 'rss'
      })
    }
  }

  // CNN Brasil — RSS padrão por seção
  if (normalizedHost === 'www.cnnbrasil.com.br' || normalizedHost === 'cnnbrasil.com.br') {
    const path = url.pathname || '/'
    let section = 'ultimas'
    if (path.startsWith('/economia')) section = 'economia'
    else if (path.startsWith('/politica')) section = 'politica'
    else if (path.startsWith('/tecnologia')) section = 'tecnologia'
    else if (path.startsWith('/entretenimento')) section = 'entretenimento'
    else if (path.startsWith('/saude')) section = 'saude'
    feeds.push({
      url: `https://www.cnnbrasil.com.br/${section}/rss`,
      title: 'CNN Brasil',
      type: 'rss'
    })
  }

  // Folha de S.Paulo — RSS conhecido
  if (normalizedHost === 'www1.folha.uol.com.br' || normalizedHost === 'folha.uol.com.br') {
    feeds.push({
      url: 'https://www1.folha.uol.com.br/apanhodenoticias/rss',
      title: 'Folha de S.Paulo',
      type: 'rss'
    })
  }

  // BBC News Brasil
  if (normalizedHost === 'www.bbc.com' || normalizedHost === 'bbc.com') {
    const path = url.pathname || '/'
    if (path.includes('portuguese')) {
      feeds.push({
        url: 'https://www.bbc.com/portuguese/rss.xml',
        title: 'BBC News Brasil',
        type: 'rss'
      })
    }
  }

  // The Verge
  if (normalizedHost === 'www.theverge.com' || normalizedHost === 'theverge.com') {
    feeds.push({
      url: 'https://www.theverge.com/rss/index.xml',
      title: 'The Verge',
      type: 'rss'
    })
  }

  return [...new Map(feeds.map((feed) => [feed.url, feed])).values()]
}