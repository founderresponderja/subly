import type { DashboardSummary, Transaction, WaitlistEntry } from './types';

export type AuthUser = {
  id: string;
  email: string;
};

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Pedido falhou');
  }

  return response.json() as Promise<T>;
}

export function importCsv(csvText: string) {
  return requestJson<{ transactions: Transaction[]; summary: DashboardSummary }>('/api/import-csv', {
    method: 'POST',
    body: JSON.stringify({ csvText }),
  });
}

export function fetchDashboardSummary() {
  return requestJson<DashboardSummary>('/api/dashboard');
}

export function submitWaitlist(entry: WaitlistEntry) {
  return requestJson<{ ok: true }>('/api/waitlist', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export function registerWithEmail(email: string, password: string) {
  return requestJson<{ user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function loginWithEmail(email: string, password: string) {
  return requestJson<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function loginWithGoogle(idToken: string) {
  return requestJson<{ user: AuthUser }>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
}

export function authMe() {
  return requestJson<{ user: AuthUser }>('/api/auth/me');
}

export function logout() {
  return requestJson<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
  });
}