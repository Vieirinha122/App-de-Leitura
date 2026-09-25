# Tasks — Feature 2: Onboarding de Tópicos + Daily Read Personalizado

---

## Fluxo Atualizado

1. **Registro** → `/boas-vindas` (mínimo 1 tópico, sugestão 3-5)
2. **Salva tópicos** → Backend roda **IA para descobrir fontes** por tópico → **valida RSS** → **salva Sources + SourceTopics** → **roda sync RSS** inicial
3. **Frontend** mostra loading "Preparando seu daily read..." durante esse processo
4. **Concluído** → Redireciona para `/hoje` → Daily Read já personalizado pelos tópicos

---

## ✅ Tasks — Etapa 1: Schema Prisma + Models

- [x] 1.1 Adicionar models `Topic`, `UserTopic`, `SourceTopic` no `schema.prisma`
- [x] 1.2 Adicionar campo `onboardingCompleted` no model `User`
- [x] 1.3 Rodar `prisma migrate dev --name add_topics_onboarding`
- [x] 1.4 Criar seed com 10 tópicos curados (Tech, Ciência, Filosofia, História, Economia, Psicologia, Meio Ambiente, Cultura, Política, Educação)
- [x] 1.5 Testar migração e seed localmente

---

## ✅ Tasks — Etapa 2: Backend — Topics CRUD + IA Discovery + Sync no Onboarding

- [x] 2.1 Criar `backend/src/modules/topics/service.ts` com:
  - [x] `listTopics()` — lista tópicos ativos (para `/boas-vindas`)
  - [x] `getUserTopics(userId)` — tópicos do usuário
  - [x] `setUserTopics(userId, topicIds)` — salva seleção + dispara job assíncrono (mockado por enquanto)
  - [x] `getOnboardingStatus(jobId)` — polling de status
- [ ] 2.2 Criar `backend/src/modules/topics/ai-discovery.ts`:
  - [ ] `discoverSourcesForTopics(topicNames: string[])` — chama LLM para listar fontes confiáveis por tópico
  - [ ] Valida RSS via `discovery-service.ts` existente
  - [ ] Salva `Source` + `SourceTopic` (upsert)
  - [ ] Retorna resumo do que foi salvo
- [ ] 2.3 Criar `backend/src/modules/topics/sync-service.ts`:
  - [ ] `syncNewSources(sourceIds: string[])` — roda RSS sync apenas para as fontes recém-descobertas
  - [ ] Reutiliza lógica do `rss-cron.ts` / `sync-service.ts` existente
- [x] 2.4 Criar `backend/src/modules/topics/routes.ts`:
  - [x] `GET /api/v1/topics` — lista tópicos (público)
  - [x] `GET /api/v1/topics/my` — tópicos do usuário
  - [x] `POST /api/v1/topics/my/onboarding` — salva tópicos + dispara job mockado + retorna jobId/status
  - [x] `GET /api/v1/topics/my/onboarding/status/:jobId` — polling de status (processing → completed → error)
- [x] 2.5 Registrar rotas em `app.ts`
- [ ] 2.6 Testes de integração (Vitest) para endpoints

---

## ✅ Tasks — Etapa 3: Frontend — Tela `/boas-vindas` + Loading + Integração

- [x] 3.1 Criar módulo `frontend/src/modules/boas-vindas/` (renomeado para `onboarding`):
  - [x] `Onboarding.tsx` — tela principal (com header contador + progress bar, grid responsivo 1/2/3 colunas)
  - [x] `TopicCard.tsx` — card de tópico clicável inteiro (ícone, cor, descrição, seleção visual)
  - [x] Loading inline "Preparando seu daily read..." com polling de status
- [x] 3.2 Adicionar rota `/boas-vindas` protegida em `App.tsx` (usa `ProtectedNoNavLayout` sem Navigation fixa)
- [x] 3.3 Hook `useOnboarding()` — `GET /topics` + `POST /topics/my/onboarding` + polling status
- [x] 3.4 Lógica em `Onboarding.tsx`:
  - [x] Carrega tópicos
  - [x] Usuário seleciona (mín 1, sugestão 3-5, contador no header)
  - [x] Submit → chama onboarding → mostra loading → polling status
  - [x] Sucesso → `navigate('/hoje', { replace: true })`
- [x] 3.5 Atualizar `Login.tsx`:
  - [x] No `register()`: navegar para `/boas-vindas` (com `setTimeout` pra cookies)
  - [x] Email normalization já OK (`trim().toLowerCase()`)
- [x] 3.6 Atualizar `authStore.ts`:
  - [x] Adicionar `onboardingCompleted` no user persistido
  - [x] `checkAuth()` verifica se precisa redirecionar para `/boas-vindas`

---

