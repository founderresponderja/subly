import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { detetarSubscricoes } from '../src/detetar/detetarSubscricoes'
import type { Transacao } from '../src/tipos'

type FixtureTransacoes = {
  nome: string
  sintetico: boolean
  dataReferencia?: string
  transacoes: Transacao[]
}

type Esperado = {
  sintetico: boolean
  subscricoesEsperadas: Array<{
    comercianteId: string
    periodicidade: 'mensal' | 'trimestral' | 'semestral' | 'anual'
    valorTipico: number
    variacaoPreco?: {
      anterior: number
      atual: number
      desde: string
    } | null
  }>
}

const VALOR_TIPICO_MATCH_TOLERANCE = 0.05

export type EvalFixtureResult = {
  fixture: string
  sintetico: boolean
  verdadeirosPositivos: number
  falsosPositivos: number
  falsosNegativos: number
  precisao: number
  cobertura: number
  detetadas: string[]
  esperadas: string[]
}

export type EvalReport = {
  fixturesSinteticas: number
  fixtures: EvalFixtureResult[]
  total: {
    verdadeirosPositivos: number
    falsosPositivos: number
    falsosNegativos: number
    precisao: number
    cobertura: number
  }
}

function round(value: number): number {
  return Number(value.toFixed(4))
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 1
  }
  return numerator / denominator
}

function hasValorTipicoMatchWithinTolerance(expected: number, detected: number): boolean {
  if (expected === 0) {
    return detected === 0
  }
  return Math.abs(detected - expected) / Math.abs(expected) <= VALOR_TIPICO_MATCH_TOLERANCE
}

function hasVariacaoPrecoMatch(
  expected:
    | {
        anterior: number
        atual: number
        desde: string
      }
    | null
    | undefined,
  detected: { anterior: number; atual: number; desde: string } | null
): boolean {
  if (expected === undefined) {
    return true
  }
  if (expected === null) {
    return detected === null
  }
  if (detected === null) {
    return false
  }

  return (
    expected.anterior === detected.anterior &&
    expected.atual === detected.atual &&
    expected.desde === detected.desde
  )
}

function hasSubscriptionMatch(
  expected: Esperado['subscricoesEsperadas'][number],
  detected: ReturnType<typeof detetarSubscricoes>[number]
): boolean {
  return (
    expected.comercianteId === detected.comerciante.id &&
    expected.periodicidade === detected.periodicidade &&
    hasValorTipicoMatchWithinTolerance(expected.valorTipico, detected.valorTipico) &&
    hasVariacaoPrecoMatch(expected.variacaoPreco, detected.variacaoPreco)
  )
}

function createExpectedDebugKey(item: Esperado['subscricoesEsperadas'][number]): string {
  const variacao = item.variacaoPreco
    ? `|variacao:${item.variacaoPreco.anterior}->${item.variacaoPreco.atual}@${item.variacaoPreco.desde}`
    : ''
  return `${item.comercianteId}|${item.periodicidade}|${item.valorTipico}${variacao}`
}

function createDetectedDebugKey(item: ReturnType<typeof detetarSubscricoes>[number]): string {
  const variacao = item.variacaoPreco
    ? `|variacao:${item.variacaoPreco.anterior}->${item.variacaoPreco.atual}@${item.variacaoPreco.desde}`
    : ''
  return `${item.comerciante.id}|${item.periodicidade}|${item.valorTipico}${variacao}`
}

