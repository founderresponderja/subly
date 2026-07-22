import cors from 'cors'
import express from 'express'
import { buildDashboardData, parseCsvTransactions } from './subscriptionEngine'
import type { Transaction } from './types'

const app = express()
const port = Number.parseInt(process.env.PORT ?? '4000', 10)

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const store: { transactions: Transaction[] } = {
  transactions: [],
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.post('/api/import-csv', (request, response) => {
  const csv = typeof request.body?.csv === 'string' ? request.body.csv : ''

  if (!csv.trim()) {
    response.status(400).json({ error: 'Ficheiro CSV em falta.' })
    return
  }

  try {
    const transactions = parseCsvTransactions(csv)
    store.transactions = transactions
    response.json({
      imported: transactions.length,
      dashboard: buildDashboardData(store.transactions),
    })
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Não foi possível processar o CSV.',
    })
  }
})

app.get('/api/dashboard', (_request, response) => {
  response.json(buildDashboardData(store.transactions))
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Subly API a correr na porta ${port}`)
})
