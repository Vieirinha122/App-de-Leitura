# WAVES — Plano de Implementação por Ondas

## Princípios
- **Uma onda por PR** — cada onda entrega valor testável
- **Vertical slice** — front + back + banco juntos, não por camada
- **TDD leve** — teste de contrato (API) + teste de componente crítico
- **Não avançar** se a onda anterior não passa no `lint` + `typecheck` + `test`

---

## ONDA 0 — Casca do Projeto (este commit)
**Objetivo:** Repo buildando, tipado, com dev server front/back rodando.

### Frontend
- [x] Vite + React 18 + TS + Tailwind + PWA configurado
- [x] TanStack Query + Zustand stores (auth, ui)
- [x] React Router v6 com lazy-loading por módulo
- [x] API client (`apiFetch`) com retry 401 → endpoint `/auth/refresh`
- [x] Tipos de domínio (`Article`, `Source`, `Category`, `ReadingHistory`, `DailyRecommendation`)
- [x] Componentes base: `Navigation`, `LoadingFallback`, `ToastContainer`, `Rating`, `Button variants`
- [x] Identidade visual própria (fontes: Fraunces/DM Sans/JetBrains Mono, paleta ink/amber/sage)
- [x] ShellHost + rotas protegidas placeholder

### Backend
- [x] Fastify + TS + Helmet + CORS + Rate-limit + Cookie + JWT
- [x] Prisma schema (User, Source, Category, Article, ReadingHistory, DailyRecommendation)
- [x] Estrutura de módulos: `articles`, `sources`, `categories`, `reading-history`, `daily-recommendation`, `auth`
- [x] Endpoint `POST /api/v1/auth/refresh` (rotaciona access token via cookie HttpOnly)
- [x] Zod validation pipes + error handling padronizado
- [x] Pino logger + health check `/health`

### Infra/Dev
- [x] `package.json` raiz com workspaces + scripts `dev`, `build`, `db:*`
- [x] `.env.example` front + back
- [x] README com comandos
- [x] Neon Postgres (produção) + Postgres local opcional via instalador nativo
- [x] Redis local opcional (para BullMQ) — pode usar Upstash em produção

---

## ONDA 1 — Autenticação Real
**Objetivo:** Login/registro/logout funcionando, usuário persistido, rota protegida.

### Backend
- [x] `POST /api/v1/auth/register` — cria usuário, hash Argon2id, seta cookies (access + refresh)
- [x] `POST /api/v1/auth/login` — valida credenciais, seta cookies
- [x] `POST /api/v1/auth/logout` — limpa cookies, invalida refresh token no banco
- [x] `GET /api/v1/auth/me` — retorna usuário do access token
- [x] `POST /api/v1/auth/refresh` — rotação de access token (refresh token em cookie HttpOnly, rotação + reuse detection)
- [x] Middleware `requireAuth` + `optionalAuth`
- [ ] Teste de contrato (supertest) para cada endpoint

### Frontend
- [x] `authStore.checkAuth()` chamado no bootstrap
- [x] Tela de Login/Registro (rota pública fora do ShellHost)
- [x] Redirect automático pós-login para `/hoje`
- [x] Logout no header (desktop) / menu (mobile)
- [x] Toast de erro/sucesso via `uiStore`

### Critério de aceite
- Usuário se registra, loga, navega entre abas, faz refresh da página → continua logado
- Fecha aba, abre depois → continua logado (refresh token válido)

---

## ONDA 2 — Módulo "Hoje" (Leitura Diária)
**Objetivo:** Tela principal exibindo artigo do dia + ações (abrir, marcar lido, avaliar).

### Backend
- [x] `GET /api/v1/daily` — retorna `DailyRecommendation` de hoje para o usuário autenticado
- [x] Lógica de recomendação v1: primeiro artigo `status=new` não lido, rotacionando categoria/fonte
- [x] `POST /api/v1/daily/:id/open` — registra `openedAt` no `ReadingHistory`
- [x] `POST /api/v1/daily/:id/complete` — registra `completedAt` + `rating` + `notes`
- [x] Seed: 8 fontes do plano + 26 artigos mockados distribuídos em 7 categorias
- [x] `GET /api/v1/daily/stats` — streak atual/maior, contadores mês/ano, tempo total, breakdown por categoria/fonte/mês

