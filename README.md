# Daily Read

Sistema pessoal de leitura diária para tecnologia, programação, IA, machine learning e temas de curiosidade intelectual.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query + Zustand + PWA
- **Backend**: Fastify + TypeScript + Prisma + PostgreSQL (Neon) + Zod + Argon2id
- **Auth**: Access token (15min, memory) + Refresh token (30d, HttpOnly cookie, rotation + reuse detection)

## Estrutura do Projeto

```
daily-read/
├── frontend/                 # React PWA
│   ├── src/
│   │   ├── app/             # Providers, router, shell
│   │   ├── lib/             # API client, stores, auth, utils
│   │   ├── modules/         # Feature modules (hoje, biblioteca, historico, fontes)
│   │   ├── components/      # Shared UI components
│   │   └── types/           # Domain types
│   └── ...
├── backend/                  # Fastify API
│   ├── src/
│   │   ├── modules/         # Feature modules (auth, articles, sources, categories, reading-history, daily-recommendation)
│   │   ├── lib/             # Prisma, config, auth, errors
│   │   └── routes/          # Health, etc.
│   └── prisma/              # Schema + migrations
└── WAVES.md                 # Implementation plan by waves
```

## Comandos

```bash
# Install all dependencies
npm install

# Development (runs frontend:3000 + backend:4000)
npm run dev

# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend

# Build all
npm run build

# Database
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to DB (dev)
npm run db:migrate    # Run migrations
npm run db:seed       # Seed initial data
npm run db:studio     # Open Prisma Studio

# Lint
npm run lint
```

## Configuração Inicial

1. **Clone e instale:**
   ```bash
   git clone <repo>
   cd daily-read
   npm install
   ```

2. **Configure variáveis de ambiente:**
   ```bash
   cp .env.example .env
   # Edite .env com suas credenciais (DATABASE_URL, JWT secrets, etc.)
   ```

3. **Banco de dados (Neon Postgres):**
   - Crie um projeto no [Neon](https://neon.tech)
   - Copie a connection string para `DATABASE_URL` no `.env`
   - Rode: `npm run db:generate && npm run db:push`

4. **Inicie:**
   ```bash
   npm run dev
   ```
   - Frontend: http://localhost:3000
   - Backend: http://localhost:4000
   - Swagger: http://localhost:4000/docs

## Ondas de Implementação

Veja [`WAVES.md`](WAVES.md) para o plano detalhado por ondas.

| Onda | Foco | Status |
|------|------|--------|
| 0 | Casca do projeto (este commit) | ✅ |
| 1 | Autenticação real | ⏳ |
| 2 | Módulo "Hoje" (leitura diária) | ⏳ |
| 3 | Biblioteca + Histórico | ⏳ |
| 4 | Fontes (CRUD + RSS) | ⏳ |
| 5 | Recomendação inteligente v2 | ⏳ |
| 6 | IA (resumo, perguntas, embeddings) | ⏳ |
| 7 | PWA hardening + Deploy | ⏳ |

## Identidade Visual

- **Tipografia**: Fraunces (display) + DM Sans (UI) + JetBrains Mono (code)
- **Paleta**: Ink (neutro quente) + Amber (acento) + Sage (secundária)
- **Componentes**: Baseados em Radix primitives (shadcn-style) mas com identidade própria — sem cara de IA genérica

## Scripts Úteis

```bash
# Typecheck frontend
cd frontend && npx tsc --noEmit

# Typecheck backend
cd backend && npx tsc --noEmit

# Test frontend
cd frontend && npm run test

# Test backend
cd backend && npm run test
```

## Deploy

- **Frontend**: Vercel / Cloudflare Pages
- **Backend**: Railway / Fly.io / Render / VPS
- **Database**: Neon Postgres (já configurado)
- **Redis**: Upstash (serverless) se necessário para BullMQ

## Licença

MIT