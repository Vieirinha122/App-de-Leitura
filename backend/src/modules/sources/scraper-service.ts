/**
 * Scraper de página web para extrair artigos de sites sem RSS feed.
 *
 * Funciona como fallback no discovery: quando discoverFeeds() não encontra
 * um feed RSS/Atom, tenta extrair artigos diretamente do HTML da página.
 *
 * Fluxo:
 * 1. Checa robots.txt (respeita diretrizes)
 * 2. Tenta sitemap.xml (mais confiável e rápido)
 * 3. Faz scraping da homepage e extrai links de artigos via cheerio
 * 4. Para cada artigo: faz scraping individual para extrair título, data, resumo
 *
 * Cache: URLs de sitemap/homepage são cacheadas por 1h (in-memory).
 * Artigos duplicados são evitados pela checagem de URL única no DB durante sync.
 */
import { load } from 'cheerio'
import { validarUrlExterna } from './discovery-service'

// Configurações do scraper
const REQUEST_TIMEOUT_MS = 10_000
const MAX_ARTICLES = 10
const MAX_REQUESTS_PER_SITE = 20
const RATE_LIMIT_MS = 300
const SITEMAP_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora
const DEFAULT_USER_AGENT = 'DailyRead/1.0 (+https://dailyread.app; bot)'

export interface ScrapedArticle {
  title: string
  url: string
  summary: string | null
  publishedAt: Date | null
  tags: string[]
}

/**
 * Cache simples em memória para URLs de sitemap/homepage.
 * Evita refazer parsing do sitemap a cada cron cycle.
 */
interface SitemapCacheEntry {
  urls: string[]
  expiresAt: number
}
const sitemapCache = new Map<string, SitemapCacheEntry>()


/**
 * Checa robots.txt para ver se o crawler pode acessar o caminho.
 * Implementação leve: parseia User-agent e Disallow lines.
 * Retorna true se permitido (ou se robots.txt não existir).
 */
async function checkRobotsAllowed(siteUrl: string, path: string): Promise<boolean> {
  const parsed = new URL(siteUrl)
  const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`

  try {
    const res = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5_000),
      headers: { 'User-Agent': DEFAULT_USER_AGENT }
    })

    if (!res.ok) return true // Se não conseguir robots.txt, permite (fail-open para não bloquear descoberta)

    const robotsText = await res.text()
    const lines = robotsText.split('\n')

    // Parse simples: procura por User-agent: * (ou DailyRead) e Disallow
    let userAgentMatch = false
    const disallowed: string[] = []

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase()
      if (trimmed.startsWith('user-agent:')) {
        const ua = line.split(':')[1]?.trim()
        userAgentMatch = ua === '*' || ua === 'dread' || ua === 'dailyread'
      }
      if (userAgentMatch && trimmed.startsWith('disallow:')) {
        const path2 = line.split(':')[1]?.trim()
        if (path2) disallowed.push(path2)
      }
    }

    // Checa se o path bate com algum disallow
    for (const rule of disallowed) {
      if (rule === '/' || path.startsWith(rule)) return false
    }

    return true
  } catch {
    return true // Se falhar, permite (fail-open)
  }
}

/**
 * Faz uma requisição HTTP com timeout e User-Agent customizado.
 * Lança erro se o status não for 2xx.
 */
async function fetchPage(url: string, opts?: { signal?: AbortSignal }): Promise<string> {
  const res = await fetch(url, {
    signal: opts?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
    },
    redirect: 'follow'
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ao buscar ${url}`)
  }

  const contentLength = Number(res.headers.get('content-length') ?? 0)
  if (contentLength > 2_000_000) throw new Error('Página muito grande')

  return await res.text()
}

/**
 * Tenta extrair URLs do sitemap.xml do site.
 * Se encontrar, parseia <loc> tags e retorna as URLs.
 * Usa cache de 1h para evitar re-fetch desnecessário.
 */