### Frontend
- [x] Módulo `hoje` com `Hoje.tsx` + `service.ts` + `index.ts`
- [x] `useDailyRecommendation` hook (TanStack Query)
- [x] UI: saudação + categoria + artigo (título, fonte, tempo, tags) + botões
- [x] `Rating` component integrado
- [x] Navegação para dias anteriores (setas ou calendar picker)
- [x] Streak counter no header da tela

### Critério de aceite
- Abre app → vê leitura do dia
- Clica "Ler" → abre artigo em nova aba, registra `openedAt`
- Avalia → registra `completedAt` + rating, artigo some da recomendação do dia
- Volta amanhã → nova recomendação

---

## ONDA 3 — Biblioteca + Histórico
**Objetivo:** Listar/filtrar artigos salvos/lidos + métricas de hábito.

### Backend
- [x] `GET /api/v1/articles` — paginado, filtros (categoria, fonte, status, rating, search)
- [x] `GET /api/v1/articles/:id` — detalhe
- [x] `PATCH /api/v1/articles/:id` — update status (save/unsave/archive)
- [x] `GET /api/v1/history` — leituras concluídas com paginação + filtros por mês
- [x] `GET /api/v1/daily/stats` — streak atual/maior, contadores mês/ano, tempo total, breakdown por categoria/fonte/mês

### Frontend
- [x] Módulo `biblioteca`: grid/list toggle, busca, filtros de status, status chips
- [x] Módulo `historico`: timeline, cards de leitura, painel de stats
- [x] Services tipados para artigos, histórico e stats
- [ ] `useArticles`, `useHistory`, `useStats` hooks dedicados — melhoria de organização, sem impacto funcional imediato; movido para `FEEDBACK_BACKLOG.md`

### Critério de aceite
- Biblioteca mostra todos os artigos com filtros funcionando
- Histórico mostra meses passados com métricas corretas
- Streak atualiza corretamente ao completar leituras em dias consecutivos

---

## ONDA 4 — Fontes (CRUD + RSS Import + Descoberta Guiada)
**Objetivo:** Gerenciar fontes e popular artigos via RSS.

### Backend
- [x] CRUD completo `/api/v1/sources` (list, get, create, update, delete)
- [x] Job agendado `collect:rss` — scheduler opcional com `node-cron`, sem Redis/BullMQ
- [x] Deduplicação por URL global ao importar RSS
- [x] `POST /api/v1/sources/:id/sync` — trigger manual de coleta

### Frontend
- [x] Módulo `fontes`: tabela com ações, modal create/edit, toggle enabled, botão sync
- [x] Feedback de sync + contagem de artigos importados/ignorados via toast

### Critério de aceite
- [x] Adiciona feed RSS válido → artigos aparecem na biblioteca após sync
- [x] Fontes inválidas mostram erro claro
- [x] Usuário leigo pode colar a URL de um site e selecionar um feed encontrado
- [x] Catálogo interno de fontes sugeridas em português com filtro por tema
- [x] Fontes já cadastradas são removidas visualmente das sugestões

### Descoberta guiada
- [x] `POST /api/v1/sources/discover`
- [x] Descoberta de links RSS/Atom declarados no HTML
- [x] Fluxo frontend para informar site, selecionar feed e preencher cadastro
- [x] Proteções básicas contra SSRF, redirects, respostas grandes e timeout

---

## ONDA 5 — Recomendação Inteligente v2
**Objetivo:** Algoritmo que aprende com avaliações.

### Backend
- [x] Pesos por categoria/fonte (baseado em ratings e preferências)
- [x] Rotação de fontes (evitar mesma fonte 2 dias seguidos)
- [x] Preferir tempo de leitura menor em dias úteis
- [x] Fallback seguro quando não houver candidato ideal
- [x] Preferências persistidas de fonte/categoria via `/api/v1/preferences` + migration `add_user_preferences`

