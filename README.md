# Daily Read

Sistema pessoal de leitura diária. Busca temas da minha escolha pessoal ou de curiosidade minha, valida feeds RSS/Atom e serve uma recomendação editorial por dia — com resumo, perguntas e explicações geradas por IA.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + Zustand + React Router v6 + PWA
- **Backend**: Fastify + TypeScript + Prisma + PostgreSQL (Neon) + Zod + Argon2id + OpenAI SDK
- **Auth**: Access token de 15 min em cookie `HttpOnly` + refresh token de 30 dias em cookie `HttpOnly` com rotação e detecção de reutilização
- **Infra**: Frontend na Vercel, backend no Render, Neon Postgres para dados, Upstash Redis (se necessário)

## Estrutura do Projeto

```
daily-read/
├── frontend/                   # React PWA (Vite)
│   ├── src/
│   │   ├── app/                # ShellHost (layout com Navigation)
│   │   ├── components/         # Componentes compartilhados (Rating, Navigation, ToastContainer, LoadingFallback)
│   │   ├── lib/
│   │   │   ├── api/            # Cliente HTTP com refresh automático
│   │   │   ├── stores/         # Zustand (authStore, uiStore)
│   │   │   └── utils/          # Helpers (date, etc.)
│   │   ├── modules/            # Feature modules: hoje, biblioteca, historico, fontes, auth, onboarding
│   │   └── types/              # Domínio
│   ├── tailwind.config.ts      # Paleta customizada (Ink/Amber/Sage)
│   ├── index.css               # Design system (cards, botões, badges, animações)
│   └── vite.config.ts
├── backend/                    # Fastify API
│   ├── src/
│   │   ├── modules/            # Feature modules: auth, articles, sources, categories, daily-recommendation, preferences, topics, ai
│   │   ├── lib/                # Prisma client, config/env, auth (cookies, password, tokens, plugin), error handler, swagger
│   │   ├── lib/routes/         # health, cron
│   │   └── jobs/               # rss-cron
│   ├── prisma/                 # schema.prisma + seed
│   └── package.json
├── prisma                      # (raiz) — schema lives in backend/prisma
├── .env.example
└── package.json                # Workspace root (concurrently para dev)
```

## Primeiros Passos

### 1. Clonar e instalar

```bash
git clone <repo>
cd daily-read
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do Neon Postgres |
| `JWT_SECRET` | Chave secreta para access tokens (mín. 32 chars) |
| `JWT_REFRESH_SECRET` | Chave secreta para refresh tokens (mín. 32 chars) |
| `COOKIE_SECRET` | Segredo para assinatura de cookies (mín. 32 chars) |
| `CORS_ORIGIN` | Origin do frontend (ex: `http://localhost:5173`) |
| `OPENAI_API_KEY` | (Opcional) Para resumos, perguntas e explicações de IA |
| `OPENAI_MODEL` | Modelo OpenAI (padrão: `gpt-4o`) |
| `CRON_SECRET` | Secret para autenticar a rota de sync externo |
| `RSS_CRON_ENABLED` | `true`/`false` — habilite sync automático via node-cron |
| `RSS_CRON_EXPRESSION` | Cron expression para sync (padrão: `0 */6 * * *`) |

### 3. Banco de dados

```bash
npm run db:generate   # Gera o cliente Prisma
npm run db:push       # Push do schema (dev)
npm run db:seed       # Popula tópicos e categorias iniciais
```

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Swagger UI: http://localhost:4000/docs
- Health: http://localhost:4000/api/health

## Comandos Úteis

```bash
# Dev
npm run dev              # Frontend + Backend (concorrencia)
npm run dev:frontend     # Vite (porta 5173)
npm run dev:backend      # tsx watch (porta 4000)

# Build
npm run build            # Build do backend (frontend via build:all)
npm run build:all        # Build de ambos os workspaces

# Banco
npm run db:generate      # prisma generate
npm run db:push          # push schema (dev)
npm run db:migrate       # migrate dev
npm run db:seed          # popula dados iniciais
npm run db:studio        # Prisma Studio
npm run db:clean         # limpa dados de teste

# Lint & Typecheck
npm run lint
cd frontend && npx tsc --noEmit
cd backend && npx tsc --noEmit

# Testes
cd frontend && npm run test
cd backend && npm run test
```

