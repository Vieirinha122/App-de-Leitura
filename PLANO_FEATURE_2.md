# Plano de Implementação — Feature 2: Tópicos do Usuário + Feed Personalizado

---

## 1. Visão Geral

**Objetivo:** Permitir que cada usuário selecione tópicos de interesse (de um conjunto curado) e receba um feed personalizado de artigos provenientes de fontes confiáveis associadas a esses tópicos.

**Fluxo do usuário:**
1. **Onboarding** (pós-registro): tela de seleção de tópicos → salva preferências → redireciona para `/hoje`
2. **Feed personalizado** (`/hoje`): mostra artigos dos tópicos selecionados, com filtros
3. **Edição de preferências** (futuro): tela em `/configuracoes` ou similar para alterar tópicos

---

## 2. Decisões de Design (para alinhar antes de codar)

| Decisão | Opção Escolhida | Rationale |
|---------|-----------------|-----------|
| **Modelo de tópicos** | Tabela `Topic` fixa (sistema), não user-created | Garante curadoria, evita spam/lixo |
| **Relação User↔Topic** | Tabela `UserTopic` (many-to-many) | Simples, performático, permite peso/ordem |
| **Fontes por tópico** | Tabela `SourceTopic` (many-to-many) | Uma fonte pode pertencer a múltiplos tópicos |
| **Descoberta de fontes** | IA-assisted (LLM) + validação humana | Escala curadoria, mantém qualidade |
| **Feed em `/hoje`** | Unificado: artigos dos tópicos do usuário + recomendação diária | Mantém `/hoje` como "página principal" |
| **Filtros no feed** | Tópico, Fonte, Status, Busca | Reutiliza filtros existentes de `/biblioteca` |
| **Onboarding** | Obrigatório no 1º login pós-registro | Garante personalização imediata |

---

## 3. Mudanças no Banco de Dados (Prisma)

### 3.1 Novos Models

```prisma
model Topic {
  id          String   @id @default(cuid())
  name        String   @unique        // ex: "Tecnologia", "Ciência", "Filosofia"
  slug        String   @unique        // ex: "tecnologia", "ciencia", "filosofia"
  description String?                 // descrição curta para UI
  icon        String?                 // nome do ícone Lucide ou emoji
  color       String?                 // hex para chips/badges
  order       Int      @default(0)    // ordem de exibição no onboarding
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now()) @db.Timestamptz
  updatedAt   DateTime @updatedAt @db.Timestamptz

  userTopics     UserTopic[]
  sourceTopics   SourceTopic[]
}

model UserTopic {
  id        String   @id @default(cuid())
  userId    String
  topicId   String
  weight    Int      @default(0)     // -10 a 10 (prioridade do tópico para o user)
  createdAt DateTime @default(now()) @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  topic Topic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@unique([userId, topicId])
  @@map("user_topics")
}

model SourceTopic {
  id        String   @id @default(cuid())
  sourceId  String
  topicId   String
  weight    Int      @default(0)     // relevância da fonte para o tópico
  createdAt DateTime @default(now()) @db.Timestamptz

  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  topic  Topic  @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@unique([sourceId, topicId])
  @@map("source_topics")
}
```

### 3.2 Atualizações em Models Existentes

```prisma
// Article: adicionar relação opcional com tópicos (para IA categorizar)
model Article {
  // ... campos existentes
  topics      ArticleTopic[]
}

// Nova tabela de ligação Article↔Topic (para classificação automática)
model ArticleTopic {
  id        String   @id @default(cuid())
  articleId String
  topicId   String
  confidence Float   @default(1.0)  // 0-1, score da IA
  createdAt DateTime @default(now()) @db.Timestamptz

  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  topic   Topic   @relation(fields: [topicId], references: [id], onDelete: Cascade)

  @@unique([articleId, topicId])
  @@map("article_topics")
}

// User: adicionar flag de onboarding completado
model User {
  // ... campos existentes
  onboardingCompleted Boolean @default(false)
  userTopics          UserTopic[]
}
```

### 3.3 Seed Inicial de Tópicos (Curados)

