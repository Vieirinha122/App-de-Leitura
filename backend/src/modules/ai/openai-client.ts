import OpenAI from 'openai'
import { env } from '@/lib/config/env'

const modelo = env.OPENAI_MODEL
const cliente = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 60_000 }) : null

type ContextoArtigo = { title: string; summary: string | null; source: string }

function exigirCliente() {
  if (!cliente) throw new Error('OPENAI_API_KEY não configurada')
  return cliente
}

async function gerarJson<T>(instructions: string, input: ContextoArtigo, name: string, schema: Record<string, unknown>): Promise<T> {
  const response = await exigirCliente().responses.create({
    model: modelo,
    instructions,
    input: JSON.stringify(input),
    text: { format: { type: 'json_schema', name, strict: true, schema } },
    max_output_tokens: env.OPENAI_MAX_OUTPUT_TOKENS,
    store: false
  })
  return JSON.parse(response.output_text) as T
}

export type ResumoArtigo = { bullets: string[]; language: 'pt-BR' }
export type PerguntasArtigo = { questions: string[]; language: 'pt-BR' }

export async function gerarResumoArtigo(input: ContextoArtigo): Promise<ResumoArtigo> {
  return gerarJson('Você é um editor técnico brasileiro. Resuma em português natural, sem tradução literal. Preserve termos técnicos, nomes próprios, bibliotecas e comandos. Retorne exatamente três tópicos curtos.', input, 'resumo_artigo', {
    type: 'object', properties: { bullets: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 }, language: { type: 'string', enum: ['pt-BR'] } }, required: ['bullets', 'language'], additionalProperties: false
  })
}

export async function gerarPerguntasArtigo(input: ContextoArtigo): Promise<PerguntasArtigo> {
  return gerarJson('Você é um tutor brasileiro. Crie três perguntas de fixação sobre o artigo. Não invente informações fora do título e resumo. Use português natural.', input, 'perguntas_artigo', {
    type: 'object', properties: { questions: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 }, language: { type: 'string', enum: ['pt-BR'] } }, required: ['questions', 'language'], additionalProperties: false
  })
}

export async function explicarArtigo(input: ContextoArtigo): Promise<{ explanation: string; language: 'pt-BR' }> {
  return gerarJson('Você é um professor brasileiro. Explique o conceito central do artigo em português claro, contextualizando termos técnicos sem tradução literal estranha. Não invente fatos.', input, 'explicacao_artigo', {
    type: 'object', properties: { explanation: { type: 'string' }, language: { type: 'string', enum: ['pt-BR'] } }, required: ['explanation', 'language'], additionalProperties: false
  })
}