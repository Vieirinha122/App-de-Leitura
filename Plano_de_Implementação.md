# Plano de Implementação - Daily Read

## Decisão de Produto

Para a primeira versão, a melhor escolha é uma aplicação web com PWA.

O app não precisa nascer em Expo porque o valor principal não depende de recursos nativos complexos. A experiência central é abrir uma leitura diária, salvar histórico, manter streak, receber recomendações e eventualmente usar IA para resumo e perguntas. Tudo isso funciona muito bem em uma PWA.

Expo passa a fazer sentido depois, se o produto provar uso recorrente e precisar de:

- push notifications mais confiáveis;
- compartilhamento nativo a partir do navegador;
- leitura offline mais refinada;
- widgets na tela inicial;
- experiência mobile com distribuição em lojas;
- maior sensação de produto pessoal instalado no celular.

Arquitetura recomendada: PWA primeiro, backend desacoplado e API preparada para um futuro cliente Expo.

## Visão do Produto

Daily Read é um sistema pessoal de leitura diária para tecnologia, programação, IA, machine learning e temas de curiosidade intelectual.

O objetivo não é mostrar cinquenta links. O objetivo é reduzir atrito:

- escolher uma leitura boa por dia;
- manter um ritual curto de leitura;
- registrar o que foi lido;
- aprender preferências do usuário;
- transformar artigos em trilhas de aprendizado;
- futuramente resumir e explicar artigos com IA.

## MVP

### Tela Hoje

Mostra a leitura recomendada do dia.

Conteúdo principal:

- saudação;
- categoria do dia;
- artigo recomendado;
- fonte;
- tempo estimado de leitura;
- botão para abrir o artigo;
- ação para marcar como lido;
- avaliação simples: não gostei, interessante, muito bom;
- contador de streak;
- navegação para dias anteriores.

### Biblioteca

Lista os artigos coletados ou cadastrados.

Filtros iniciais:

- categoria;
- fonte;
- status: novo, salvo, lido;
- avaliação.

### Histórico

Mostra leituras concluídas por mês.

Métricas iniciais:

- artigos lidos no mês;
- artigos lidos no ano;
- streak atual;
- maior streak;
- tempo estimado total de leitura.

### Fontes

Cadastro simples das fontes que alimentam o sistema.

Fontes iniciais:

- Simon Willison;
- Hugging Face Blog;
- Ahead of AI;
- The Batch;
- Martin Fowler;
- InfoQ;
- Latent Space;
- Aeon.

## Stack Recomendada

### Frontend

- React;
- TypeScript;
- Vite;
- PWA com service worker;
- Tailwind CSS ou CSS modules;
- TanStack Query para chamadas de API;
- Zustand ou Context API para estado local simples.

### Backend

- Node.js;
- TypeScript;
- Fastify;
- PostgreSQL;
- Prisma;
- jobs agendados para coleta de artigos.

### Infra Inicial

- frontend hospedado em Vercel, Netlify ou Cloudflare Pages;
- backend em Render, Railway, Fly.io ou VPS simples;
- PostgreSQL gerenciado;
- cron job no backend ou worker separado.

## Arquitetura

```txt
RSS / APIs / feeds manuais
        |
        v
Article Collector
        |
        v
PostgreSQL
        |
        v
Recommendation Engine
        |
        v
REST API
        |
        v
PWA React
```

## Módulos do Backend

### Articles

Responsável por armazenar artigos.

Campos principais:

- id;
- title;
- url;
- sourceId;
- categoryId;
- summary;
- readingTimeMinutes;
- publishedAt;
- collectedAt;
- tags;
- status.

### Sources

Responsável por fontes de conteúdo.

Campos principais:

- id;
- name;
- url;
- feedUrl;
- type: rss, newsletter, manual, api;
- enabled.

### Categories

Categorias iniciais:

- Programação;
- Engenharia de Software;
- AI Engineering;
- Machine Learning;
- LLMs;
- Ciência;
- Ideias.

### Reading History

Registra interação do usuário com artigos.

Campos principais:

