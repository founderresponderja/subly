import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { alertsTable, detectedSubscriptionsTable, transactionsTable } from './schema';
import type { AlertItem, DetectedSubscription, Transaction } from './types';

type AlertTypeDb = 'price_increase' | 'renewal' | 'duplicate' | 'unused';

function normalizeMerchant(description: string) {
  return description
    .toUpperCase()
    .replace(/\b(PT|LDA|SA|UNIPESSOAL|LIMITADA|S A|SU|COM|PAYMENT|PAGAMENTO|SUBSCRIPTION)\b/g, ' ')
    .replace(/[^A-Z0-9À-ÿ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function alertTypeToDb(type: AlertItem['type']): AlertTypeDb {
  if (type === 'Aumento de preço') return 'price_increase';
  if (type === 'Renovação próxima') return 'renewal';
  if (type === 'Subscrição duplicada') return 'duplicate';
  return 'unused';
}

function cadenceToFrequency(cadence: DetectedSubscription['cadence']) {
  if (cadence === 'Semanal') return 'weekly';
  if (cadence === 'Mensal') return 'monthly';
  if (cadence === 'Trimestral') return 'quarterly';
  if (cadence === 'Anual') return 'yearly';
  return 'irregular';
}

function statusToDb(status: DetectedSubscription['status']): 'active' | 'ignored' {
  return status === 'Ativa' ? 'active' : 'ignored';
}

function toIsoDate(value: Date | string) {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export async function saveTransactions(userId: string, transactions: Transaction[]) {
  if (transactions.length === 0) return;

  await db.insert(transactionsTable).values(
    transactions.map((transaction) => ({
      userId,
      merchant: normalizeMerchant(transaction.description),
      amount: transaction.amount.toFixed(2),
      currency: transaction.currency,
      date: transaction.date,
      rawDescription: transaction.description,
    })),
  );
}

export async function getTransactionsForUser(userId: string, take = 2000): Promise<Transaction[]> {
  const rows = await db
    .select({
      id: transactionsTable.id,
      date: transactionsTable.date,
      rawDescription: transactionsTable.rawDescription,
      amount: transactionsTable.amount,
      currency: transactionsTable.currency,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.date))
    .limit(take);

  return rows.map((row) => ({
    id: row.id,
    date: toIsoDate(row.date),
    description: row.rawDescription,
    amount: Number(row.amount),
    currency: 'EUR',
    source: 'csv',
  }));
}

export async function replaceDerivedData(userId: string, subscriptions: DetectedSubscription[], alerts: AlertItem[], transactions: Transaction[]) {
  const transactionsByMerchant = new Map<string, string[]>();

  for (const transaction of transactions.filter((item) => item.amount < 0)) {
    const merchant = normalizeMerchant(transaction.description);
    const current = transactionsByMerchant.get(merchant) ?? [];
    current.push(transaction.date);
    transactionsByMerchant.set(merchant, current.sort((left, right) => left.localeCompare(right)));
  }

  await db.delete(alertsTable).where(eq(alertsTable.userId, userId));
  await db.delete(detectedSubscriptionsTable).where(eq(detectedSubscriptionsTable.userId, userId));

  const insertedSubscriptions = subscriptions.length
    ? await db
        .insert(detectedSubscriptionsTable)
        .values(
          subscriptions.map((subscription) => {
            const history = transactionsByMerchant.get(subscription.merchant) ?? [];
            const firstSeen = history[0] ?? new Date().toISOString().slice(0, 10);
            const lastSeen = history[history.length - 1] ?? firstSeen;

            return {
              userId,
              merchant: subscription.merchant,
              amount: subscription.amount.toFixed(2),
              frequency: cadenceToFrequency(subscription.cadence),
              category: null,
              firstSeen,
              lastSeen,
              status: statusToDb(subscription.status),
            };
          }),
        )
        .returning({ id: detectedSubscriptionsTable.id, merchant: detectedSubscriptionsTable.merchant })
    : [];

  if (alerts.length === 0) {
    return;
  }

  const subscriptionByMerchant = new Map(insertedSubscriptions.map((item) => [item.merchant, item.id]));

  await db.insert(alertsTable).values(
    alerts.map((alert) => ({
      userId,
      subscriptionId: subscriptionByMerchant.get(alert.merchant) ?? null,
      type: alertTypeToDb(alert.type),
      message: alert.message,
      read: false,
    })),
  );
}

export async function markAlertsRead(userId: string, alertIds: string[]) {
  if (alertIds.length === 0) return;

  await db
    .update(alertsTable)
    .set({ read: true })
    .where(and(eq(alertsTable.userId, userId), inArray(alertsTable.id, alertIds)));
}