```typescript
// prisma/seed.ts - tópicos iniciais variados (não só tech)
const TOPICOS_INICIAIS = [
  { name: 'Tecnologia', slug: 'tecnologia', icon: 'Cpu', color: '#3B82F6', order: 1, description: 'IA, programação, gadgets, startups' },
  { name: 'Ciência', slug: 'ciencia', icon: 'FlaskConical', color: '#10B981', order: 2, description: 'Pesquisa, descobertas, espaço, saúde' },
  { name: 'Filosofia', slug: 'filosofia', icon: 'Brain', color: '#8B5CF6', order: 3, description: 'Pensamento crítico, ética, existência' },
  { name: 'História', slug: 'historia', icon: 'Landmark', color: '#F59E0B', order: 4, description: 'Eventos históricos, civilizações, biografias' },
  { name: 'Economia', slug: 'economia', icon: 'TrendingUp', color: '#EF4444', order: 5, description: 'Mercados, finanças, macroeconomia' },
  { name: 'Psicologia', slug: 'psicologia', icon: 'Heart', color: '#EC4899', order: 6, description: 'Comportamento, saúde mental, neurociência' },
  { name: 'Meio Ambiente', slug: 'meio-ambiente', icon: 'Leaf', color: '#22C55E', order: 7, description: 'Clima, sustentabilidade, conservação' },
  { name: 'Cultura', slug: 'cultura', icon: 'BookOpen', color: '#6366F1', order: 8, description: 'Artes, literatura, cinema, música' },
  { name: 'Política', slug: 'politica', icon: 'Gavel', color: '#DC2626', order: 9, description: 'Política nacional, internacional, políticas públicas' },
  { name: 'Educação', slug: 'educacao', icon: 'GraduationCap', color: '#0EA5E9', order: 10, description: 'Pedagogia, aprendizagem, carreira' },
]
```

---

## 4. Backend — Endpoints Necessários

### 4.1 Módulo `topics` (novo)

**Arquivos:**
- `backend/src/modules/topics/routes.ts`
- `backend/src/modules/topics/service.ts`

**Endpoints:**

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/v1/topics` | Lista todos os tópicos ativos (para onboarding/preferências) |
| `GET` | `/api/v1/topics/my` | Lista tópicos do usuário autenticado (com weights) |
| `PUT` | `/api/v1/topics/my` | Atualiza tópicos do usuário (body: `{ topicIds: string[], weights?: Record<string, number> }`) |
| `POST` | `/api/v1/topics/my/sync` | Sincroniza: cria UserTopic para tópicos selecionados, remove os demais |

**Schemas Zod:**
```typescript
const topicResponse = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  order: z.number(),
})

const userTopicResponse = topicResponse.extend({
  weight: z.number(),
})