async function tryFetchSitemap(sitemapUrl: string): Promise<string[]> {
  const cached = sitemapCache.get(sitemapUrl)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.urls
  }

  try {
    const html = await fetchPage(sitemapUrl)
    // sitemap pode ser XML ou HTML
    const isXml = html.includes('<?xml') || html.includes('<urlset') || html.includes('<sitemapindex')

    if (isXml) {
      // XML sitemap: extrai <loc> tags
      const urls = Array.from(html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map(m => m[1].trim())
      if (urls.length > 0) {
        sitemapCache.set(sitemapUrl, { urls, expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS })
        return urls
      }
    }
  } catch {
    // Sitemap não existe ou falhou
  }

  return []
}

/**
 * Extrai URLs de artigos a partir do HTML da homepage.
 * Usa heurísticas: links dentro de <article>, <main>,
 * elementos com classe contendo "post"/"article"/"story",
 * e links que apontam para paths profundos (3+ segments).
 */
function extractArticleUrlsFromHtml(html: string, baseUrl: string): string[] {
  const $ = load(html)
  const urls: string[] = []

  const articleSelectors = [
    'article a[href]',
    'main a[href]',
    'a[href*="/article/"]',
    'a[href*="/post/"]',
    'a[href*="/noticia/"]',
    'a[href*="/noticias/"]',
    'a[href*="/blog/"]',
    'a[href*="/story/"]',
    '.post a[href]',
    '.article a[href]',
    '.story a[href]',
    '.noticia a[href]',
    '.entry a[href]',
    '.hentry a[href]',
    '.content a[href]'
  ]

  const baseUrlObj = new URL(baseUrl)

  $(articleSelectors.join(', ')).each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    try {
      const resolved = new URL(href, baseUrlObj).toString()
      // Filtra para URLs do mesmo domínio
      if (new URL(resolved).hostname === baseUrlObj.hostname) {
        urls.push(resolved)
      }
    } catch {
      // URL inválida, ignora
    }
  })

  // Fallback genérico para sites antigos: pega links .htm/.html ou paths profundos
  if (urls.length === 0) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href')
      if (!href) return

      try {
        const resolved = new URL(href, baseUrlObj).toString()
        if (new URL(resolved).hostname !== baseUrlObj.hostname) return

        const path = new URL(resolved).pathname.toLowerCase()
        // Link aponta pra .htm/.html ou está em subdiretório (3+ segments)
        if (/\.(htm|html)$/.test(path) || path.split('/').length >= 3) {
          urls.push(resolved)
        }
      } catch {
        // URL inválida
      }
    })
  }

  // Deduplica e filtra paths que parecem páginas institucionais
  const unique = [...new Set(urls)]
  return unique.filter(url => {
    try {
      const u = new URL(url)
      // Remove URLs que claramente não são artigos
      const skipPatterns = [
        '/about', '/sobre', '/contato', '/privacy', '/terms',
        '/career', '/jobs', '/newsletter', '/rss', '/feed',
        '/atom', '/sitemap', '/search', '/tag/', '/tags/',
        '/category/', '/categoria/', '/ author', '/author/'
      ]
      const path = u.pathname.toLowerCase()
      return !skipPatterns.some(p => path.startsWith(p))
    } catch {
      return false
    }
  })
}

/**
 * Faz scraping de uma página de artigo individual.
 * Extrai título, data, resumo e tags usando Open Graph,
 * meta tags, e heurísticas de HTML.
 */
