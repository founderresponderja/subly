import type { Categoria, Comerciante } from '../tipos'
import merchantsRaw from './merchants.pt.json'

export type CancelamentoComerciante = {
  canais: string[]
  preAvisoDias: number | null
  morada: string | null
  notas: string
  fonte: string
  verificadoEm: string
  porVerificar: boolean
}

export type ComercianteCatalogo = {
  id: string
  nome: string
  categoria: Categoria
  padroes: string[]
  cancelamento: CancelamentoComerciante
}

type PatternIndexEntry = {
  merchant: ComercianteCatalogo
  normalizedPattern: string
}

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isCategoria(value: unknown): value is Categoria {
  return (
    value === 'streaming' ||
    value === 'telecomunicacoes' ||
    value === 'ginasio' ||
    value === 'seguros' ||
    value === 'energia' ||
    value === 'software' ||
    value === 'transporte' ||
    value === 'outro'
  )
}

function isCancelamento(value: unknown): value is CancelamentoComerciante {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Record<string, unknown>
  return (
    Array.isArray(item.canais) &&
    item.canais.every((canal) => typeof canal === 'string') &&
    (typeof item.preAvisoDias === 'number' || item.preAvisoDias === null) &&
    (typeof item.morada === 'string' || item.morada === null) &&
    typeof item.notas === 'string' &&
    typeof item.fonte === 'string' &&
    typeof item.verificadoEm === 'string' &&
    typeof item.porVerificar === 'boolean'
  )
}

function isComercianteCatalogo(value: unknown): value is ComercianteCatalogo {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.nome === 'string' &&
    isCategoria(item.categoria) &&
    Array.isArray(item.padroes) &&
    item.padroes.every((padrao) => typeof padrao === 'string') &&
    isCancelamento(item.cancelamento)
  )
}

function loadMerchants(): ComercianteCatalogo[] {
  if (!Array.isArray(merchantsRaw)) {
    throw new Error('Formato inválido: merchants.pt.json deve ser um array.')
  }

  const parsed = merchantsRaw.filter(isComercianteCatalogo)
  if (parsed.length !== merchantsRaw.length) {
    throw new Error('Formato inválido: existem entradas de comerciante mal tipadas.')
  }

  return parsed
}

export const merchantsPt: ComercianteCatalogo[] = loadMerchants()

const merchantPatternIndex: PatternIndexEntry[] = merchantsPt
  .flatMap((merchant) =>
    merchant.padroes.map((pattern) => ({
      merchant,
      normalizedPattern: normalizeForMatch(pattern),
    }))
  )
  .filter((entry) => entry.normalizedPattern.length > 0)
  .sort((a, b) => b.normalizedPattern.length - a.normalizedPattern.length)

export function identificarComerciante(descritivoLimpo: string): Comerciante | null {
  const normalizedDescription = normalizeForMatch(descritivoLimpo)
  if (!normalizedDescription) {
    return null
  }

  const match = merchantPatternIndex.find((entry) =>
    normalizedDescription.includes(entry.normalizedPattern)
  )
  if (!match) {
    return null
  }

  return {
    id: match.merchant.id,
    nome: match.merchant.nome,
    categoria: match.merchant.categoria,
    confianca: 1,
  }
}
