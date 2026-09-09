# Feedback Backlog — Daily Read

Este arquivo registra problemas percebidos durante a validação manual. Ele fica separado do `WAVES.md` para não confundir funcionalidade entregue com polimento pendente.

## Pendente

### FB-006 — Extrair hooks dedicados de dados
**Status:** backlog técnico  
**Área:** Frontend / TanStack Query  
**Prioridade:** baixa

Extrair `useArticles`, `useHistory` e `useStats` dos componentes de Biblioteca e Histórico. Atualmente os componentes usam `useQuery` co-localizado. Não é bug de funcionamento; fazer quando houver necessidade de reutilização, invalidação compartilhada ou crescimento dos módulos.

### FB-001 — Feedback visual ao marcar artigo como lido
**Status:** pendente  
**Área:** Hoje / Biblioteca  
**Prioridade:** alta

Ao clicar em **Marcar como lido**, a interface precisa deixar claro que a ação foi concluída:

- botão entra em estado de loading enquanto a requisição está em andamento;
- botão fica desabilitado durante a mutação para evitar duplo clique;
- feedback visual de sucesso no próprio card ou via toast;
- artigo deve refletir imediatamente o status `Lido`;
- em caso de erro, manter o estado anterior e mostrar mensagem acionável.

### FB-002 — Feedback visual ao avaliar artigo
**Status:** pendente  
**Área:** Hoje / Rating  
**Prioridade:** alta

Ao clicar em uma opção de rating:

- opção selecionada deve ficar visualmente ativa;
- controles devem ficar desabilitados durante a requisição;
- mostrar loading sem perder a seleção do usuário;
- confirmar sucesso visualmente;
- em caso de erro, permitir tentar novamente sem estado falso.

### FB-003 — Atualização automática Biblioteca → Histórico
**Status:** pendente  
**Área:** Biblioteca / Histórico  
**Prioridade:** alta

Hoje, ao marcar um artigo como lido na Biblioteca e navegar para o Histórico, é necessário dar F5 para visualizar a nova leitura.

Comportamento esperado:

- após `PATCH /api/v1/articles/:id` com `status=read`, invalidar ou atualizar as queries de `articles` e `history`;
- ao navegar para Histórico, os dados devem estar atualizados sem refresh manual;
- a mutação deve sincronizar `Article.status` e `ReadingHistory.completedAt`;
- evitar chamadas duplicadas desnecessárias.

### FB-004 — Atualização automática Hoje → Biblioteca/Histórico
**Status:** pendente  
**Área:** Hoje / Biblioteca / Histórico  
**Prioridade:** alta

Ao concluir uma leitura no Daily:

- invalidar a recomendação atual;
- atualizar Biblioteca para refletir `status=read`;
- atualizar Histórico para incluir a leitura concluída;
- atualizar streak e métricas;
- remover ou substituir a recomendação concluída sem exigir F5.

### FB-005 — Reparar históricos legados sem ReadingHistory
**Status:** pendente  
**Área:** Backend / dados  
**Prioridade:** alta

Existem artigos com `Article.status=read` mas sem registro em `ReadingHistory`, criados antes da sincronização dos dois fluxos.

Precisamos escolher e executar uma estratégia:

- migration/script idempotente para criar histórico com `completedAt` baseado em `updatedAt`; ou
- endpoint/admin job temporário para reparação controlada.

A data será aproximada, pois o momento real da leitura não foi persistido.

### FB-007 — Atualização automática da tela de Fontes
**Status:** pendente  
**Área:** Fontes / TanStack Query  
**Prioridade:** alta

Após criar, editar, excluir ou sincronizar uma fonte, a tela só deve refletir a alteração depois de um F5. Corrigir invalidando ou atualizando a query `sources` após cada mutação.

Comportamento esperado:

- nova fonte aparece sem refresh manual;
- edição atualiza nome, tipo, URL e status imediatamente;
- exclusão remove a linha imediatamente;
- sync atualiza quantidade de artigos sem F5;
- mostrar loading, sucesso e erro nas ações.

## Decisões de implementação

- Regra de negócio fica no backend: marcar como lido sempre atualiza artigo e histórico em transação.
- TanStack Query é responsável pela sincronização de cache no frontend.
- Não usar `window.location.reload()` como solução.
- Toda mutação deve possuir estados `idle`, `pending`, `success` e `error` visíveis quando fizer sentido.

## Critério para encerrar este backlog

- Biblioteca → marcar como lido → abrir Histórico sem F5 → leitura aparece.
- Hoje → avaliar/concluir → Biblioteca e Histórico refletem a alteração sem F5.
- Rating e “Marcar como lido” possuem loading, sucesso e erro visíveis.
- Artigos legados sem histórico foram tratados e validados no banco.
