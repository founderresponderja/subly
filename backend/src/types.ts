export type Transaction = {
  date: string
  merchant: string
  amount: number
  category?: string
}

export type DetectedSubscription = {
  merchant: string
  amount: number
  intervalDays: number
  nextPaymentDate: string
  lastPaymentDate: string
}

export type Alert = {
  type: 'renovacao_proxima' | 'aumento_preco' | 'subscricao_duplicada' | 'subscricao_inativa'
  message: string
  merchant?: string
}

export type DashboardData = {
  monthlyTotal: number
  annualTotal: number
  timeline: Transaction[]
  subscriptions: DetectedSubscription[]
  alerts: Alert[]
}
