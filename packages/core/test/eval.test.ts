import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { buildEvalReport } from '../scripts/eval-lib'

describe('harness de avaliação', () => {
  test('mantém cobertura global >= 0.85', () => {
    const currentFile = fileURLToPath(import.meta.url)
    const currentDir = path.dirname(currentFile)
    const fixturesDir = path.resolve(currentDir, '../__fixtures__')
    const report = buildEvalReport(fixturesDir)
    expect(report.total.cobertura).toBeGreaterThanOrEqual(0.85)
  })
})
