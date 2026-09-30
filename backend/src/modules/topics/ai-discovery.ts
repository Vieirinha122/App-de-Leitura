import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { discoverFeeds, DiscoveredFeed } from '@/modules/sources/discovery-service'
import { scrapeSiteForArticles } from '@/modules/sources/scraper-service'
import { env } from '@/lib/config/env'
import OpenAI from 'openai'

const prisma = new PrismaClient()

// Cliente OpenAI (reutiliza configuração existente)
const openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 60_000 }) : null

/**
 * Sanitiza URL corrigindo typos comuns da LLM.
 * - Corrige hostname: w.engadget.com → www.engadget.com
 * - Corrige pontos duplicados (martinfowler..com → martinfowler.com) — feito antes do new URL()
 * - Remove caracteres duplicados consecutivos (historiaddobrasil → historiadobrasil)
 *   sem tocar no prefixo 'www.' (que tem três 'w's consecutivos)
 * - Remove trailing slash desnecessário
 */
function sanitizeUrl(value: string): string {
  let url: string = value.trim()

  // Remove trailing slash (mas preserva apenas a barra final da raiz)
  if (url.length > 1 && url.endsWith('/')) {
    url = url.replace(/\/+$/, '')
  }

  // Corrige pontos duplicados ANTES de new URL() — senão new URL() lança exceção
  // (ex: martinfowler..com → martinfowler.com)
  url = url.replace(/\.\./g, '.')

  try {
    const parsed = new URL(url)
    const host = parsed.hostname

    // Corrige hostnames que começam com 'w.' em vez de 'www.'
    let correctedHost = host.replace(/^(w)\.(.+)/, 'www.$2')

    // Preserva o prefixo 'www.' antes de remover duplicatas — 'www' tem 3 'w's
    // e a regex de duplicatas iria colapsar www → w
    const wwwPrefix = correctedHost.startsWith('www.') ? 'www.' : ''
    const hostRest = correctedHost.slice(wwwPrefix.length)
    const correctedRest = hostRest.replace(/([^.])\1+/g, '$1')
    correctedHost = wwwPrefix + correctedRest

    // Corrige pontos duplicados no hostname (se sobrou algum após parse)
    correctedHost = correctedHost.replace(/\.\./g, '.')

    if (correctedHost !== host) {
      parsed.hostname = correctedHost
    }

    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Fontes conhecidas e confiáveis por tópico.
 * Usadas como fallback quando a LLM não encontra fontes válidas.
 * Prioriza sites populares com feeds RSS conhecidos.
 */
const FONTES_CONHECIDAS: Record<string, FonteSugerida[]> = {
  tecnologia: [
    { name: 'G1 Tecnologia', url: 'https://g1.globo.com/rss/g1/tecnologia/', feedUrl: 'https://g1.globo.com/rss/g1/tecnologia/', description: 'Notícias de tecnologia' },
    { name: 'CNN Brasil Tecnologia', url: 'https://www.cnnbrasil.com.br/tecnologia/rss', feedUrl: 'https://www.cnnbrasil.com.br/tecnologia/rss', description: 'Notícias de tecnologia' },
    { name: 'The Verge', url: 'https://www.theverge.com', feedUrl: 'https://www.theverge.com/rss/index.xml', description: 'Tecnologia e inovação' }
  ],
  ciencia: [
    { name: 'G1 Ciência', url: 'https://g1.globo.com/rss/g1/ciencia_egociencia/', feedUrl: 'https://g1.globo.com/rss/g1/ciencia_egociencia/', description: 'Notícias de ciência' },
    { name: 'National Geographic Brasil', url: 'https://www.nationalgeographic.com.br', feedUrl: 'https://www.nationalgeographic.com.br/rss', description: 'Ciência e natureza' }
  ],
  filosofia: [
    { name: 'Aeon', url: 'https://aeon.co', feedUrl: 'https://aeon.co/rss', description: 'Ensaios e artigos de filosofia' },
    { name: 'Philosophy Now', url: 'https://philosophynow.org', feedUrl: 'https://philosophynow.org/rss', description: 'Revista de filosofia acessível' }
  ],
  historia: [
    { name: 'G1 História', url: 'https://g1.globo.com/rss/g1/historia/', feedUrl: 'https://g1.globo.com/rss/g1/historia/', description: 'Notícias de história' },
    { name: 'BBC History', url: 'https://www.bbc.co.uk/history', feedUrl: 'https://feeds.bbci.co.uk/news/history/rss.xml', description: 'Revista inglesa de história' },
    { name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com', feedUrl: 'https://www.smithsonianmag.com/rss/history/', description: 'Magazine norte-americano de história' }
  ],
  economia: [
    { name: 'CNN Brasil Economia', url: 'https://www.cnnbrasil.com.br/economia/rss', feedUrl: 'https://www.cnnbrasil.com.br/economia/rss', description: 'Notícias econômicas' },
    { name: 'Exame', url: 'https://exame.com.br/rss', feedUrl: 'https://exame.com.br/rss', description: 'Negócios e economia' }
  ],
  politica: [
    { name: 'G1 Política', url: 'https://g1.globo.com/rss/g1/politica/', feedUrl: 'https://g1.globo.com/rss/g1/politica/', description: 'Notícias políticas' },
    { name: 'CNN Brasil Política', url: 'https://www.cnnbrasil.com.br/politica/rss', feedUrl: 'https://www.cnnbrasil.com.br/politica/rss', description: 'Notícias políticas' },
    { name: 'Nexo', url: 'https://www.nexojornal.com.br', feedUrl: 'https://www.nexojornal.com.br/rss', description: 'Jornalismo de opinião e notícias' }
  ],
  psicologia: [
    { name: 'Verywell Mind', url: 'https://www.verywellmind.com', feedUrl: 'https://www.verywellmind.com/rss', description: 'Saúde mental e psicologia' }
  ],
  cultura: [
    { name: 'G1 Cultura', url: 'https://g1.globo.com/rss/g1/cultura/', feedUrl: 'https://g1.globo.com/rss/g1/cultura/', description: 'Notícias culturais' },
    { name: 'Revista Piauí', url: 'https://piaui.folha.uol.com.br', feedUrl: 'https://piaui.folha.uol.com.br/feed/', description: 'Revista cultural' }
  ],
  'meio-ambiente': [
    { name: 'G1 Meio Ambiente', url: 'https://g1.globo.com/rss/g1/meio_ambiente/', feedUrl: 'https://g1.globo.com/rss/g1/meio_ambiente/', description: 'Notícias de meio ambiente' }
  ],
  educacao: [
    { name: 'Nova Escola', url: 'https://www.novaescola.org.br', feedUrl: 'https://www.novaescola.org.br/rss', description: 'Educação e cultura' }
  ]
}

/**
 * Mapeamento de tópicos (slug) para categoria principal
 * Cada tópico tem uma categoria padrão; fontes criadas para esse tópico recebem essa categoria
 */
const TOPIC_CATEGORY_MAP: Record<string, string> = {
  tecnologia: 'Programação',
  ciencia: 'Ciência',
  filosofia: 'Ideias',
  historia: 'Ideias',
  economia: 'Ideias',
  psicologia: 'Ciência',
  'meio-ambiente': 'Ciência',
  cultura: 'Ideias',
  politica: 'Ideias',
  educacao: 'Ideias'
}

/**
 * Busca ou cria o categoryId para um tópico (slug)
 * Se a categoria não existir, cria automaticamente (fallback para 'Ideias')
 */
async function getCategoryIdForTopic(topicSlug: string): Promise<string> {
  const categoryName = TOPIC_CATEGORY_MAP[topicSlug] ?? 'Ideias'

  // Tenta buscar categoria existente
  let category = await prisma.category.findUnique({
    where: { name: categoryName }
  })

  // Se não existe, cria (upsert garante idempotência)
  if (!category) {
    category = await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName }
    })
    console.log(`📂 Categoria criada: ${categoryName}`)
  }

  return category.id
}

