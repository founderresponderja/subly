import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEvalReport, renderEvalText } from './eval-lib'

const currentFile = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFile)
const fixturesDir = path.resolve(currentDir, '../__fixtures__')
const report = buildEvalReport(fixturesDir)
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(renderEvalText(report))
}
