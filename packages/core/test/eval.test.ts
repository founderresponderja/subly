import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { detetarSubscricoes } from '../src'

type FixtureTransacoes = {
  nome: string
  sintetico: boolean
  dataReferencia?: string
  transacoes: Array<{
    id: string
    data: string
    descritivo: string
    valor: number
    moeda: string
    origem: 'pdf' | 'csv' | 'colado'
  }>
}

type Esperado = {
  sintetico: boolean
  subscricoesEsperadas: Array<{
    comercianteId: string
    periodicidade: 'mensal' | 'trimestral' | 'semestral' | 'anual'
    valorTipico: number
  }>
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 1
  }
  return numerator / denominator
}

function key(item: { comercianteId: string; periodicidade: string; valorTipico: number }): string {
  return `${item.comercianteId}|${item.periodicidade}|${item.valorTipico}`
}

describe('harness de avaliação', () => {
  test('mantém cobertura global >= 0.85', () => {
    const currentFile = fileURLToPath(import.meta.url)
    const currentDir = path.dirname(currentFile)
    const fixturesDir = path.resolve(currentDir, '../__fixtures__')
    const fixtureFiles = readdirSync(fixturesDir)
      .filter((file) => file.endsWith('.json') && !file.endsWith('.esperado.json'))
      .sort()

    let verdadeirosPositivos = 0
    let falsosNegativos = 0

    for (const fileName of fixtureFiles) {
      const fixturePath = path.join(fixturesDir, fileName)
      const expectedPath = path.join(fixturesDir, fileName.replace(/\.json$/u, '.esperado.json'))

      const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as FixtureTransacoes
      const expected = JSON.parse(readFileSync(expectedPath, 'utf8')) as Esperado

      expect(fixture.sintetico).toBe(true)
      expect(expected.sintetico).toBe(true)

      const expectedKeys = new Set(expected.subscricoesEsperadas.map(key))
      const detectedKeys = new Set(
        detetarSubscricoes(fixture.transacoes, fixture.dataReferencia).map((subscricao) =>
          key({
            comercianteId: subscricao.comerciante.id,
            periodicidade: subscricao.periodicidade,
            valorTipico: subscricao.valorTipico,
          })
        )
      )

      for (const expectedKey of expectedKeys) {
        if (detectedKeys.has(expectedKey)) {
          verdadeirosPositivos += 1
        } else {
          falsosNegativos += 1
        }
      }
    }

    const cobertura = ratio(verdadeirosPositivos, verdadeirosPositivos + falsosNegativos)
    expect(cobertura).toBeGreaterThanOrEqual(0.85)
  })
})