/**
 * Schema para sugestão de fonte via LLM.
 * Mais tolerante que o schema enviado à OpenAI: aceita qualquer string para url e feedUrl,
 * pois a validação real de URL acontece em validarEDescobrirFeed.
 * Isso evita rejeitar toda a resposta da LLM por uma única fonte com feedUrl inválido (ex: "N/A").
 */
const fonteSugeridaSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1),
  feedUrl: z.string().optional().nullable().transform(v => v === '' || v === null ? undefined : v),
  description: z.string().optional().nullable().transform(v => v === '' || v === null ? undefined : v)
})

const fontesSugeridasSchema = z.object({
  sources: z.array(fonteSugeridaSchema).max(15)
})

type FonteSugerida = z.infer<typeof fonteSugeridaSchema>

/**
 * Mapeamento de tópicos para prompts de descoberta
 * Cada tópico tem uma lista de sites de referência confiáveis no Brasil/mundo
 */
const TOPIC_DISCOVERY_PROMPTS: Record<string, string> = {
  tecnologia: `
    Liste 15 fontes confiáveis de tecnologia em português (Brasil e Portugal) e inglês.
    Priorize sites com feeds RSS/Atom conhecidos e acessíveis. Evite URLs que possam dar 403/404.
    Exemplos brasileiros: G1 Tecnologia (https://g1.globo.com/rss/g1/tecnologia/), CNN Brasil Tecnologia (https://www.cnnbrasil.com.br/tecnologia/rss).
    Exemplos internacionais: The Verge (https://www.theverge.com/rss/index.xml), Ars Technica (https://arstechnica.com/rss/), TechCrunch (https://techcrunch.com/feed/).
    Exemplos de blogs: Simon Willison (https://simonwillison.net/), Martin Fowler (https://martinfowler.com/feed/), InfoQ (https://www.infoq.com/podcasts/rss/).
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  ciencia: `
    Liste 15 fontes confiáveis de ciência em português e inglês.
    Priorize sites com feeds RSS/Atom conhecidos e acessíveis. Evite URLs que possam dar 403/404.
    Exemplos brasileiros: G1 Ciência (https://g1.globo.com/rss/g1/ciencia_egociencia/), National Geographic Brasil (https://www.nationalgeographic.com.br/rss).
    Exemplos internacionais: Science Magazine (https://www.sciencemag.org/rss/news/sciencemagnews), Nature News (https://www.nature.com/news/rss), Scientific American (https://www.scientificamerican.com/rss/).
    Revistas/portais: Quanta Magazine (https://www.quantamagazine.org/feed/), Superinteressante (https://scielo.org.br/revistas/rbca), Revista Galileu.
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  filosofia: `
    Liste 15 fontes confiáveis de filosofia em português e inglês.
    Priorize sites com feeds RSS/Atom conhecidos e acessíveis. Evite URLs que possam dar 403/404.
    Exemplos internacionais: Aeon (https://aeon.co/rss), Philosophy Now (https://philosophynow.org/rss), Stanford Encyclopedia of Philosophy.
    Exemplos de blogs: The Philosophical Novelist (https://blog.kennyshoemaker.com/), Elucidations Podcast.
    Evite museus ou sites institucionais sem feeds conhecidos.
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  historia: `
    Liste 15 fontes confiáveis de história em português e inglês.
    Priorize sites com feeds RSS/Atom conhecidos e acessíveis. Evite URLs institucionais brasileiras que possam estar caídas (ex: museudoipiranga.pr.gov.br, mhn.gov.br).
    Exemplos brasileiros: G1 História (https://g1.globo.com/rss/g1/historia/).
    Exemplos internacionais: BBC History (https://feeds.bbci.co.uk/news/history/rss.xml), Smithsonian Magazine (https://www.smithsonianmag.com/rss/history/), History.com (https://www.history.com/rss).
    Exemplos de blogs: History Today, NapoleonsHQ, The History Blog.
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  economia: `
    Liste 15 fontes confiáveis de economia/finanças em português e inglês.
    Priorize sites com feeds RSS/Atom conhecidos e acessíveis. Evite URLs que possam dar 403/404.
    Exemplos brasileiros: CNN Brasil Economia (https://www.cnnbrasil.com.br/economia/rss), Valor Econômico (https://valor.globo.com/rss), Exame (https://exame.com.br/rss).
    Exemplos internacionais: Financial Times (https://www.ft.com/rss/world), Bloomberg (https://feeds.bloomberg.com/pub/rss/economic), The Economist (https://www.economist.com/finance-and-economics/rss.xml).
    Bancos centrais: Banco Central do Brasil (https://www.bcb.gov.br/estabilidadefinanceira/rss).
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  psicologia: `
    Liste 15 fontes confiáveis de psicologia/neurociência em português e inglês.
    Priorize sites com feeds RSS/Atom conhecidos e acessíveis.
    Exemplos internacionais: Psychology Today (https://www.psychologytoday.com/us/blog/feed), Verywell Mind (https://www.verywellmind.com/rss), BPS Research Digest (https://bps-research-digest.blogspot.com/feeds/posts/default).
    Exemplos de blogs: Neurociências Cognitivas, The Psychology Podcast.
    Evite sites institucionais sem feeds conhecidos.
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  'meio-ambiente': `
    Liste 15 fontes confiáveis de meio ambiente/sustentabilidade em português e inglês.
    Priorize sites com feeds RSS/Atom conhecidos e acessíveis.
    Exemplos brasileiros: G1 Meio Ambiente (https://g1.globo.com/rss/g1/meio_ambiente/).
    Exemplos internacionais: Climate Home News (https://www.climatehome.org/feed), Carbon Brief (https://www.carbonbrief.org/feed), Inside Climate News (https://insideclimatenews.org/feed/xml).
    ONGs: WWF, Greenpeace, IPCC, MMA Brasil.
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  cultura: `
    Liste 15 fontes confiáveis de cultura/artes em português e inglês.
    Priorize sites com feeds RSS/Atom conhecidos e acessíveis.
    Exemplos brasileiros: G1 Cultura (https://g1.globo.com/rss/g1/cultura/), Revista Piauí (https://piaui.folha.uol.com.br/feed/).
    Exemplos internacionais: The New Yorker (https://www.newyorker.com/feed/culture), The Guardian Culture (https://www.theguardian.com/artanddesign/rss).
    Exemplos de blogs: Folha Ilustrada, El País Cultura, Cultura.co.
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  politica: `
    Liste 15 fontes confiáveis de política/geopolítica em português e inglês.
    Priorize jornais de referência com feeds RSS conhecidos. Evite blogs individuais.
    Exemplos brasileiros: G1 Política (https://g1.globo.com/rss/g1/politica/), CNN Brasil Política (https://www.cnnbrasil.com.br/politica/rss), Folha Poder (https://www1.folha.uol.com.br/poder/rss), Nexo (https://www.nexojornal.com.br/rss).
    Exemplos internacionais: BBC News (https://feeds.bbci.co.uk/news/world_us_and_canada/rss.xml), Foreign Affairs (https://www.foreignaffairs.com/feed), The Economist (https://www.economist.com/politics/rss.xml).
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `,
  educacao: `
    Liste 15 fontes confiáveis de educação/edtech em português e inglês.
    Priorize portais educacionais e blogs de pedagogia com feeds RSS conhecidos.
    Exemplos brasileiros: Nova Escola (https://www.novaescola.org.br/feed), Porvir (https://www.porverdade.org/feed).
    Exemplos internacionais: EdSurge (https://www.edsurge.com/newsletter/rss), Chronicle of Higher Education (https://www.chronicle.com/section/rss).
    Retorne: nome, url do site, feedUrl (RSS/Atom se conhecido), descrição curta.
  `
}

/**
 * Usa LLM para sugerir fontes confiáveis para um tópico
 */
async function sugerirFontesViaLLM(topicoSlug: string): Promise<FonteSugerida[]> {
  if (!openai) {
    throw new Error('OPENAI_API_KEY não configurada')
  }

  const prompt = TOPIC_DISCOVERY_PROMPTS[topicoSlug]
  if (!prompt) {
    throw new Error(`Prompt de descoberta não definido para tópico: ${topicoSlug}`)
  }

  const response = await openai.responses.create({
    model: env.OPENAI_MODEL,
    instructions: `Você é um curador de conteúdo especializado em encontrar fontes RSS/Atom confiáveis.
    Retorne APENAS JSON válido seguindo o schema: { sources: [{ name, url, feedUrl, description }] }
    Todos os campos são obrigatórios. Se não souber o feedUrl de uma fonte, retorne uma string vazia "" em vez de omitir.
    Priorize fontes que tenham RSS/Atom feed conhecido.
    Não invente URLs. Use apenas fontes reais e conhecidas.`,
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'fontes_sugeridas',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  url: { type: 'string' },
                  feedUrl: { type: 'string' },
                  description: { type: 'string' }
                },
                required: ['name', 'url', 'feedUrl', 'description'],
                additionalProperties: false
              }
            }
          },
          required: ['sources'],
          additionalProperties: false
        }
      }
    },
    max_output_tokens: 2000,
    store: false
  })

  const parsed = fontesSugeridasSchema.safeParse(JSON.parse(response.output_text))
  if (!parsed.success) {
    throw new Error(`Resposta do LLM inválida: ${parsed.error.message}`)
  }

  return parsed.data.sources
}

/**
 * Valida e descobre fontes de conteúdo para uma fonte sugerida.
 * 1. Se já tem feedUrl, valida direto via discoverFeeds()
 * 2. Tenta descobrir feeds no site via discoverFeeds()
 * 3. Fallback: tenta scraping do site para extrair artigos diretamente
 *
 * Retorna null se nenhum feed nem scraping funcionar.
 */
async function validarEDescobrirFeed(fonte: FonteSugerida): Promise<{ name: string; url: string; feedUrl: string; type: 'rss' | 'atom' | 'scraped' } | null> {
  // Sanitiza URL para corrigir typos da LLM (ex: historiaddobrasil → historiadobrasil)
  const fonteUrl = sanitizeUrl(fonte.url)
  const fonteFeedUrl = fonte.feedUrl ? sanitizeUrl(fonte.feedUrl) : undefined

  // Se já tem feedUrl, valida direto
  if (fonteFeedUrl) {
    try {
      console.log(`   🔎 Validando feedUrl direto: ${fonteFeedUrl}`)
      const feeds = await discoverFeeds(fonteFeedUrl)
      if (feeds.length > 0) {
        console.log(`   ✅ Feed válido encontrado: ${feeds[0].url} (${feeds[0].type})`)
        return { name: fonte.name, url: fonteUrl, feedUrl: feeds[0].url, type: feeds[0].type }
      }
      console.log(`   ⚠️ FeedUrl não retornou feeds válidos: ${fonteFeedUrl}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      console.log(`   ❌ Erro validando feedUrl ${fonteFeedUrl}: ${msg}`)
    }
  }

  // Tenta descobrir feeds no site principal
  try {
    console.log(`   🔎 Descobrindo feeds no site: ${fonteUrl}`)
    const feeds = await discoverFeeds(fonteUrl)
    if (feeds.length > 0) {
      console.log(`   ✅ Feed descoberto no site: ${feeds[0].url} (${feeds[0].type})`)
      return { name: fonte.name, url: fonteUrl, feedUrl: feeds[0].url, type: feeds[0].type }
    }
    console.log(`   ⚠️ Nenhum feed descoberto em: ${fonteUrl}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.log(`   ❌ Erro descobrindo feeds em ${fonteUrl}: ${msg}`)
  }

  // Fallback: tenta scraping do site para extrair artigos
  try {
    console.log(`   🔵️ Tentando scraping: ${fonteUrl}`)
    const artigos = await scrapeSiteForArticles(fonteUrl, { maxArticles: 5 })
    if (artigos.length > 0) {
      console.log(`   ✅ Scraping funcionou: ${artigos.length} artigo(s) encontrado(s)`)
      return { name: fonte.name, url: fonteUrl, feedUrl: '', type: 'scraped' }
    }
    console.log(`   ⚠️ Scraping não encontrou artigos em: ${fonteUrl}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    console.log(`   ❌ Erro no scraping de ${fonteUrl}: ${msg}`)
  }

  console.log(`   ⛔ Fonte descartada (sem feed válido nem scraping): ${fonte.name} - ${fonteUrl}`)
  return null
}

/**
 * Salva ou atualiza uma Source e cria SourceTopic
 * Também atribui categoryId baseado no tópico
 */
async function salvarFonteETopico(
  topicId: string,
  topicSlug: string,
  fonte: { name: string; url: string; feedUrl: string; type: 'rss' | 'atom' | 'scraped' }
) {
  // Busca categoryId para o tópico
  const categoryId = await getCategoryIdForTopic(topicSlug)

  // Busca source existente pela URL (única na prática)
  const existingSource = await prisma.source.findFirst({
    where: { url: fonte.url }
  })

  let source
  const isScraped = fonte.type === 'scraped'
  if (existingSource) {
    // Atualiza source existente
    source = await prisma.source.update({
      where: { id: existingSource.id },
      data: {
        feedUrl: isScraped ? null : fonte.feedUrl,
        type: fonte.type,
        enabled: true,
        categoryId // Atribui categoria
      }
    })
  } else {
    // Cria nova source
    source = await prisma.source.create({
      data: {
        name: fonte.name,
        url: fonte.url,
        feedUrl: isScraped ? null : fonte.feedUrl,
        type: fonte.type,
        enabled: true,
        categoryId // Atribui categoria
      }
    })
  }

  // Cria SourceTopic (unique constraint em sourceId + topicId evita duplicatas)
  await prisma.sourceTopic.upsert({
    where: {
      sourceId_topicId: {
        sourceId: source.id,
        topicId
      }
    },
    create: {
      sourceId: source.id,
      topicId
    },
    update: {}
  })

  return source
}

/**
 * Função principal: descobre e salva fontes para os tópicos do usuário
 * Retorna estatísticas do processo
 */
export async function discoverAndSaveSourcesForTopics(topicIds: string[]): Promise<{
  topicsProcessed: number
  sourcesCreated: number
  sourcesLinked: number
  errors: string[]
}> {
  // Busca detalhes dos tópicos
  const topics = await prisma.topic.findMany({
    where: { id: { in: topicIds } },
    select: { id: true, slug: true, name: true }
  })

  const errors: string[] = []
  let sourcesCreated = 0
  let sourcesLinked = 0

  for (const topic of topics) {
    console.log(`🔍 Descobrindo fontes para tópico: ${topic.name} (${topic.slug})`)

    // 1. Fontes conhecidas (garantia mínima — sempre disponíveis, mesmo se LLM falhar)
    const fontesConhecidas = FONTES_CONHECIDAS[topic.slug] ?? []
    console.log(`   📚 ${fontesConhecidas.length} fontes conhecidas disponíveis`)

    // 2. LLM sugere fontes (pode falhar sem comprometer as fontes conhecidas)
    let fontesSugeridas: FonteSugerida[] = []
    try {
      fontesSugeridas = await sugerirFontesViaLLM(topic.slug)
      console.log(`   🤖 LLM sugeriu ${fontesSugeridas.length} fontes`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      errors.push(`Tópico ${topic.name}: falha na descoberta via LLM — ${msg}`)
      console.error(`   ⚠️ LLM falhou para ${topic.name}: ${msg}`)
    }

    // 3. Une LLM + fontes conhecidas, deduplicando por URL
    const fontesUnicas = [
      ...fontesSugeridas,
      ...fontesConhecidas.filter((fc) => !fontesSugeridas.some((fs) => sanitizeUrl(fs.url) === sanitizeUrl(fc.url)))
    ]
    console.log(`   📋 Total único: ${fontesUnicas.length} fontes para validar`)

    // 4. Valida e salva (isolado do try/catch da LLM)
    try {
      // Valida e descobre feeds para cada fonte
      const fontesValidadas: Array<{ name: string; url: string; feedUrl: string; type: 'rss' | 'atom' | 'scraped' }> = []
      const fontesFalhas: Array<{ name: string; url: string; motivo: string }> = []

      for (const fonte of fontesUnicas) {
        const validada = await validarEDescobrirFeed(fonte)
        if (validada) {
          fontesValidadas.push(validada)
        } else {
          errors.push(`Feed não encontrado para: ${fonte.name} (${fonte.url})`)
          fontesFalhas.push({ name: fonte.name, url: fonte.url, motivo: 'Nenhum feed RSS/Atom válido nem scraping' })
        }
      }

      console.log(`   ✅ ${fontesValidadas.length} fontes com feed válido`)

      // Salva fontes e vincula ao tópico
      for (const fonte of fontesValidadas) {
        const existingSource = await prisma.source.findFirst({
          where: { url: fonte.url }
        })

        if (!existingSource) {
          await salvarFonteETopico(topic.id, topic.slug, fonte)
          sourcesCreated++
        } else {
          // Source já existe, atualiza categoryId e vincula ao tópico se não estiver vinculada
          await prisma.source.update({
            where: { id: existingSource.id },
            data: { categoryId: await getCategoryIdForTopic(topic.slug) }
          })
          await prisma.sourceTopic.upsert({
            where: {
              sourceId_topicId: {
                sourceId: existingSource.id,
                topicId: topic.id
              }
            },
            create: {
              sourceId: existingSource.id,
              topicId: topic.id
            },
            update: {}
          })
        }
        sourcesLinked++
      }

      // Log de resumo para o tópico
      if (fontesValidadas.length > 0 || fontesFalhas.length > 0) {
        console.log(`\n   ── RESUMO ${topic.name.toUpperCase()} ──`)
        if (fontesValidadas.length > 0) {
          console.log(`   ✅ Sucesso (${fontesValidadas.length}):`)
          for (const f of fontesValidadas) {
            const metodo = f.type === 'scraped' ? 'scraping' : f.type
            console.log(`      • ${f.name} — ${metodo}`)
          }
        }
        if (fontesFalhas.length > 0) {
          console.log(`   ❌ Falhas (${fontesFalhas.length}):`)
          for (const f of fontesFalhas) {
            console.log(`      • ${f.name} — ${f.motivo}`)
          }
        }
        console.log(`   ────────────────────────────\n`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      errors.push(`Tópico ${topic.name}: erro na validação/salvamento — ${msg}`)
      console.error(`   ❌ Erro no tópico ${topic.name}:`, msg)
    }
  }

  return {
    topicsProcessed: topics.length,
    sourcesCreated,
    sourcesLinked,
    errors
  }
}
