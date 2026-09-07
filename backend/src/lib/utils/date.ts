/**
 * Utilitários de data — Backend (Daily Read)
 *
 * Por que isso existe?
 * O middleware do Prisma (prisma.ts) armazena os timestamps como horário LOCAL
 * (BRT, UTC-3) em colunas TIMESTAMP WITHOUT TIME ZONE.
 * Quando o Prisma lê de volta, o driver JS interpreta o valor como UTC e cria
 * um Date com sufixo Z — ex: "11:14Z" quando na verdade é "11:14 BRT = 14:14 UTC".
 *
 * A função `toApiDate` corrige isso: re-adiciona o offset do processo (que com
 * TZ=America/Sao_Paulo é 180min) antes de serializar, devolvendo o UTC real.
 * O frontend pode então usar parseISO() normalmente e exibir no fuso local.
 */

/**
 * Converte um Date lido do banco (armazenado como BRT mas interpretado como UTC)
 * para uma ISO string com o UTC real correto.
 *
 * Exemplo:
 *   Banco armazena: "2026-09-07 11:14:07.828"  (BRT local)
 *   Prisma lê como: Date("2026-09-07T11:14:07.828Z")  (errado — trata como UTC)
 *   toApiDate()  → "2026-09-07T14:14:07.828Z"  (UTC real — frontend exibe 11:14 BRT ✅)
 */
export function toApiDate(date: Date): string {
  // getTimezoneOffset() retorna 180 com TZ=America/Sao_Paulo (minutos atrás do UTC)
  const offsetMs = new Date().getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() + offsetMs).toISOString()
}
