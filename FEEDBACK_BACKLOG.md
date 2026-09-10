# Feedback Backlog — Daily Read

Este arquivo registra problemas percebidos durante a validação manual. Ele fica separado do `WAVES.md` para não confundir funcionalidade entregue com polimento pendente.

## Pendente

### FB-006 — Extrair hooks dedicados de dados
**Status:** backlog técnico  
**Área:** Frontend / TanStack Query  
**Prioridade:** baixa

Extrair `useArticles`, `useHistory` e `useStats` dos componentes de Biblioteca e Histórico. Atualmente os componentes usam `useQuery` co-localizado. Não é bug de funcionamento; fazer quando houver necessidade de reutilização, invalidação compartilhada ou crescimento dos módulos.

### FB-001 — Feedback visual ao marcar artigo como lido
**Status:** parcialmente resolvido  
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
**Status:** parcialmente resolvido  
**Área:** Fontes / TanStack Query  
**Prioridade:** alta

Após criar, editar, excluir ou sincronizar uma fonte, a tela precisava de F5 para refletir a alteração. Criação, edição e exclusão já invalidavam `sources`; a sincronização RSS também passou a invalidar `sources` e `articles`. Validar visualmente no ambiente publicado.

Comportamento esperado:

- nova fonte aparece sem refresh manual;
- edição atualiza nome, tipo, URL e status imediatamente;
- exclusão remove a linha imediatamente;
- sync atualiza quantidade de artigos sem F5;
- mostrar loading, sucesso e erro nas ações.

### FB-008 — Classificação automática de artigos RSS
**Status:** pendente  
**Área:** RSS / Backend  
**Prioridade:** média

Artigos importados via RSS podem chegar sem `category` e com `tags` vazias. Criar uma classificação inicial no backend usando tags/metadados do feed e fallback para uma categoria padrão, como `Ideias`, sem empurrar essa regra para o frontend.

### FB-009 — Spinner individual no sync de fontes
**Status:** pendente  
**Área:** Fontes / UX  
**Prioridade:** média

Ao sincronizar uma fonte, o spinner aparece visualmente em todos os registros da tabela. O loading deve ser controlado pelo `sourceId` em sincronização, para que somente a linha clicada mostre o spinner e fique desabilitada.

### FB-010 — Preferir fontes em português e traduzir artigos selecionados
**Status:** pendente  
**Área:** RSS / Backend / Produto  
**Prioridade:** média

A primeira estratégia não será traduzir tudo. Devemos priorizar fontes que já publiquem em português e permitir configurar o idioma preferencial da fonte.

A tradução fica como recurso posterior para artigos relevantes em outros idiomas. Ela não deve ser uma tradução literal automática: o objetivo é preservar o sentido, o contexto técnico e a naturalidade em português.

Antes de implementar, decidir:

- como identificar o idioma do feed/artigo;
- como priorizar fontes em português;
- se traduziremos apenas título e resumo ou também o conteúdo completo;
- como preservar a URL e o texto original;
- como sinalizar que um conteúdo foi traduzido;
- quando usar tradução determinística/serviço especializado e quando usar IA;
- como evitar custo duplicado com cache por URL e idioma;
- como tratar nomes próprios, termos técnicos, código, comandos e citações;
- como revisar traduções contextuais sem transformar o app em um tradutor genérico.

### FB-011 — Catálogo de fontes conhecidas
**Status:** parcialmente resolvido  
**Área:** Fontes / Produto  
**Prioridade:** baixa

Já existe um catálogo interno inicial de fontes em português, com filtros por tema e remoção visual das fontes cadastradas. Continuar ampliando e validando fontes de História, Filosofia, Ciência, Tecnologia e Notícias.

Possíveis evoluções:

- catálogo curado por idioma, país e tema;
- validação periódica dos feeds;
- descoberta por URL alimentando o catálogo;
- busca externa opcional com Tavily, Brave ou Exa, sempre com cache e limite de consultas.

### FB-012 — Podcasts narrativos e educativos em português
**Status:** pendente  
**Área:** Fontes / Conteúdo / Player  
**Prioridade:** média

Avaliar suporte a podcasts em português no estilo de programas narrativos e educativos, como História em Meia Hora, com foco em História, Filosofia, Ciência, Literatura e Cultura. Não é objetivo criar um agregador genérico de podcasts.

A fonte técnica preferencial será o RSS oficial do programa, não o Spotify. O RSS normalmente fornece título, descrição, data, duração, imagem e URL original do áudio.

Possível experiência:

- seção ou filtro de Podcasts;
- catálogo curado de programas em português;
- episódios tratados como itens de escuta;
- player HTML5 usando a URL original do áudio;
- play/pause e progresso;
- continuar de onde parou;
- marcar como ouvido;
- avaliação e histórico de escuta;
- separar métricas de leitura e escuta quando fizer sentido.

Antes de implementar, decidir se o podcast entra no mesmo modelo de `Article` ou se merece um modelo próprio, além de avaliar duração, progresso, disponibilidade e direitos de uso do áudio.

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
