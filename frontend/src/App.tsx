import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Transaction = {
  date: string
  merchant: string
  amount: number
  category?: string
}

type Subscription = {
  merchant: string
  amount: number
  intervalDays: number
  nextPaymentDate: string
  lastPaymentDate: string
}

type Alert = {
  type: 'renovacao_proxima' | 'aumento_preco' | 'subscricao_duplicada' | 'subscricao_inativa'
  message: string
}

type DashboardData = {
  monthlyTotal: number
  annualTotal: number
  timeline: Transaction[]
  subscriptions: Subscription[]
  alerts: Alert[]
}

const EMPTY_DASHBOARD: DashboardData = {
  monthlyTotal: 0,
  annualTotal: 0,
  timeline: [],
  subscriptions: [],
  alerts: [],
}

function App() {
  const [csvContent, setCsvContent] = useState<string>('')
  const [dashboard, setDashboard] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch('/api/dashboard')
        if (!response.ok) {
          return
        }

        const data = (await response.json()) as DashboardData
        setDashboard(data)
      } catch {
        // Ignorado em ambiente local sem backend a correr
      }
    }

    void loadDashboard()
  }, [])

  const totalSubscriptions = useMemo(() => dashboard.subscriptions.length, [dashboard.subscriptions.length])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const text = await file.text()
    setCsvContent(text)
    setError('')
    setSuccess(`Ficheiro "${file.name}" carregado.`)
  }

  const handleImport = async () => {
    if (!csvContent.trim()) {
      setError('Seleciona um ficheiro CSV para importar.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/import-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csv: csvContent }),
      })

      const payload = (await response.json()) as { dashboard?: DashboardData; imported?: number; error?: string }

      if (!response.ok || !payload.dashboard) {
        setError(payload.error ?? 'Não foi possível importar o CSV.')
        return
      }

      setDashboard(payload.dashboard)
      setSuccess(`${payload.imported ?? 0} transações importadas com sucesso.`)
    } catch {
      setError('Erro de ligação ao backend. Confirma se a API está ativa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="badge">Subly MVP</p>
        <h1>Gestor de Subscrições e Despesas Recorrentes</h1>
        <p>
          Importa o teu extrato CSV, deteta pagamentos recorrentes automaticamente e recebe alertas de renovação e
          subida de preço.
        </p>
      </header>

      <section className="panel">
        <h2>1) Importação manual de CSV</h2>
        <p className="helper">Formato esperado: date,merchant,amount,category</p>
        <div className="import-row">
          <input type="file" accept=".csv" onChange={handleFileUpload} aria-label="Selecionar ficheiro CSV" />
          <button type="button" onClick={handleImport} disabled={loading}>
            {loading ? 'A importar…' : 'Importar e analisar'}
          </button>
        </div>
        {error ? <p className="status error">{error}</p> : null}
        {success ? <p className="status success">{success}</p> : null}
      </section>

      <section className="cards-grid" aria-label="Resumo do dashboard">
        <article className="card">
          <h3>Total mensal estimado</h3>
          <p className="metric">€{dashboard.monthlyTotal.toFixed(2)}</p>
        </article>
        <article className="card">
          <h3>Total anual estimado</h3>
          <p className="metric">€{dashboard.annualTotal.toFixed(2)}</p>
        </article>
        <article className="card">
          <h3>Subscrições detetadas</h3>
          <p className="metric">{totalSubscriptions}</p>
        </article>
        <article className="card">
          <h3>Alertas ativos</h3>
          <p className="metric">{dashboard.alerts.length}</p>
        </article>
      </section>

      <section className="panel two-col">
        <div>
          <h2>2) Subscrições detetadas</h2>
          <ul className="list">
            {dashboard.subscriptions.length === 0 ? (
              <li>Nenhuma subscrição recorrente detetada.</li>
            ) : (
              dashboard.subscriptions.map((subscription) => (
                <li key={`${subscription.merchant}-${subscription.nextPaymentDate}`}>
                  <strong>{subscription.merchant}</strong> · €{subscription.amount.toFixed(2)} · cada{' '}
                  {subscription.intervalDays} dias · próxima cobrança em {subscription.nextPaymentDate}
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h2>3) Alertas</h2>
          <ul className="list">
            {dashboard.alerts.length === 0 ? (
              <li>Sem alertas de momento.</li>
            ) : (
              dashboard.alerts.map((alert) => <li key={`${alert.type}-${alert.message}`}>{alert.message}</li>)
            )}
          </ul>
        </div>
      </section>

      <section className="panel">
        <h2>4) Timeline de pagamentos</h2>
        <ul className="list timeline">
          {dashboard.timeline.length === 0 ? (
            <li>Importa um CSV para ver a timeline.</li>
          ) : (
            dashboard.timeline.map((item) => (
              <li key={`${item.date}-${item.merchant}-${item.amount}`}>
                <span>{item.date}</span>
                <strong>{item.merchant}</strong>
                <span>€{item.amount.toFixed(2)}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  )
}

export default App