## ✅ Tasks — Etapa 4: Daily Read Personalizado (Integração com `/hoje`)

- [x] 4.1 Atualizar `daily-recommendation/service.ts`:
  - [x] `generateDailyRecommendation(userId)` — busca artigos dos tópicos do usuário (via `UserTopic` → `SourceTopic` → `Article`)
  - [x] Filtra: status `new`, publicado recente, não lido
  - [x] Seleciona 1 artigo (algoritmo: score por tópico + recência + diversity)
  - [x] **Fallback**: se nenhum artigo dos tópicos, pega artigo geral "new"
  - [x] Salva em `DailyRecommendation`
- [x] 4.2 Atualizar `daily-recommendation/routes.ts`:
  - [x] `GET /api/v1/daily` — usa lógica personalizada com fallback
- [ ] 4.3 Job cron existente (`rss-cron.ts`) já roda periodicamente — OK
- [ ] **PENDENTE**: IA Discovery + Sync real no onboarding para popular fontes/artigos por tópico (remove necessidade de fallback)

---

## ✅ Tasks — Etapa 5: Ajustes Finais + Polimento

- [ ] 5.1 Tratamento de erros no onboarding (fallback se IA falhar, sources não tiverem RSS)
- [ ] 5.2 Loading state UX: mensagens dinâmicas ("Encontrando fontes...", "Baixando artigos...", "Quase pronto...")
- [x] 5.3 Se usuário já tem onboardingCompleted → `/boas-vindas` redireciona para `/hoje`
- [ ] 5.4 Testes E2E manuais: register → boas-vindas → loading → hoje (bloqueado por erro no ProtectedRoute)
- [x] 5.5 Documentar no `PLANO_FEATURE_2.md` o que foi implementado vs planejado
- [x] **UI Polish**: Header com contador + progress bar, grid responsivo, TopicCard full-clickable
- [x] **Auth fix**: `/api/v1/topics` público, `req.user.id` correto, validação CUID
- [x] **TypeScript**: compila sem erros
- [ ] **Bug crítico**: "Cannot convert object to primitive value" em `ProtectedRoute` (App.tsx) — impede teste no browser

---

## 📝 Notas Técnicas Importantes

### Endpoint de Onboarding (assíncrono com polling)

```typescript
// POST /api/v1/topics/my/onboarding
// Body: { topicIds: string[] }
// Response: { jobId: string, status: 'processing' }

// GET /api/v1/topics/my/onboarding/status/:jobId
// Response: { status: 'processing' | 'completed' | 'error', progress?: string, error?: string }
```

### Implementação do job assíncrono (simples, sem fila externa)

```typescript
// topics/service.ts
const onboardingJobs = new Map<string, { status: 'processing' | 'completed' | 'error'; progress: string; error?: string }>()

export async function startOnboarding(userId: string, topicIds: string[]) {
  const jobId = crypto.randomUUID()
  onboardingJobs.set(jobId, { status: 'processing', progress: 'Iniciando...' })

  // Executa em background (não await)
  runOnboardingJob(jobId, userId, topicIds).catch(err => {
    onboardingJobs.set(jobId, { status: 'error', progress: 'Erro', error: err.message })
  })

  return { jobId, status: 'processing' as const }
}

async function runOnboardingJob(jobId: string, userId: string, topicIds: string[]) {
  // 1. Salva UserTopic
  updateProgress(jobId, 'Salvando seus tópicos...')
  await setUserTopics(userId, topicIds)

  // 2. Busca nomes dos tópicos
  updateProgress(jobId, 'Buscando fontes confiáveis com IA...')
  const topics = await prisma.topic.findMany({ where: { id: { in: topicIds } } })

  // 3. IA Discovery
  const discoveryResult = await discoverSourcesForTopics(topics.map(t => t.name))

  // 4. Sync RSS das novas fontes
  updateProgress(jobId, 'Baixando primeiros artigos...')
  const newSourceIds = discoveryResult.flatMap(r => r.saved ? [r.sourceId] : [])
  if (newSourceIds.length > 0) {
    await syncNewSources(newSourceIds)
  }

  // 5. Gera primeira daily recommendation
  updateProgress(jobId, 'Preparando sua primeira leitura...')
  await generateDailyRecommendation(userId)

  onboardingJobs.set(jobId, { status: 'completed', progress: 'Pronto!' })
}
```

---

## 🎯 Próximo Passo Imediato

**Corrigir bug no `ProtectedRoute`** — erro "Cannot convert object to primitive value" durante lazy loading/Suspense, impede teste no browser.

Depois: testar fluxo completo no browser → register → `/boas-vindas` → selecionar tópicos → polling → `/hoje`.

**Pós-launch da tela**: implementar IA Discovery + Sync real (Etapa 2.2, 2.3) para remover fallback no daily read.