function evaluateFixture(fixture: FixtureTransacoes, expected: Esperado): EvalFixtureResult {
  const detected = detetarSubscricoes(fixture.transacoes, fixture.dataReferencia)
  const unmatchedDetected = [...detected]

  let verdadeirosPositivos = 0
  let falsosNegativos = 0

  for (const expectedItem of expected.subscricoesEsperadas) {
    const matchedIndex = unmatchedDetected.findIndex((detectedItem) =>
      hasSubscriptionMatch(expectedItem, detectedItem)
    )
    if (matchedIndex >= 0) {
      verdadeirosPositivos += 1
      unmatchedDetected.splice(matchedIndex, 1)
    } else {
      falsosNegativos += 1
    }
  }

  const falsosPositivos = unmatchedDetected.length
  const precisao = ratio(verdadeirosPositivos, verdadeirosPositivos + falsosPositivos)
  const cobertura = ratio(verdadeirosPositivos, verdadeirosPositivos + falsosNegativos)

  return {
    fixture: fixture.nome,
    sintetico: fixture.sintetico === true && expected.sintetico === true,
    verdadeirosPositivos,
    falsosPositivos,
    falsosNegativos,
    precisao: round(precisao),
    cobertura: round(cobertura),
    detetadas: detected.map(createDetectedDebugKey).sort(),
    esperadas: expected.subscricoesEsperadas.map(createExpectedDebugKey).sort(),
  }
}

export function buildEvalReport(fixturesDir: string): EvalReport {
  const fixtureFiles = readdirSync(fixturesDir)
    .filter((file) => file.endsWith('.json') && !file.endsWith('.esperado.json'))
    .sort()

  if (fixtureFiles.length === 0) {
    throw new Error('Nenhuma fixture encontrada em packages/core/__fixtures__.')
  }

  const fixtureResults = fixtureFiles.map((fileName) => {
    const fixturePath = path.join(fixturesDir, fileName)
    const expectedPath = path.join(fixturesDir, fileName.replace(/\.json$/u, '.esperado.json'))

    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureTransacoes
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as Esperado
    if (!fixture.sintetico || !expected.sintetico) {
      throw new Error(`Fixture ${fileName} não está marcada com sintetico: true em ambos os ficheiros.`)
    }

    return evaluateFixture(fixture, expected)
  })

  const total = fixtureResults.reduce(
    (acc, fixture) => {
      acc.verdadeirosPositivos += fixture.verdadeirosPositivos
      acc.falsosPositivos += fixture.falsosPositivos
      acc.falsosNegativos += fixture.falsosNegativos
      return acc
    },
    { verdadeirosPositivos: 0, falsosPositivos: 0, falsosNegativos: 0 }
  )

  return {
    fixturesSinteticas: fixtureResults.filter((fixture) => fixture.sintetico).length,
    fixtures: fixtureResults,
    total: {
      ...total,
      precisao: round(ratio(total.verdadeirosPositivos, total.verdadeirosPositivos + total.falsosPositivos)),
      cobertura: round(ratio(total.verdadeirosPositivos, total.verdadeirosPositivos + total.falsosNegativos)),
    },
  }
}

export function renderEvalText(report: EvalReport): string {
  const lines: string[] = []

  lines.push(`Fixtures avaliadas: ${report.fixtures.length}`)
  lines.push(`Fixtures sintéticas: ${report.fixturesSinteticas}`)
  lines.push('')

  for (const fixture of report.fixtures) {
    lines.push(`Fixture: ${fixture.fixture} ${fixture.sintetico ? '(sintetico)' : '(nao sintetico)'}`)
    lines.push(`  VP: ${fixture.verdadeirosPositivos}`)
    lines.push(`  FP: ${fixture.falsosPositivos}`)
    lines.push(`  FN: ${fixture.falsosNegativos}`)
    lines.push(`  Precisao: ${fixture.precisao.toFixed(4)}`)
    lines.push(`  Cobertura: ${fixture.cobertura.toFixed(4)}`)
    lines.push('')
  }

  lines.push('Total:')
  lines.push(`  VP: ${report.total.verdadeirosPositivos}`)
  lines.push(`  FP: ${report.total.falsosPositivos}`)
  lines.push(`  FN: ${report.total.falsosNegativos}`)
  lines.push(`  Precisao: ${report.total.precisao.toFixed(4)}`)
  lines.push(`  Cobertura: ${report.total.cobertura.toFixed(4)}`)

  return lines.join('\n')
}
