import type { AlertItem, DashboardSummary, DetectedSubscription, ParsedRow, Transaction } from './types';

const DAY_MS = 1000 * 60 * 60 * 24;

function normalizeMerchant(description: string) {
  return description
    .toUpperCase()
    .replace(/\b(PT|LDA|SA|UNIPESSOAL|LIMITADA|S A|SU|COM|PAYMENT|PAGAMENTO|SUBSCRIPTION)\b/g, ' ')
    .replace(/[^A-Z0-9À-ÿ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roundAmount(amount: number) {
  return Math.round(Math.abs(amount) * 100) / 100;
}

function cadenceFromAverageDelta(deltaDays: number) {
  if (deltaDays >= 6 && deltaDays <= 8) return 'Semanal';
  if (deltaDays >= 26 && deltaDays <= 35) return 'Mensal';
  if (deltaDays >= 80 && deltaDays <= 100) return 'Trimestral';
  if (deltaDays >= 350 && deltaDays <= 380) return 'Anual';
  return 'Irregular';
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function parseRows(rows: ParsedRow[]) {
  return rows.map((row, index) => ({
    id: `tx-${index + 1}`,
    date: row.date,
    description: row.description,
    amount: row.amount,
    currency: 'EUR' as const,
    source: 'csv' as const,
  }));
}

export function detectSubscriptionsFromRows(rows: ParsedRow[]): DashboardSummary {
  return detectSubscriptions(parseRows(rows));
}

export function detectSubscriptions(transactions: Transaction[]): DashboardSummary {
  const sortedTransactions = [...transactions].sort((left, right) => left.date.localeCompare(right.date));
  const groups = new Map<string, Transaction[]>();

  for (const transaction of sortedTransactions) {
    if (transaction.amount >= 0) continue;
    const merchant = normalizeMerchant(transaction.description);
    const key = `${merchant}::${roundAmount(transaction.amount)}`;
    const current = groups.get(key) ?? [];
    current.push(transaction);
    groups.set(key, current);
  }

  const subscriptions: DetectedSubscription[] = [];
  const alerts: AlertItem[] = [];

  for (const [key, group] of groups.entries()) {
    if (group.length < 2) continue;

    const [merchant, amountKey] = key.split('::');
    const dates = group.map((entry) => new Date(`${entry.date}T00:00:00Z`)).sort((left, right) => left.getTime() - right.getTime());
    const intervals = dates.slice(1).map((date, index) => Math.round((date.getTime() - dates[index].getTime()) / DAY_MS));
    const cadence = cadenceFromAverageDelta(average(intervals));
    const latest = dates[dates.length - 1];
    const nextChargeDate = cadence === 'Irregular' ? null : new Date(latest.getTime() + average(intervals) * DAY_MS).toISOString().slice(0, 10);
    const amounts = group.map((entry) => roundAmount(entry.amount));
    const averageAmount = average(amounts);
    const amount = roundAmount(Number(amountKey));
    const confidence = Math.min(98, 55 + group.length * 12 + (cadence === 'Irregular' ? -15 : 10));

    subscriptions.push({
      merchant,
      cadence,
      amount,
      averageAmount,
      nextChargeDate,
      confidence,
      occurrences: group.length,
      status: cadence === 'Irregular' ? 'Atenção' : 'Ativa',
    });

    if (nextChargeDate) {
      const daysUntilRenewal = Math.round((new Date(`${nextChargeDate}T00:00:00Z`).getTime() - new Date('2026-03-26T00:00:00Z').getTime()) / DAY_MS);
      if (daysUntilRenewal >= 0 && daysUntilRenewal <= 14) {
        alerts.push({
          type: 'Renovação próxima',
          merchant,
          severity: daysUntilRenewal <= 3 ? 'Alta' : 'Média',
          message: `${merchant} renova dentro de ${daysUntilRenewal} dias.`,
        });
      }
    }

    if (group.length >= 3) {
      const recentAmount = roundAmount(group[group.length - 1].amount);
      const olderAverage = average(group.slice(0, -1).map((entry) => roundAmount(entry.amount)));
      if (recentAmount > olderAverage * 1.05) {
        alerts.push({
          type: 'Aumento de preço',
          merchant,
          severity: 'Alta',
          message: `${merchant} subiu de ${olderAverage.toFixed(2)}€ para ${recentAmount.toFixed(2)}€.`,
        });
      }
    }

    if (group.length === 2) {
      alerts.push({
        type: 'Subscrição possivelmente nunca usada',
        merchant,
        severity: 'Média',
        message: `${merchant} só aparece duas vezes no extrato. Confirma se continua ativa.`,
      });
    }
  }

  const duplicateMap = new Map<string, number>();
  for (const subscription of subscriptions) {
    duplicateMap.set(subscription.merchant, (duplicateMap.get(subscription.merchant) ?? 0) + 1);
  }
  for (const [merchant, count] of duplicateMap.entries()) {
    if (count > 1) {
      alerts.push({
        type: 'Subscrição duplicada',
        merchant,
        severity: 'Média',
        message: `${merchant} aparece em mais do que uma linha de assinatura.`,
      });
    }
  }

  const monthlyTotal = roundAmount(
    subscriptions.reduce((sum, subscription) => {
      if (subscription.cadence === 'Anual') return sum + subscription.amount / 12;
      if (subscription.cadence === 'Trimestral') return sum + subscription.amount / 3;
      if (subscription.cadence === 'Semanal') return sum + subscription.amount * 4.33;
      return sum + subscription.amount;
    }, 0),
  );

  const annualTotal = roundAmount(monthlyTotal * 12);

  return {
    monthlyTotal,
    annualTotal,
    subscriptions: subscriptions.sort((left, right) => right.confidence - left.confidence),
    alerts: alerts.sort((left, right) => ({ Alta: 2, Média: 1, Baixa: 0 }[right.severity] - { Alta: 2, Média: 1, Baixa: 0 }[left.severity])),
    paymentTimeline: sortedTransactions.slice(-8).map((entry) => ({
      date: entry.date,
      merchant: normalizeMerchant(entry.description),
      amount: roundAmount(entry.amount),
    })),
  };
}