const updateMyTopicsBody = z.object({
  topicIds: z.array(z.string()).min(1, 'Selecione pelo menos um tópico'),
  weights: z.record(z.string(), z.number().int().min(-10).max(10)).optional(),
})
```

### 4.2 Atualizações no Módulo `articles` (feed personalizado)

**Novo endpoint em `articles/routes.ts`:**

```typescript
// GET /api/v1/articles/feed - Feed personalizado do usuário
app.get('/articles/feed', {
  schema: {
    querystring: z.object({
      topicId: z.string().optional(),      // filtrar por tópico específico
      sourceId: z.string().optional(),     // filtrar por fonte
      status: z.enum(['new', 'saved', 'read', 'archived']).optional(),
      search: z.string().optional(),
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().positive().max(50).default(20),
      sortBy: z.enum(['publishedAt', 'collectedAt', 'relevance']).default('publishedAt'),
      sortOrder: z.enum(['asc', 'desc']).default('desc'),
    }),
    response: { 200: paginatedResponse },
    tags: ['Articles'],
    summary: 'Feed personalizado baseado nos tópicos do usuário',
  },
  preHandler: [requireAuth],
}, async (request) => {
  const userId = request.user!.id
  const query = request.query as ArticleFeedQuery
  return getPersonalizedFeed(userId, query)
})
```

**Service `getPersonalizedFeed(userId, query)`:**
1. Busca `topicIds` do usuário (via `UserTopic` onde `weight > -5` por ex.)
2. Busca `sourceIds` relacionados a esses tópicos (via `SourceTopic`)
3. Query `Article` filtrando por `sourceId IN (...)` + filtros da query
4. Ordena por `publishedAt` desc (ou relevance score se implementado)
5. Paginação

### 4.3 Atualização no Auth Register

Em `auth/routes.ts` ou `auth/service.ts`, após criar usuário:
```typescript
// Opcional: criar UserTopic padrão (ex: 3 tópicos mais populares)
// Ou deixar vazio e forçar onboarding no frontend
```

---

## 5. Frontend — Telas e Componentes

### 5.1 Nova Rota: `/onboarding` (protegida)

**Arquivo:** `frontend/src/modules/onboarding/Onboarding.tsx`

**Fluxo:**
1. Usuário registra → `authStore.register()` → `navigate('/onboarding', { replace: true })`
2. Tela carrega `GET /api/v1/topics`
3. UI: Grid de cards de tópicos (ícone, nome, descrição, cor) — seleção múltipla
4. Mínimo 1, máximo sugerido 5 (mas não bloquear)
5. Botão "Continuar" → `PUT /api/v1/topics/my` → `navigate('/hoje', { replace: true })`
6. Marcar `onboardingCompleted = true` no user (backend ou frontend)

**Estados:**
- `selectedTopicIds: string[]`
- `isSubmitting: boolean`

### 5.2 Atualização em `/hoje` (Hoje.tsx)

**Mudanças:**
- Substituir `fetchDailyRecommendation` por `fetchPersonalizedFeed` (novo hook)
- Adicionar barra de filtros (reutilizar de `Biblioteca.tsx`):
  - Select de Tópico (carregado de `GET /api/v1/topics/my`)
  - Select de Fonte
  - Select de Status
  - Busca por título
- Manter a recomendação diária (IA) como card destacado no topo se existir
- Lista paginada abaixo (infinite scroll ou paginação)

**Novo hook:** `frontend/src/modules/hoje/usePersonalizedFeed.ts`
```typescript
export function usePersonalizedFeed(filters: FeedFilters) {
  return useQuery({
    queryKey: ['personalized-feed', filters],
    queryFn: () => fetchPersonalizedFeed(filters),
    // ...
  })
}
```

### 5.3 Tela de Preferências (futuro) — `/preferencias`

**Arquivo:** `frontend/src/modules/preferencias/Preferencias.tsx`

**Funcionalidades:**
- Lista de tópicos atuais do usuário (com chips coloridos, peso visual)
- Botão "Editar" → abre modal/drawer com grid de todos os tópicos (como onboarding)
- Salvar → `PUT /api/v1/topics/my`
- (Opcional) Gerenciar fontes bloqueadas/favoritas por tópico

### 5.4 Atualização no `authStore`

No `register()`: após sucesso, navegar para `/onboarding` (não mais `/hoje` direto).

```typescript
register: async (name, email, password) => {
  // ... existing code
  set({ user: data.user, isAuthenticated: true })
  // Navegação será feita no componente Login.tsx após register() resolver
},
```

No `Login.tsx`:
```typescript
const handleSubmit = async (e) => {
  // ...
  if (mode === 'register') {
    await register(formData.name, emailNormalizado, formData.password)
    navigate('/onboarding', { replace: true })  // ← MUDANÇA AQUI
  } else {
    await login(emailNormalizado, formData.password)
    navigate('/hoje', { replace: true })
  }
}
```

---

## 6. Descoberta de Fontes com IA (Serviço de Background)

### 6.1 Conceito

Script/serviço que:
1. Recebe lista de tópicos ativos
2. Para cada tópico, pede ao LLM: "Liste 10-15 fontes confiáveis de notícias/conteúdo em PT-BR sobre [tópico] que tenham RSS feed"
3. LLM retorna: nome, URL, feedUrl, linguagem, score de confiabilidade
4. Validação: tenta fazer fetch do feedUrl (reutiliza `discovery-service.ts`)
5. Salva como `Source` + `SourceTopic` se válido e não duplicado

### 6.2 Implementação

**Arquivo:** `backend/src/modules/topics/ai-source-discovery.ts`

```typescript
import { generateText } from '@/modules/ai/openai-client'
import { discoverFeeds } from '@/modules/sources/discovery-service'
import { prisma } from '@/lib/prisma'

const DISCOVERY_PROMPT = `
Você é um curador de fontes de informação confiáveis em português do Brasil.
Para o tópico "{topic}", liste 15 fontes (sites, jornais, newsletters, blogs) que:
1. Publicam conteúdo original e confiável sobre este tópico
2. Têm feed RSS/Atom público e funcional
3. São em português (PT-BR ou PT-PT)
4. Não são paywall completo (pelo menos resumos no RSS)

Responda APENAS com JSON válido:
{
  "sources": [
    { "name": "Nome da Fonte", "url": "https://site.com", "feedUrl": "https://site.com/feed.xml", "language": "pt-BR", "credibility": 9, "notes": "Por que é confiável" }
  ]
}
`

