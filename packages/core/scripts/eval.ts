import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
  }>
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

function createKey(item: { comercianteId: string; periodicidade: string; valorTipico: number }): string {
  return `${item.comercianteId}|${item.periodicidade}|${item.valorTipico}`
}

function evaluateFixture(fixture: FixtureTransacoes, expected: Esperado) {
  const expectedKeys = new Set(expected.subscricoesEsperadas.map(createKey))
  const detected = detetarSubscricoes(fixture.transacoes, fixture.dataReferencia)
  const detectedKeys = new Set(
    detected.map((subscricao) =>
      createKey({
        comercianteId: subscricao.comerciante.id,
        periodicidade: subscricao.periodicidade,
        valorTipico: subscricao.valorTipico,
      })
    )
  )

  let verdadeirosPositivos = 0
  for (const key of expectedKeys) {
    if (detectedKeys.has(key)) {
      verdadeirosPositivos += 1
    }
  }

  const falsosPositivos = Math.max(0, detectedKeys.size - verdadeirosPositivos)
  const falsosNegativos = Math.max(0, expectedKeys.size - verdadeirosPositivos)
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
    detetadas: [...detectedKeys].sort(),
    esperadas: [...expectedKeys].sort(),
  }
}

function renderText(report: {
  fixturesSinteticas: number
  fixtures: Array<{
    fixture: string
    sintetico: boolean
    verdadeirosPositivos: number
    falsosPositivos: number
    falsosNegativos: number
    precisao: number
    cobertura: number
  }>
  total: {
    verdadeirosPositivos: number
    falsosPositivos: number
    falsosNegativos: number
    precisao: number
    cobertura: number
  }
}) {
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

function buildReport() {
  const currentFile = fileURLToPath(import.meta.url)
  const currentDir = path.dirname(currentFile)
  const fixturesDir = path.resolve(currentDir, '../__fixtures__')

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

const report = buildReport()
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(renderText(report))
}
