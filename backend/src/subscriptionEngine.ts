import type { Alert, DashboardData, DetectedSubscription, Transaction } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

const toISODate = (value: Date): string => value.toISOString().slice(0, 10)

const daysBetween = (a: Date, b: Date): number => Math.round((b.getTime() - a.getTime()) / DAY_MS)

const normalizeMerchant = (merchant: string): string => merchant.trim().toLowerCase()

const roundTo2 = (value: number): number => Math.round(value * 100) / 100

export const sanitizeMerchant = (merchant: string): string =>
  merchant.replace(/\d{6,}/g, '').replace(/\s+/g, ' ').trim()

const groupByMerchant = (transactions: Transaction[]): Map<string, Transaction[]> => {
  const grouped = new Map<string, Transaction[]>()

  for (const transaction of transactions) {
    const key = normalizeMerchant(transaction.merchant)
    const current = grouped.get(key) ?? []
    current.push(transaction)
    grouped.set(key, current)
  }

  return grouped
}

const isRecurringGroup = (transactions: Transaction[]): boolean => {
  if (transactions.length < 2) {
    return false
  }

  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const intervals: number[] = []

  for (let index = 1; index < sorted.length; index += 1) {
    intervals.push(daysBetween(new Date(sorted[index - 1].date), new Date(sorted[index].date)))
  }

  const averageInterval = intervals.reduce((sum, value) => sum + value, 0) / intervals.length

  if (averageInterval < 7 || averageInterval > 45) {
    return false
  }

  const intervalTolerance = 4
  const amountAverage = sorted.reduce((sum, value) => sum + value.amount, 0) / sorted.length
  const amountTolerance = Math.max(0.8, amountAverage * 0.05)

  const intervalStable = intervals.every((value) => Math.abs(value - averageInterval) <= intervalTolerance)
  const amountStable = sorted.every((value) => Math.abs(value.amount - amountAverage) <= amountTolerance)

  return intervalStable && amountStable
}

export const detectRecurringSubscriptions = (transactions: Transaction[]): DetectedSubscription[] => {
  const grouped = groupByMerchant(transactions)
  const subscriptions: DetectedSubscription[] = []

  for (const merchantTransactions of grouped.values()) {
    if (!isRecurringGroup(merchantTransactions)) {
      continue
    }

    const sorted = [...merchantTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
    const latest = sorted[sorted.length - 1]
    const first = sorted[0]
    const spanDays = Math.max(1, daysBetween(new Date(first.date), new Date(latest.date)))
    const intervalDays = Math.max(1, Math.round(spanDays / (sorted.length - 1)))
    const nextDate = new Date(new Date(latest.date).getTime() + intervalDays * DAY_MS)

    subscriptions.push({
      merchant: latest.merchant,
      amount: roundTo2(sorted.reduce((sum, value) => sum + value.amount, 0) / sorted.length),
      intervalDays,
      nextPaymentDate: toISODate(nextDate),
      lastPaymentDate: latest.date,
    })
  }

  return subscriptions.sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate))
}

export const buildAlerts = (
  subscriptions: DetectedSubscription[],
  transactions: Transaction[],
  nowDate: Date = new Date(),
): Alert[] => {
  const alerts: Alert[] = []
  const grouped = groupByMerchant(transactions)

  for (const subscription of subscriptions) {
    const history = (grouped.get(normalizeMerchant(subscription.merchant)) ?? []).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    if (history.length >= 2) {
      const last = history[history.length - 1]
      const previous = history.slice(0, -1)
      const previousAverage = previous.reduce((sum, value) => sum + value.amount, 0) / previous.length

      if (last.amount > previousAverage * 1.05) {
        alerts.push({
          type: 'aumento_preco',
          merchant: subscription.merchant,
          message: `${subscription.merchant}: subida de preço detetada (€${previousAverage.toFixed(2)} → €${last.amount.toFixed(2)})`,
        })
      }
    }

    const daysToRenewal = daysBetween(nowDate, new Date(subscription.nextPaymentDate))

    if (daysToRenewal >= 0 && daysToRenewal <= 7) {
      alerts.push({
        type: 'renovacao_proxima',
        merchant: subscription.merchant,
        message: `${subscription.merchant}: renovação em ${daysToRenewal} dia(s)`,
      })
    }

    const lastSeen = new Date(subscription.lastPaymentDate)
    const inactiveDays = daysBetween(lastSeen, nowDate)

    if (inactiveDays >= 60) {
      alerts.push({
        type: 'subscricao_inativa',
        merchant: subscription.merchant,
        message: `${subscription.merchant}: sem atividade há ${inactiveDays} dias`,
      })
    }
  }

  const merchantCount = new Map<string, number>()

  for (const subscription of subscriptions) {
    const key = normalizeMerchant(subscription.merchant)
    merchantCount.set(key, (merchantCount.get(key) ?? 0) + 1)
  }

  for (const [merchantKey, count] of merchantCount.entries()) {
    if (count > 1) {
      alerts.push({
        type: 'subscricao_duplicada',
        merchant: merchantKey,
        message: `${merchantKey}: possível subscrição duplicada`,
      })
    }
  }

  return alerts
}

export const buildDashboardData = (transactions: Transaction[], nowDate: Date = new Date()): DashboardData => {
  const subscriptions = detectRecurringSubscriptions(transactions)
  const monthlyTotal = roundTo2(
    subscriptions.reduce((sum, subscription) => sum + subscription.amount * (30 / subscription.intervalDays), 0),
  )
  const annualTotal = roundTo2(monthlyTotal * 12)
  const alerts = buildAlerts(subscriptions, transactions, nowDate)
  const timeline = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 30)

  return {
    monthlyTotal,
    annualTotal,
    timeline,
    subscriptions,
    alerts,
  }
}

export const parseCsvTransactions = (csvContent: string): Transaction[] => {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return []
  }

  const [header, ...rows] = lines
  const columns = header.split(',').map((value) => value.trim().toLowerCase())
  const dateIndex = columns.indexOf('date')
  const merchantIndex = columns.indexOf('merchant')
  const amountIndex = columns.indexOf('amount')
  const categoryIndex = columns.indexOf('category')

  if (dateIndex < 0 || merchantIndex < 0 || amountIndex < 0) {
    throw new Error('CSV inválido. Usa colunas: date,merchant,amount[,category].')
  }

  const transactions: Transaction[] = []

  for (const row of rows) {
    const values = row.split(',').map((value) => value.trim())
    const amountRaw = Number.parseFloat(values[amountIndex] ?? '0')
    const merchant = sanitizeMerchant(values[merchantIndex] ?? '')
    const date = values[dateIndex]

    if (!merchant || Number.isNaN(amountRaw) || !date) {
      continue
    }

    const amount = roundTo2(Math.abs(amountRaw))

    transactions.push({
      date,
      merchant,
      amount,
      category: categoryIndex >= 0 ? values[categoryIndex] : undefined,
    })
  }

  return transactions
}