- userId;
- articleId;
- openedAt;
- completedAt;
- rating;
- notes.

### Daily Recommendation

Define qual artigo aparece como leitura do dia.

Regra inicial:

- priorizar artigos ainda não lidos;
- alternar categorias ao longo da semana;
- evitar repetir a mesma fonte em dias consecutivos;
- favorecer artigos com menor tempo de leitura nos dias úteis;
- permitir escolha manual quando necessário.

## Modelo de Dados Inicial

```prisma
model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
}

model Source {
  id      String  @id @default(cuid())
  name    String
  url     String
  feedUrl String?
  type    String
  enabled Boolean @default(true)

  articles Article[]
}

model Category {
  id       String    @id @default(cuid())
  name     String
  articles Article[]
}

model Article {
  id                 String   @id @default(cuid())
  title              String
  url                String   @unique
  summary            String?
  readingTimeMinutes Int?
  publishedAt        DateTime?
  collectedAt        DateTime @default(now())
  status             String   @default("new")

  sourceId   String
  categoryId String?

  source   Source    @relation(fields: [sourceId], references: [id])
  category Category? @relation(fields: [categoryId], references: [id])
  history  ReadingHistory[]
}

model ReadingHistory {
  id          String    @id @default(cuid())
  userId      String
  articleId   String
  openedAt    DateTime?
  completedAt DateTime?
  rating      String?
  notes       String?

  article Article @relation(fields: [articleId], references: [id])
}
```

## Roadmap

### v0 - Protótipo Local

- criar PWA com React;
- cadastrar artigos manualmente em mock ou seed;
- exibir leitura do dia;
- marcar artigo como lido;
- registrar avaliação;
- mostrar histórico básico.

### v1 - Produto Usável

- backend com Fastify;
- PostgreSQL com Prisma;
- CRUD de fontes;
- importação por RSS;
- recomendação diária simples;
- autenticação;
- PWA instalável no celular.

### v2 - Hábito e Retenção

- streak;
- estatísticas;
- metas semanais;
- biblioteca com filtros;
- salvar para ler depois;
- notificações web;
- leitura offline básica.

### v3 - Recomendação

- preferências por categoria;
- pesos por avaliação;
- rotação inteligente de fontes;
- recomendações baseadas em histórico;
- trilhas de leitura por tema.

### v4 - IA

- resumo curto do artigo;
- tópicos que o usuário vai aprender;
- perguntas de fixação;
- explicação de conceitos difíceis;
- classificação automática por tema;
- embeddings para similaridade entre artigos.

### v5 - Cliente Expo, se fizer sentido

- app mobile consumindo a mesma API;
- push notifications nativas;
- share extension para salvar artigo;
- leitura offline mais robusta;
- widgets ou atalhos de leitura diária.

## Critério Para Migrar ou Adicionar Expo

Não migrar para Expo por estética ou ansiedade de produto.

Adicionar Expo quando pelo menos dois destes sinais existirem:

- você usa a PWA por várias semanas e sente falta de integração nativa;
- notificações web forem insuficientes;
- salvar artigos pelo compartilhamento do celular virar parte central do fluxo;
- leitura offline for essencial;
- houver intenção real de publicar em loja;
- outras pessoas começarem a usar e pedirem experiência mobile mais polida.

## Estratégia de Desenvolvimento

Começar pequeno.

Primeiro objetivo: abrir o app todos os dias e ter exatamente uma boa leitura esperando.

A ordem ideal é:

1. PWA visual com dados mockados.
2. Persistência local ou backend simples.
3. Histórico e streak.
4. Coleta RSS.
5. Recomendação.
6. IA.
7. Expo, se houver demanda real.

## Conclusão

PWA é a escolha mais inteligente para começar.

Ela entrega rápido, usa tecnologias que já combinam com o objetivo de estudo, permite testar o hábito no mundo real e não fecha a porta para um app Expo depois.

O projeto deve nascer como um sistema de leitura diária, não como um leitor de RSS genérico. A diferença central é curadoria, hábito e aprendizado contínuo.
