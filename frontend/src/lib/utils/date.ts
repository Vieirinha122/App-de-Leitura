/**
 * Utilitários de data para o Daily Read.
 *
 * Padrão adotado:
 * - O backend roda com TZ=America/Sao_Paulo (via cross-env no package.json),
 *   então o `now()` e todas as datas geradas pelo Prisma/Node já são gravadas
 *   no horário de Brasília — sem defasagem de 3h no banco.
 * - A API trafega as datas como strings ISO 8601.
 * - A formatação para exibição é feita aqui no frontend usando as funções abaixo,
 *   que respeitam o fuso local do navegador via date-fns (parseISO).
 * - Nunca salve strings de data sem timezone no banco de dados.
 */

import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Converte uma string ISO UTC em um objeto Date ajustado para o fuso local do navegador.
 * Use esta função como ponto de entrada antes de qualquer formatação.
 *
 * @example toLocalDate("2026-09-07T13:03:51.000Z") // => Date (10:03:51 no Recife UTC-3)
 */
export function toLocalDate(isoString: string): Date {
  return parseISO(isoString)
}

/**
 * Formata uma data para exibição no padrão brasileiro completo.
 * Ex: "07/09/2026 às 10:03"
 */
export function formatDateTime(isoString: string): string {
  return format(toLocalDate(isoString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

/**
 * Formata apenas a data no padrão brasileiro.
 * Ex: "07/09/2026"
 */
export function formatDate(isoString: string): string {
  return format(toLocalDate(isoString), 'dd/MM/yyyy', { locale: ptBR })
}

/**
 * Formata apenas o horário local.
 * Ex: "10:03"
 */
export function formatTime(isoString: string): string {
  return format(toLocalDate(isoString), 'HH:mm', { locale: ptBR })
}

/**
 * Retorna o tempo relativo à data atual (humanizado), ideal para feeds e listagens.
 * Ex: "há 3 horas", "há 2 dias", "há 1 minuto"
 */
export function formatRelative(isoString: string): string {
  return formatDistanceToNow(toLocalDate(isoString), { addSuffix: true, locale: ptBR })
}

/**
 * Formata de forma inteligente:
 * - "Hoje às 10:03" se for hoje
 * - "Ontem às 20:15" se for ontem
 * - "07/09/2026 às 10:03" para datas mais antigas
 */
export function formatSmart(isoString: string): string {
  const date = toLocalDate(isoString)

  if (isToday(date)) {
    return format(date, "'Hoje às' HH:mm", { locale: ptBR })
  }
  if (isYesterday(date)) {
    return format(date, "'Ontem às' HH:mm", { locale: ptBR })
  }
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

/**
 * Retorna a data no formato curto para badges e cards.
 * Ex: "7 set. 2026"
 */
export function formatShort(isoString: string): string {
  return format(toLocalDate(isoString), 'd MMM yyyy', { locale: ptBR })
}
