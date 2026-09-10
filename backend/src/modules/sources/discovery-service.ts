import dns from 'node:dns/promises'
import net from 'node:net'

// Limita o tamanho da resposta para reduzir consumo e exposição a respostas abusivas.
const MAX_RESPONSE_BYTES = 1_000_000
// Interrompe sites lentos para não prender uma requisição do backend indefinidamente.
const REQUEST_TIMEOUT_MS = 8_000

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

async function validarUrlExterna(value: string): Promise<URL> {
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
    headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9' },
    redirect: 'error'
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
  if (normalizedHost === 'g1.globo.com') {
    feeds.push({
      url: 'https://g1.globo.com/rss/g1/',
      title: 'G1 — Notícias',
      type: 'rss'
    })
  }

  return [...new Map(feeds.map((feed) => [feed.url, feed])).values()]
}