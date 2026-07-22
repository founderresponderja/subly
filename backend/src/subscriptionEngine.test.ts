import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAlerts, buildDashboardData, detectRecurringSubscriptions, parseCsvTransactions } from './subscriptionEngine'

const csvSample = `date,merchant,amount,category
2026-01-02,Netflix,11.99,Streaming
2026-02-02,Netflix,11.99,Streaming
2026-03-02,Netflix,12.99,Streaming
2026-01-05,Ginásio XPTO,29.99,Fitness
2026-02-05,Ginásio XPTO,29.99,Fitness`

test('parseCsvTransactions extrai transações válidas', () => {
  const transactions = parseCsvTransactions(csvSample)
  assert.equal(transactions.length, 5)
  assert.equal(transactions[0]?.merchant, 'Netflix')
})

test('detectRecurringSubscriptions deteta subscrições recorrentes', () => {
  const transactions = parseCsvTransactions(csvSample)
  const subscriptions = detectRecurringSubscriptions(transactions)

  assert.equal(subscriptions.length, 2)
  assert.equal(subscriptions[0]?.merchant.length > 0, true)
})

test('buildDashboardData devolve totais e alertas', () => {
  const transactions = parseCsvTransactions(csvSample)
  const dashboard = buildDashboardData(transactions, new Date('2026-03-05'))

  assert.equal(dashboard.subscriptions.length, 2)
  assert.equal(dashboard.monthlyTotal > 0, true)
  assert.equal(dashboard.annualTotal > dashboard.monthlyTotal, true)
})

test('buildAlerts cria alerta de subida de preço', () => {
  const transactions = parseCsvTransactions(csvSample)
  const subscriptions = detectRecurringSubscriptions(transactions)
  const alerts = buildAlerts(subscriptions, transactions, new Date('2026-03-05'))

  assert.equal(alerts.some((alert) => alert.type === 'aumento_preco'), true)
})