## API

Todas as rotas estão sob `/api/v1/` (exceto health e cron). Documentação browsable no Swagger UI (`/docs`).

### Auth

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/auth/register` | Público | Cria conta (name, email, password ≥ 8) |
| POST | `/auth/login` | Público | Login (email, password) → cookies |
| POST | `/auth/logout` | Público | Limpa cookies |
| POST | `/auth/refresh` | Público | Renova access token via refresh token |
| GET | `/auth/me` | Público | Retorna usuário atual |

### Fontes (Sources)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/sources` | Requerido | Lista todas as fontes (com count de artigos) |
| GET | `/sources/:id` | Requerido | Detalha uma fonte |
| POST | `/sources` | Requerido | Cria fonte (name, url, feedUrl?, type, enabled?) |
| PATCH | `/sources/:id` | Requerido | Atualiza fonte parcial |
| DELETE | `/sources/:id` | Requerido | Remove fonte |
| POST | `/sources/:id/sync` | Requerido | Sincroniza artigos do feed manualmente |
| POST | `/sources/discover` | Requerido | Descobre feeds RSS/Atom a partir de uma URL |
| GET | `/sources/suggestions` | Requerido | Lista fontes sugeridas (query, topic) |

### Tópicos (Onboarding)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/topics` | Público | Lista tópicos curados disponíveis |
| GET | `/topics/my` | Requerido | Tópicos selecionados pelo usuário |
| POST | `/topics/my/onboarding` | Requerido | Processa onboarding (topicIds) → jobId |
| GET | `/topics/my/onboarding/status/:jobId` | Requerido | Poll de status do job |
| PUT | `/topics/my` | Requerido | Atualiza tópicos do usuário |

### Artigos & Recomendação

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/articles` | Requerido | Lista artigos (paginado) |
| POST | `/articles/:id/open` | Requerido | Marca artigo como aberto |
| POST | `/articles/:id/complete` | Requerido | Marca como lido + rating |
| GET | `/daily` | Requerido | Recomendação do dia |
| GET | `/daily/:date` | Requerido | Recomendação para data específica |
| GET | `/daily/next` | Requerido | Busca outro artigo aleatório |
| GET | `/stats` | Requerido | Estatísticas de leitura |
| POST | `/ai/summarize` | Requerido | Resumo em tópicos |
| POST | `/ai/questions` | Requerido | Perguntas de fixação |
| POST | `/ai/explain` | Requerido | Explicação de conceitos |

### Cron (externo)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/cron/sync` | Header `x-cron-secret` | Sincroniza todas as fontes RSS habilitadas |

## Design System

- **Tipografia**: Fraunces (display/editorial), DM Sans (UI), JetBrains Mono (code)
- **Paleta**:
  - **Ink** — neutro quente (cinza-bege), base para texto e superfícies
  - **Amber** — acento principal (links, ações primárias)
  - **Sage** — secundária (tags, badges)
- **Componentes**: estilizados via Tailwind `@layer components` em `index.css` — cards com sombra editorial, botões com micro-interação (`active:scale-[0.98]`), badges e animações (`fadeIn`, `slideUp`)

## Onboarding

O fluxo de onboarding acontece em jobs assíncronos:

1. Usuário seleciona tópicos em `/boas-vindas`
2. Backend dispara `ai-discovery.ts` — usa OpenAI para sugerir fontes + fallbacks conhecidas por tópico
3. Valida feeds via `discovery-service.ts` ou `scraper-service.ts` (fallback para sites sem RSS)
4. Sincroniza artigos via `sync-service.ts`
5. Frontend faz polling do status do job até `completed` → navega para `/hoje`

## Licença

MIT
