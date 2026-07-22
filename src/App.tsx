import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import anime from 'animejs';
import { useAuth } from './lib/auth';
import { fetchDashboardSummary, importCsv, submitWaitlist } from './lib/api';
import type { DashboardSummary } from './lib/types';

type ViewState = 'landing' | 'importacao' | 'dashboard' | 'alertas';

const demoCsv = `date,description,amount
2026-01-03,NETFLIX.COM,-12.99
2026-02-03,NETFLIX.COM,-12.99
2026-03-03,NETFLIX.COM,-13.99
2026-01-08,MEO FIBRA,-34.90
2026-02-08,MEO FIBRA,-34.90
2026-03-08,MEO FIBRA,-34.90
2026-01-14,SPOTIFY,-7.99
2026-02-14,SPOTIFY,-7.99
2026-03-14,SPOTIFY,-7.99`;

const initialSummary: DashboardSummary = {
  monthlyTotal: 0,
  annualTotal: 0,
  subscriptions: [],
  alerts: [],
  paymentTimeline: [],
};

function formatEuro(value: number) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
}

function formatDate(date: string | null) {
  if (!date) return 'Sem previsão';
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}

function AuthScreen() {
  const { loginEmail, registerEmail, loginGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [status, setStatus] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId || !googleButtonRef.current || !window.google?.accounts?.id) {
      return;
    }

    googleButtonRef.current.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        if (!response.credential) {
          setStatus('Falha no login Google.');
          return;
        }
        try {
          await loginGoogle(response.credential);
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Não foi possível autenticar com Google.');
        }
      },
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 280,
    });
  }, [loginGoogle]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    try {
      if (mode === 'login') {
        await loginEmail(email, password);
      } else {
        await registerEmail(email, password);
      }
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível autenticar.');
    }
  };

  return (
    <div className="app-shell">
      <main className="auth-main">
        <section className="panel auth-panel">
          <span className="eyebrow">Acesso Subly</span>
          <h1>{mode === 'login' ? 'Entrar na conta' : 'Criar conta'}</h1>
          <p>Usa email e password ou continua com Google para aceder ao teu dashboard privado.</p>

          <form className="waitlist-form" onSubmit={handleSubmit}>
            <label>
              Email
              <input name="email" type="email" placeholder="tu@empresa.pt" required />
            </label>
            <label>
              Password
              <input name="password" type="password" placeholder="Mínimo 8 caracteres" required minLength={8} />
            </label>
            <button className="primary-cta" type="submit">
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          <div className="auth-separator"><span>ou</span></div>
          <div ref={googleButtonRef} className="google-button-slot" />

          <div className="cta-row">
            <button className="secondary-cta" onClick={() => setMode('login')} type="button">Já tenho conta</button>
            <button className="secondary-cta" onClick={() => setMode('register')} type="button">Quero registar</button>
          </div>

          {status && <p className="helper-text">{status}</p>}
          {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <p className="helper-text">Define VITE_GOOGLE_CLIENT_ID no frontend para ativar Google Sign-In.</p>
          )}
        </section>
      </main>
    </div>
  );
}

