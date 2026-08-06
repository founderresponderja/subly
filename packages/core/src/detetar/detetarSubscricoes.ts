import { identificarComerciante } from '../dados'
import { normalizarDescritivo } from '../normalizar'
import type { Comerciante, Subscricao, Transacao } from '../tipos'

type Periodicidade = Subscricao['periodicidade']

type Grupo = {
  key: string
  nomeFallback: string
  comerciante: Comerciante | null
  transacoes: Transacao[]
}

type IntervaloClassificacao = {
  periodicidade: Periodicidade
  intervalosNoPadrao: number
  totalIntervalos: number
}

const PERIODICIDADE_REGRAS: Record<Periodicidade, { min: number; max: number; estimativaDias: number }> = {
  mensal: { min: 28, max: 33, estimativaDias: 30 },
  trimestral: { min: 85, max: 95, estimativaDias: 90 },
  semestral: { min: 175, max: 190, estimativaDias: 182 },
  anual: { min: 355, max: 375, estimativaDias: 365 },
}

function parseDateToUtc(input: string): Date | null {
  const hasTime = input.includes('T')
  const date = hasTime ? new Date(input) : new Date(`${input}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function diffInDays(start: string, end: string): number | null {
  const startDate = parseDateToUtc(start)
  const endDate = parseDateToUtc(end)
  if (!startDate || !endDate) {
    return null
  }

  const oneDay = 24 * 60 * 60 * 1000
  return Math.round((endDate.getTime() - startDate.getTime()) / oneDay)
}

function ratioDiff(base: number, value: number): number {
  if (base === 0) {
    return Number.POSITIVE_INFINITY
  }
  return Math.abs(value - base) / Math.abs(base)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
  }
  return sorted[middle]!
}

function estimatePeriodicity(transacoes: Transacao[]): IntervaloClassificacao | null {
  if (transacoes.length < 3) {
    return null
  }

  const intervalos = transacoes
    .slice(1)
    .map((transacao, index) => diffInDays(transacoes[index]!.data, transacao.data))
    .filter((dias): dias is number => dias !== null && dias > 0)

  if (intervalos.length !== transacoes.length - 1) {
    return null
  }

  const podeTolerarFalha = transacoes.length >= 5
  const classificacoes = (Object.keys(PERIODICIDADE_REGRAS) as Periodicidade[]).map((periodicidade) => {
    const regra = PERIODICIDADE_REGRAS[periodicidade]
    const intervalosNoPadrao = intervalos.filter((dias) => dias >= regra.min && dias <= regra.max).length
    return { periodicidade, intervalosNoPadrao, totalIntervalos: intervalos.length }
  })

  const validas = classificacoes.filter((classificacao) => {
    const foraDoPadrao = classificacao.totalIntervalos - classificacao.intervalosNoPadrao
    if (podeTolerarFalha) {
      return foraDoPadrao <= 1
    }
    return foraDoPadrao === 0
  })

  if (validas.length === 0) {
    return null
  }

  return validas.sort((a, b) => b.intervalosNoPadrao - a.intervalosNoPadrao)[0] ?? null
}

function buildVariacaoPreco(transacoes: Transacao[]): Subscricao['variacaoPreco'] {
  if (transacoes.length < 4) {
    return null
  }

  type Faixa = {
    valorMedio: number
    count: number
    startIndex: number
  }

  const faixas: Faixa[] = []

  for (const [index, transacao] of transacoes.entries()) {
    const valor = Math.abs(transacao.valor)
    const ultima = faixas[faixas.length - 1]
    if (!ultima) {
      faixas.push({ valorMedio: valor, count: 1, startIndex: index })
      continue
    }

    if (ratioDiff(ultima.valorMedio, valor) <= 0.05) {
      const novoTotal = ultima.valorMedio * ultima.count + valor
      ultima.count += 1
      ultima.valorMedio = novoTotal / ultima.count
      continue
    }

    faixas.push({ valorMedio: valor, count: 1, startIndex: index })
  }

  if (faixas.length < 2) {
    return null
  }

  const atual = faixas[faixas.length - 1]!
  const anterior = faixas[faixas.length - 2]!
  if (atual.count < 2 || ratioDiff(anterior.valorMedio, atual.valorMedio) <= 0.05) {
    return null
  }

  const desde = transacoes[atual.startIndex]?.data
  if (!desde) {
    return null
  }

  return {
    anterior: Math.round(anterior.valorMedio),
    atual: Math.round(atual.valorMedio),
    desde,
  }
}

function buildUnknownMerchant(nomeFallback: string): Comerciante {
  const normalizedId = nomeFallback
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return {
    id: `desconhecido-${normalizedId || 'grupo'}`,
    nome: nomeFallback,
    categoria: 'outro',
    confianca: 0.5,
  }
}

function calcularConfianca(params: {
  ocorrencias: number
  intervalosNoPadrao: number
  totalIntervalos: number
  dispersaoValor: number
  comercianteConhecido: boolean
}): number {
  const { ocorrencias, intervalosNoPadrao, totalIntervalos, dispersaoValor, comercianteConhecido } = params
  const scoreOcorrencias = Math.min(1, ocorrencias / 6)
  const scoreIntervalo = totalIntervalos === 0 ? 0 : intervalosNoPadrao / totalIntervalos
  const scoreValor = dispersaoValor <= 0.05 ? 1 : dispersaoValor <= 0.15 ? 0.7 : 0.4
  const scoreComerciante = comercianteConhecido ? 1 : 0

  /**
   * Fórmula da confiança:
   * - 35%: volume de evidência (número de ocorrências)
   * - 35%: regularidade temporal (intervalos dentro do padrão)
   * - 20%: estabilidade de valor (dispersão de preço)
   * - 10%: comerciante conhecido no catálogo
   */
  return (
    scoreOcorrencias * 0.35 +
    scoreIntervalo * 0.35 +
    scoreValor * 0.2 +
    scoreComerciante * 0.1
  )
}

function groupTransacoes(transacoes: Transacao[]): Grupo[] {
  const grupos = new Map<string, Grupo>()

  for (const transacao of transacoes) {
    if (transacao.valor >= 0) {
      continue
    }

    const normalizado = normalizarDescritivo(transacao.descritivo)
    const candidato = [normalizado.limpo, ...normalizado.pistas]
      .map((pista) => pista.trim())
      .find((pista) => pista.length > 0)

    if (!candidato) {
      continue
    }

    const comerciante =
      [normalizado.limpo, ...normalizado.pistas]
        .map((pista) => pista.trim())
        .filter((pista) => pista.length > 0)
        .map((pista) => identificarComerciante(pista))
        .find((match): match is Comerciante => match !== null) ?? null

    const key = comerciante ? `merchant:${comerciante.id}` : `texto:${candidato}`
    const existente = grupos.get(key)
    if (existente) {
      existente.transacoes.push(transacao)
      continue
    }

    grupos.set(key, {
      key,
      nomeFallback: candidato,
      comerciante,
      transacoes: [transacao],
    })
  }

  return Array.from(grupos.values())
}

export function detetarSubscricoes(
  transacoes: Transacao[],
  dataReferencia?: string
): Subscricao[] {
  const referencia = dataReferencia ? parseDateToUtc(dataReferencia) : null
  const transacoesFiltradas = referencia
    ? transacoes.filter((transacao) => {
        const data = parseDateToUtc(transacao.data)
        return data !== null && data.getTime() <= referencia.getTime()
      })
    : transacoes

  const grupos = groupTransacoes(transacoesFiltradas)
  const subscricoes: Subscricao[] = []

  for (const grupo of grupos) {
    if (grupo.transacoes.length < 3) {
      continue
    }

    const ordenadas = [...grupo.transacoes].sort((a, b) => a.data.localeCompare(b.data))
    const classificacao = estimatePeriodicity(ordenadas)
    if (!classificacao) {
      continue
    }

    const valores = ordenadas.map((transacao) => Math.abs(transacao.valor))
    const valorMin = Math.min(...valores)
    const valorMax = Math.max(...valores)
    const valorTipico = median(valores)
    const dispersaoValor = ratioDiff(valorTipico, valorMax)
    const variacaoBruta = ratioDiff(valorMin, valorMax)

    if (variacaoBruta > 0.3) {
      continue
    }

    const confianca = calcularConfianca({
      ocorrencias: ordenadas.length,
      intervalosNoPadrao: classificacao.intervalosNoPadrao,
      totalIntervalos: classificacao.totalIntervalos,
      dispersaoValor,
      comercianteConhecido: grupo.comerciante !== null,
    })

    if (confianca < 0.5) {
      continue
    }

    const ultimaData = parseDateToUtc(ordenadas[ordenadas.length - 1]!.data)
    const proximoPagamentoEstimado = ultimaData
      ? formatIsoDate(addDays(ultimaData, PERIODICIDADE_REGRAS[classificacao.periodicidade].estimativaDias))
      : null

    const comerciante = grupo.comerciante ?? buildUnknownMerchant(grupo.nomeFallback)
    subscricoes.push({
      id: `${grupo.key}:${classificacao.periodicidade}`,
      comerciante,
      valorTipico,
      periodicidade: classificacao.periodicidade,
      transacoes: ordenadas,
      proximoPagamentoEstimado,
      confianca: Number(confianca.toFixed(3)),
      variacaoPreco: buildVariacaoPreco(ordenadas),
    })
  }

  return subscricoes.sort((a, b) => b.confianca - a.confianca)
}