async function scrapeArticlePage(articleUrl: string): Promise<ScrapedArticle | null> {
  try {
    const html = await fetchPage(articleUrl)
    const $ = load(html)

    // Título: og:title → twitter:title → h1 → title
    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('meta[name="twitter:title"]').attr('content')?.trim() ||
      $('h1').first().text().trim() ||
      $('title').text().trim()

    if (!title) {
      console.log(`📰 Sem título: ${articleUrl}`)
      return null
    }

    // Resumo: og:description → meta description → twitter:description → primeiro <p>
    const summary =
      $('meta[property="og:description"]').attr('content')?.trim() ||
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[name="twitter:description"]').attr('content')?.trim() ||
      $('p').first().text().trim() ||
      null

    // Data: article:published_time → time[datetime] → meta date → regex
    let publishedAt: Date | null = null
    const dateStr =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('time[datetime]').attr('datetime') ||
      $('time').attr('datetime')

    if (dateStr) {
      const d = new Date(dateStr)
      if (!isNaN(d.getTime())) publishedAt = d
    }

    // Se não encontrou data meta, tenta parsear texto de <time> elementos
    if (!publishedAt) {
      const timeText = $('time').first().text().trim()
      if (timeText) {
        const d = new Date(timeText)
        if (!isNaN(d.getTime())) publishedAt = d
      }
    }

    // Tags: article:tag → keywords → meta keywords
    const tags: string[] = []
    $('meta[property="article:tag"]').each((_, el) => {
      const tag = $(el).attr('content')?.trim()
      if (tag) tags.push(tag)
    })
    if (tags.length === 0) {
      const keywords = $('meta[name="keywords"]').attr('content')
      if (keywords) {
        tags.push(...keywords.split(',').map(k => k.trim()).filter(Boolean))
      }
    }

    console.log(`✅ Artigo extraído: "${title}" (${articleUrl})`)
    return { title, url: articleUrl, summary, publishedAt, tags }

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.warn(`⚠️ Falha scraping artigo ${articleUrl}: ${msg}`)
    return null
  }
}

/**
 * Faz scraping de um site para descobrir artigos.
 * Tenta sitemap.xml primeiro, depois homepage.
 * Limita o número de artigos e requests.
 */
export async function scrapeSiteForArticles(
  siteUrl: string,
  options?: { maxArticles?: number }
): Promise<ScrapedArticle[]> {
  const maxArticles = options?.maxArticles ?? MAX_ARTICLES
  const parsedUrl = await validarUrlExterna(siteUrl)

  // 1. Checa robots.txt
  const robotsAllowed = await checkRobotsAllowed(parsedUrl.toString(), parsedUrl.pathname)
  if (!robotsAllowed) {
    console.log(`🚫 robots.txt bloqueia scraping: ${siteUrl}`)
    return []
  }

  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`

  // 2. Tenta sitemap.xml
  const sitemapUrl = `${baseUrl}/sitemap.xml`
  const sitemapUrls = await tryFetchSitemap(sitemapUrl)

  let articleUrls: string[] = []

  if (sitemapUrls.length > 0) {
    console.log(`🗺️ Sitemap encontrado: ${sitemapUrls.length} URLs`)
    // Filtra sitemap para URLs que parecem artigos (não /rss, /about, etc.)
    articleUrls = sitemapUrls.filter(url => {
      try {
        const u = new URL(url)
        const path = u.pathname.toLowerCase()
        const skipPatterns = ['/rss', '/feed', '/atom', '/about', '/contact', '/privacy', '/terms', '/sitemap']
        return !skipPatterns.some(p => path.includes(p))
      } catch {
        return false
      }
    })
  } else {
    // 3. Faz scraping da homepage
    console.log(`🕵️ Sitemap não encontrado, scraping homepage: ${baseUrl}`)
    const homepageHtml = await fetchPage(baseUrl)
    articleUrls = extractArticleUrlsFromHtml(homepageHtml, baseUrl)
  }

  // Limita para os N artigos mais recentes (sitemap/homepage vêm em ordem decrescente)
  articleUrls = articleUrls.slice(0, maxArticles)

  if (articleUrls.length === 0) {
    console.log(`📰 Nenhuma URL de artigo encontrada em: ${siteUrl}`)
    return []
  }

  console.log(`📰 Encontradas ${articleUrls.length} candidate(s) de artigo`)

  // 4. Faz scraping de cada artigo individualmente
  const results: ScrapedArticle[] = []
  let requestCount = 0

  for (const url of articleUrls) {
    if (requestCount >= MAX_REQUESTS_PER_SITE) break
    requestCount++

    // Rate limiting
    if (requestCount > 1) await new Promise(r => setTimeout(r, RATE_LIMIT_MS))

    const article = await scrapeArticlePage(url)
    if (article) results.push(article)
    if (results.length >= maxArticles) break
  }

  console.log(`🎯 Scraping concluído: ${results.length} artigo(s) extraído(s) de ${siteUrl}`)
  return results
}
