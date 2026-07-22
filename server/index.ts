import cors from 'cors';
import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { parse } from 'csv-parse/sync';
import { detectSubscriptions, detectSubscriptionsFromRows } from './detectSubscriptions';
import { closeDbPool } from './db';
import {
  getTransactionsForUser,
  saveTransactions,
  replaceDerivedData,
} from './repository';
import {
  buildSessionClearCookie,
  buildSessionCookie,
  createSessionToken,
  findUserById,
  loginWithEmail,
  registerWithEmail,
  upsertGoogleUser,
  verifyGoogleIdToken,
} from './auth';
import { requireAuth } from './middleware/auth';
import type { ParsedRow, Transaction, WaitlistEntry } from './types';

const app = express();
const port = Number(process.env.PORT ?? 3001);
const waitlist: WaitlistEntry[] = [];
const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas tentativas. Tenta novamente dentro de alguns minutos.',
});

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const email = String(request.body?.email ?? '').trim().toLowerCase();
    const password = String(request.body?.password ?? '');

    if (!email || !password) {
      response.status(400).json({ message: 'Email e password são obrigatórios.' });
      return;
    }

    if (password.length < 8) {
      response.status(400).json({ message: 'A password deve ter pelo menos 8 caracteres.' });
      return;
    }

    const user = await registerWithEmail(email, password);
    const token = createSessionToken({ id: user.id, email: user.email });
    response.setHeader('Set-Cookie', buildSessionCookie(token));
    response.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Já existe')) {
      response.status(409).json({ message: error.message });
      return;
    }
    next(error);
  }
});

app.post('/api/auth/login', loginLimiter, async (request, response, next) => {
  try {
    const email = String(request.body?.email ?? '').trim().toLowerCase();
    const password = String(request.body?.password ?? '');

    if (!email || !password) {
      response.status(400).json({ message: 'Email e password são obrigatórios.' });
      return;
    }

    const user = await loginWithEmail(email, password);
    if (!user) {
      response.status(401).json({ message: 'Credenciais inválidas.' });
      return;
    }

    const token = createSessionToken({ id: user.id, email: user.email });
    response.setHeader('Set-Cookie', buildSessionCookie(token));
    response.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/google', async (request, response, next) => {
  try {
    const idToken = String(request.body?.idToken ?? '');
    if (!idToken) {
      response.status(400).json({ message: 'ID token em falta.' });
      return;
    }

    const payload = await verifyGoogleIdToken(idToken);
    const user = await upsertGoogleUser(payload);
    const token = createSessionToken({ id: user.id, email: user.email });
    response.setHeader('Set-Cookie', buildSessionCookie(token));
    response.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    response.status(401).json({ message: 'Não foi possível validar o login Google.' });
  }
});

app.post('/api/auth/logout', (_request, response) => {
  response.setHeader('Set-Cookie', buildSessionClearCookie());
  response.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (request, response, next) => {
  try {
    const user = await findUserById(request.user!.id);
    if (!user) {
      response.status(401).json({ message: 'Sessão inválida.' });
      return;
    }
    response.json({ user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, service: 'subly-api' });
});

app.get('/api/dashboard', requireAuth, async (request, response, next) => {
  try {
    const transactions = await getTransactionsForUser(request.user!.id);
    response.json(detectSubscriptions(transactions));
  } catch (error) {
    next(error);
  }
});

app.post('/api/waitlist', (request, response) => {
  const entry = request.body as WaitlistEntry;

  if (!entry?.name || !entry?.email) {
    response.status(400).send('Nome e email são obrigatórios.');
    return;
  }

  waitlist.push(entry);
  response.json({ ok: true });
});

app.post('/api/import-csv', requireAuth, async (request, response, next) => {
  try {
    const csvText = String(request.body?.csvText ?? '');
    if (!csvText.trim()) {
      response.status(400).send('CSV em falta.');
      return;
    }

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const rows: ParsedRow[] = records.map((record) => ({
      date: record.date ?? record.data ?? record.transaction_date,
      description: record.description ?? record.descricao ?? record.merchant ?? record.comerciante,
      amount: Number(String(record.amount ?? record.valor ?? record.value).replace(',', '.')),
    }));

    const normalizedRows = rows.filter((row) => row.date && row.description && Number.isFinite(row.amount));

    const importedTransactions: Transaction[] = normalizedRows.map((row, index) => ({
      id: `import-${index + 1}`,
      date: row.date,
      description: row.description,
      amount: row.amount,
      currency: 'EUR',
      source: 'csv',
    }));

    await saveTransactions(request.user!.id, importedTransactions);

    const summary = detectSubscriptionsFromRows(normalizedRows);
    await replaceDerivedData(request.user!.id, summary.subscriptions, summary.alerts, importedTransactions);

    response.json({
      transactions: importedTransactions,
      summary,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error);
  response.status(500).send('Erro interno no servidor.');
});

app.listen(port, () => {
  console.log(`Subly API a correr em http://localhost:${port}`);
});

process.on('SIGTERM', async () => {
  await closeDbPool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await closeDbPool();
  process.exit(0);
});