export async function discoverSourcesForTopic(topicName: string, topicSlug: string) {
  const { text: jsonText } = await generateText({
    prompt: DISCOVERY_PROMPT.replace('{topic}', topicName),
    temperature: 0.3,
    maxTokens: 2000,
  })

  const { sources } = JSON.parse(jsonText)
  const results = []

  for (const source of sources) {
    try {
      // Valida se o feed realmente existe e é parseável
      const feeds = await discoverFeeds(source.feedUrl)
      if (feeds.length > 0) {
        // Cria ou atualiza Source + SourceTopic
        const savedSource = await prisma.source.upsert({
          where: { url: source.url },
          create: {
            name: source.name,
            url: source.url,
            feedUrl: source.feedUrl,
            type: 'rss',
            enabled: true,
          },
          update: {
            feedUrl: source.feedUrl,
            enabled: true,
          },
        })

        await prisma.sourceTopic.upsert({
          where: { sourceId_topicId: { sourceId: savedSource.id, topicId: topicSlug } },
          create: { sourceId: savedSource.id, topicId: topicSlug, weight: source.credibility },
          update: { weight: source.credibility },
        })

        results.push({ ...source, saved: true, sourceId: savedSource.id })
      }
    } catch (error) {
      results.push({ ...source, saved: false, error: error.message })
    }
  }

  return results
}
```

### 6.3 Execução

- **Inicial:** Rodar via script `npm run discover:sources` (uma vez no setup)
- **Contínuo:** Job cron semanal/mensal para descobrir novas fontes
- **Manual:** Endpoint admin `POST /api/v1/admin/topics/:slug/discover-sources`

---

## 7. Cron de Coleta de Artigos (Atualização)

O `rss-cron.ts` existente já coleta de `Source` habilitadas. Com a nova estrutura:

1. Fontes descobertas via IA são salvas com `enabled: true`
2. Cron existing já as pega automaticamente
3. Artigos salvos com `sourceId`
4. **Novo:** Após salvar artigo, classificar tópicos via IA (opcional, fase 2)
   - Ou inferir tópicos via `SourceTopic` do source do artigo

---

## 8. Plano de Execução por Etapas (Vertical Slices)

### Etapa 1: Casca do Backend — Schema + Topics CRUD
- [ ] Adicionar models `Topic`, `UserTopic`, `SourceTopic`, `ArticleTopic` no `schema.prisma`
- [ ] `prisma migrate dev --name add_topics`
- [ ] Seed com `TOPICOS_INICIAIS`
- [ ] Criar `topics/service.ts` + `topics/routes.ts`
- [ ] Endpoints: `GET /topics`, `GET /topics/my`, `PUT /topics/my`
- [ ] Testes de integração (Vitest)

### Etapa 2: Onboarding Frontend
- [ ] Criar módulo `onboarding/` com `Onboarding.tsx`
- [ ] Rota `/onboarding` protegida em `App.tsx`
- [ ] UI: Grid de tópicos (cards com ícone, cor, descrição)
- [ ] Integração com `GET /topics` e `PUT /topics/my`
- [ ] Redirect para `/hoje` após salvar
- [ ] Atualizar `Login.tsx` para navegar para `/onboarding` no register

### Etapa 3: Feed Personalizado em `/hoje`
- [ ] Endpoint `GET /articles/feed` no `articles/routes.ts`
- [ ] Service `getPersonalizedFeed(userId, query)` no `articles/service.ts`
- [ ] Hook `usePersonalizedFeed` no frontend
- [ ] Atualizar `Hoje.tsx` para usar feed personalizado + filtros
- [ ] Reutilizar componentes de filtro de `Biblioteca.tsx`

### Etapa 4: Descoberta de Fontes com IA
- [ ] Criar `topics/ai-source-discovery.ts`
- [ ] Script CLI `npm run discover:sources`
- [ ] Rodar para popular `Source` + `SourceTopic` iniciais
- [ ] Verificar se cron RSS coleta corretamente

### Etapa 5: Tela de Preferências (Opcional - pode ser depois)
- [ ] Rota `/preferencias` + `Preferencias.tsx`
- [ ] UI para editar tópicos + gerenciar fontes por tópico

---

## 9. Perguntas para Alinhamento (antes de iniciar)

1. **Feed em `/hoje`:** Deve substituir completamente a "recomendação diária única" por uma lista paginada de artigos dos tópicos? Ou manter a recomendação da IA no topo + lista abaixo?
2. **Mínimo de tópicos no onboarding:** Obrigar pelo menos 1? 3? Deixar livre?
3. **Peso dos tópicos:** No onboarding, usuário só seleciona (weight=0 padrão) ou já define prioridade (drag-and-drop ou estrelas)?
4. **Classificação de artigos por tópico:** Fase 1 usa apenas `SourceTopic` (artigo herda tópicos da fonte). Fase 2 usa IA para classificar cada artigo individualmente. Começar só com herança da fonte?
5. **Fontes iniciais:** Usar o `suggestions-service.ts` hardcoded como base, ou rodar descoberta IA já na Etapa 1?
6. **Nome da rota de onboarding:** `/onboarding` ou `/boas-vindas` ou `/temas`?

---

## 10. Estimativa de Esforço

| Etapa | Backend | Frontend | Total |
|-------|---------|----------|-------|
| 1. Schema + Topics CRUD | 4h | - | 4h |
| 2. Onboarding | 1h | 3h | 4h |
| 3. Feed Personalizado | 3h | 3h | 6h |
| 4. Descoberta IA Fontes | 3h | - | 3h |
| 5. Preferências (opcional) | 1h | 2h | 3h |
| **Total** | **12h** | **8h** | **~20h** |

---

## 11. Próximos Passos Imediatos

1. **Confirmar decisões** da seção 2 e respostas da seção 9
2. **Iniciar Etapa 1** (schema + topics CRUD) com `/tdd`
3. Validar cada etapa antes de prosseguir