### Frontend
- [x] Indicador visual de "por que este artigo foi recomendado"
- [x] Opção de bloquear/desbloquear fonte na tela Fontes
- [x] Opção de bloquear/desbloquear categoria na Biblioteca

---

## ONDA 6 — IA (Resumo + Perguntas + Embeddings)

### Progresso atual
- [x] Módulo OpenAI no backend usando Responses API
- [x] Endpoints protegidos `POST /api/v1/ai/summarize`, `/questions` e `/explain`
- [x] Saída estruturada contextual em `pt-BR`
- [x] Cache/persistência de resumo, perguntas e explicação no artigo
- [x] Rate limit específico nas rotas de IA
- [x] Limite configurável de tokens (`OPENAI_MAX_OUTPUT_TOKENS`)
- [x] Ações `Resumir`, `Perguntas` e `Explicar` na interface do Daily
- [ ] Embeddings e artigos relacionados — ONDA 6.1 (pgvector, modelo de embedding, migration vetorial)
**Objetivo:** Features de IA sobre artigos.

### Backend
- [ ] `POST /api/v1/ai/summarize` — resumo curto (2-3 bullets)
- [ ] `POST /api/v1/ai/questions` — 3 perguntas de fixação
- [ ] `POST /api/v1/ai/explain` — explica conceito técnico do artigo
- [ ] Embeddings (pgvector) para similaridade + "artigos relacionados"
- [ ] Classificação automática de categoria/tags

### Frontend
- [ ] Botão "Resumir" no artigo (modal/expansão)
- [ ] Seção "O que você vai aprender" + perguntas
- [ ] Cards "Relacionados" na biblioteca/histórico

---

## ONDA 7 — PWA Hardening + Deploy
**Status:** ✅ Deploy realizado (Frontend → Vercel, Backend → Render)
**Objetivo:** Instalável, offline-first básico, deploy validado.

### Frontend
- [x] Deploy Frontend → Vercel
- [ ] Service worker: cache shell + API GET (NetworkFirst)
- [ ] Offline fallback page
- [ ] Web App Manifest completo (ícones, shortcuts)
- [ ] Meta tags PWA (apple-mobile-web-app-capable, etc.)

### Backend
- [x] Deploy Backend → Render
- [x] Rate-limit por IP + por user
- [x] Helmet CSP ajustado
- [x] Logs estruturados (request-id, user-id)
- [ ] Health check com dependências (DB, Redis)
- [ ] Rate-limit por IP + por user (revisar produção)

### Deploy
- [x] Frontend → Vercel
- [x] Backend → Render
- [x] Neon Postgres (desde ONDA 0)
- [ ] Redis → Upstash (serverless) ou Redis local se necessário
- [ ] Variáveis de produção documentadas

---

## ONDA 8 — Expo (se houver demanda real)
**Critério:** Pelo menos 2 sinais do plano original (notificações web insuficientes, share extension essencial, offline crítico, intenção de loja, outros usuários pedindo).

---

## Checklist de Qualidade por Onda
| Item | Onda 0 | Onda 1+ |
|------|--------|---------|
| `npm run lint` passa | ✅ | ✅ |
| `npm run typecheck` passa | ✅ | ✅ |
| `npm run test` passa | — | ✅ |
| Cobertura mínima 70% (linhas críticas) | — | ✅ |
| ADR atualizado se decisão arquitetural | — | ✅ |
| `CHANGELOG.md` atualizado | ✅ | ✅ |

---

## Convenções de Commit
```
feat(wave-1): auth login/register endpoints
fix(wave-2): daily recommendation returns 404 when no articles
refactor(wave-0): extract api client to lib
chore: update deps
docs: add wave-1 acceptance criteria
```

---

## Próxima Ação Imediata
> **Você está na ONDA 3.** A ONDA 0, 1 e 2 estão completas.
> A base da ONDA 3 foi implementada; falta validação em runtime e refinamento de cache/feedback.
> Próximo passo: validar a Biblioteca + Histórico no Render/Vercel.
>
> Feedbacks de UX e sincronização sem F5 estão documentados em [`FEEDBACK_BACKLOG.md`](FEEDBACK_BACKLOG.md).