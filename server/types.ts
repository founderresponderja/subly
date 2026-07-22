export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: 'EUR';
  source: 'csv' | 'manual' | 'demo';
};

export type DetectedSubscription = {
  merchant: string;
  cadence: 'Semanal' | 'Mensal' | 'Trimestral' | 'Anual' | 'Irregular';
  amount: number;
  averageAmount: number;
  nextChargeDate: string | null;
  confidence: number;
  occurrences: number;
  status: 'Ativa' | 'Atenção';
};

export type AlertItem = {
  type: 'Renovação próxima' | 'Aumento de preço' | 'Subscrição duplicada' | 'Subscrição possivelmente nunca usada';
  merchant: string;
  severity: 'Baixa' | 'Média' | 'Alta';
  message: string;
};

export type DashboardSummary = {
  monthlyTotal: number;
  annualTotal: number;
  subscriptions: DetectedSubscription[];
  alerts: AlertItem[];
  paymentTimeline: Array<{
    date: string;
    merchant: string;
    amount: number;
  }>;
};

export type WaitlistEntry = {
  name: string;
  email: string;
  company?: string;
};

export type ParsedRow = {
  date: string;
  description: string;
  amount: number;
};