function AppShell() {
  const { user, logoutUser } = useAuth();
  const [view, setView] = useState<ViewState>('landing');
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary);
  const [csvText, setCsvText] = useState(demoCsv);
  const [status, setStatus] = useState('Pronto para importar um extrato CSV.');
  const [waitlistStatus, setWaitlistStatus] = useState('');
  const heroRef = useRef<HTMLDivElement>(null);
  const revealRefs = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    void fetchDashboardSummary().then(setSummary).catch(() => setSummary(initialSummary));
  }, []);

  useEffect(() => {
    if (!heroRef.current) return;

    anime({
      targets: heroRef.current.querySelectorAll('[data-animate]'),
      opacity: [0, 1],
      translateY: [18, 0],
      delay: anime.stagger(70),
      duration: 360,
      easing: 'easeOutQuad',
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          anime({
            targets: entry.target.querySelectorAll('[data-reveal-item]'),
            opacity: [0, 1],
            translateY: [20, 0],
            delay: anime.stagger(90),
            duration: 320,
            easing: 'easeOutQuad',
          });
        }
      });
    }, { threshold: 0.25 });

    revealRefs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const pricingCards = useMemo(
    () => [
      { name: 'Free', price: '0€', description: 'Importa, deteta e vê o essencial.' },
      { name: 'Pro', price: '3,99€', description: 'Alertas completos, exportações e histórico.' },
      { name: 'Família', price: '6,99€', description: 'A gestão partilhada chega na fase 2.' },
    ],
    [],
  );

  const handleImport = async () => {
    setStatus('A importar e a detetar recorrências...');
    try {
      const result = await importCsv(csvText);
      setSummary(result.summary);
      setView('dashboard');
      setStatus(`Detetadas ${result.summary.subscriptions.length} subscrições recorrentes.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Falha ao importar CSV.');
    }
  };

  const handleWaitlist = async (formData: FormData) => {
    const name = String(formData.get('name') ?? '');
    const email = String(formData.get('email') ?? '');
    const company = String(formData.get('company') ?? '');

    try {
      await submitWaitlist({ name, email, company });
      setWaitlistStatus('Entraste na waitlist. Vamos avisar-te assim que o Subly abrir o acesso.');
    } catch (error) {
      setWaitlistStatus(error instanceof Error ? error.message : 'Não foi possível registar a waitlist.');
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">Subly</div>
        <nav className="topnav">
          <button onClick={() => setView('landing')}>Landing</button>
          <button onClick={() => setView('importacao')}>Importar CSV</button>
          <button onClick={() => setView('dashboard')}>Dashboard</button>
          <button onClick={() => setView('alertas')}>Alertas</button>
        </nav>
        <div className="topbar-user">
          <span>{user?.email}</span>
          <button className="secondary-cta" onClick={() => void logoutUser()}>Terminar sessão</button>
        </div>
      </header>

      <main ref={heroRef}>
        <section className="hero panel">
          <div className="hero-copy">
            <span className="eyebrow" data-animate>Fintech dark mode para Portugal</span>
            <h1 data-animate>Vê, corta e controla as tuas subscrições antes de elas te cortarem a carteira.</h1>
            <p data-animate>
              Subly deteta recorrências em extratos, mostra subidas de preço e prepara o caminho para Open Banking PT sem guardar dados bancários em bruto.
            </p>
            <div className="cta-row" data-animate>
              <button className="primary-cta" onMouseEnter={(event) => anime({ targets: event.currentTarget, scale: 1.02, duration: 180 })} onMouseLeave={(event) => anime({ targets: event.currentTarget, scale: 1, duration: 180 })} onClick={() => setView('importacao')}>
                Importar extrato CSV
              </button>
              <button className="secondary-cta" onMouseEnter={(event) => anime({ targets: event.currentTarget, scale: 1.02, duration: 180 })} onMouseLeave={(event) => anime({ targets: event.currentTarget, scale: 1, duration: 180 })} onClick={() => setView('dashboard')}>
                Ver dashboard demo
              </button>
            </div>
            <div className="hero-metrics" data-animate>
              <div>
                <strong>{summary.subscriptions.length}</strong>
                <span>subscrições detetadas</span>
              </div>
              <div>
                <strong>{formatEuro(summary.monthlyTotal)}</strong>
                <span>custo mensal estimado</span>
              </div>
              <div>
                <strong>{summary.alerts.length}</strong>
                <span>alertas úteis</span>
              </div>
            </div>
          </div>

          <div className="hero-card" data-animate>
            <div className="status-pill">Open Banking PT pronto para a Fase 2</div>
            <div className="chart-stack">
              <div className="chart-row" style={{ width: '92%' }} />
              <div className="chart-row accent" style={{ width: '74%' }} />
              <div className="chart-row" style={{ width: '55%' }} />
              <div className="chart-row alert" style={{ width: '37%' }} />
            </div>
            <p>Deteção automática baseada em valor, comerciante e intervalo regular.</p>
          </div>
        </section>

        <section className="panel problem-section" ref={(node) => {
          revealRefs.current[0] = node;
        }}>
          <div className="section-header">
            <span className="eyebrow">Problema</span>
            <h2>Quantas subscrições esqueceste este mês?</h2>
          </div>
          <div className="problem-grid">
            <article className="stat-card" data-reveal-item>
              <strong>€ 312</strong>
              <span>gasto recorrente médio que passa despercebido em pequenos extratos</span>
            </article>
            <article className="stat-card" data-reveal-item>
              <strong>7 dias</strong>
              <span>tempo médio até um utilizador notar uma subida de preço</span>
            </article>
            <article className="stat-card" data-reveal-item>
              <strong>0 raw</strong>
              <span>dados bancários guardados, apenas metadados minimizados para RGPD</span>
            </article>
          </div>
        </section>

        <section className="panel steps-section" ref={(node) => {
          revealRefs.current[1] = node;
        }}>
          <div className="section-header">
            <span className="eyebrow">Como funciona</span>
            <h2>Três passos para encontrares o que te está a sair da conta.</h2>
          </div>
          <div className="steps-grid">
            <article className="step-card" data-reveal-item>
              <span>01</span>
              <h3>Importa um CSV</h3>
              <p>Cola o extrato manualmente ou carrega o ficheiro do banco.</p>
            </article>
            <article className="step-card" data-reveal-item>
              <span>02</span>
              <h3>Detecta recorrências</h3>
              <p>O motor agrupa comerciante, valor e intervalo para identificar padrões reais.</p>
            </article>
            <article className="step-card" data-reveal-item>
              <span>03</span>
              <h3>Recebe alertas</h3>
              <p>Renovação, aumento de preço, duplicados e sinais de subscrições inativas.</p>
            </article>
          </div>
        </section>

        <section className="panel pricing-section" ref={(node) => {
          revealRefs.current[2] = node;
        }}>
          <div className="section-header">
            <span className="eyebrow">Preços</span>
            <h2>Simples, agressivo e alinhado com a proposta de valor.</h2>
          </div>
          <div className="pricing-grid">
            {pricingCards.map((card) => (
              <article className="pricing-card" key={card.name} data-reveal-item>
                <h3>{card.name}</h3>
                <strong>{card.price}</strong>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel tool-section">
          <div className="section-header">
            <span className="eyebrow">MVP</span>
            <h2>Importação manual, deteção automática, dashboard e alertas.</h2>
          </div>
          <div className="tool-switcher">
            <button className={view === 'landing' ? 'active' : ''} onClick={() => setView('landing')}>Landing</button>
            <button className={view === 'importacao' ? 'active' : ''} onClick={() => setView('importacao')}>Importação</button>
            <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
            <button className={view === 'alertas' ? 'active' : ''} onClick={() => setView('alertas')}>Alertas</button>
          </div>

          {view === 'importacao' && (
            <div className="tool-layout">
              <div className="editor-card">
                <h3>Extrato CSV</h3>
                <textarea value={csvText} onChange={(event) => setCsvText(event.target.value)} rows={14} spellCheck={false} />
                <div className="cta-row">
                  <button className="primary-cta" onClick={handleImport}>Analisar agora</button>
                  <button className="secondary-cta" onClick={() => setCsvText(demoCsv)}>Carregar exemplo</button>
                </div>
                <p className="helper-text">Formato esperado: date, description, amount. O backend recebe apenas texto mínimo para dedução.</p>
              </div>
              <div className="preview-card">
                <h3>Resultado do motor</h3>
                <p>{status}</p>
                <div className="summary-grid">
                  <div><span>Mensal</span><strong>{formatEuro(summary.monthlyTotal)}</strong></div>
                  <div><span>Anual</span><strong>{formatEuro(summary.annualTotal)}</strong></div>
                </div>
              </div>
            </div>
          )}

          {view === 'dashboard' && (
            <div className="dashboard-grid">
              <article className="metric-panel">
                <span>Mensal</span>
                <strong>{formatEuro(summary.monthlyTotal)}</strong>
                <p>Estimativa agregada de todas as assinaturas recorrentes.</p>
              </article>
              <article className="metric-panel">
                <span>Anual</span>
                <strong>{formatEuro(summary.annualTotal)}</strong>
                <p>Projeção anual do gasto recorrente identificado.</p>
              </article>
              <article className="timeline-panel">
                <h3>Timeline</h3>
                <ul>
                  {summary.paymentTimeline.map((item) => (
                    <li key={`${item.date}-${item.merchant}`}>
                      <span>{item.merchant}</span>
                      <strong>{formatEuro(item.amount)}</strong>
                      <small>{item.date}</small>
                    </li>
                  ))}
                </ul>
              </article>
              <article className="subscriptions-panel">
                <h3>Subscrições detetadas</h3>
                <ul>
                  {summary.subscriptions.map((subscription) => (
                    <li key={subscription.merchant}>
                      <div>
                        <strong>{subscription.merchant}</strong>
                        <span>{subscription.cadence} · Próxima {formatDate(subscription.nextChargeDate)}</span>
                      </div>
                      <small>{formatEuro(subscription.amount)} · {subscription.confidence}%</small>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          )}

          {view === 'alertas' && (
            <div className="alerts-grid">
              {summary.alerts.map((alert) => (
                <article className={`alert-card severity-${alert.severity.toLowerCase()}`} key={`${alert.type}-${alert.merchant}`}>
                  <span>{alert.type}</span>
                  <strong>{alert.merchant}</strong>
                  <p>{alert.message}</p>
                </article>
              ))}
            </div>
          )}

          {view === 'landing' && (
            <div className="waitlist-grid">
              <article className="waitlist-copy">
                <h3>Entra na waitlist</h3>
                <p>Recebe acesso antecipado ao Subly e ajuda-nos a adaptar fornecedores portugueses reais logo na primeira versão.</p>
              </article>
              <form
                className="waitlist-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await handleWaitlist(new FormData(event.currentTarget));
                }}
              >
                <label>
                  Nome
                  <input name="name" placeholder="O teu nome" required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" placeholder="tu@empresa.pt" required />
                </label>
                <label>
                  Empresa
                  <input name="company" placeholder="Opcional" />
                </label>
                <button className="primary-cta" type="submit">Quero testar o Subly</button>
                <p className="helper-text">{waitlistStatus || 'Sem spam. Apenas acesso antecipado, updates do produto e pedidos de feedback.'}</p>
              </form>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell">
        <main className="auth-main">
          <section className="panel auth-panel">
            <h1>A validar sessão...</h1>
          </section>
        </main>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <AppShell />;
}

export default App;
