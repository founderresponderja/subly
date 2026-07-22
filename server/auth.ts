import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { usersTable } from './schema';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const jwtSecret = process.env.JWT_SECRET;
const cookieName = process.env.SESSION_COOKIE_NAME ?? 'subly_session';
const isProduction = process.env.NODE_ENV === 'production';
const jwtMaxAgeSeconds = 60 * 60 * 24 * 7;

if (!jwtSecret) {
  throw new Error('JWT_SECRET não está definido.');
}

function getJwtSecret() {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET não está definido.');
  }
  return jwtSecret;
}

export type AuthProvider = 'email' | 'google' | 'both';

export type AuthUser = {
  id: string;
  email: string;
  authProvider: AuthProvider;
  googleId: string | null;
};

export function getSessionCookieName() {
  return cookieName;
}

export function parseCookies(headerValue?: string) {
  if (!headerValue) return new Map<string, string>();

  const map = new Map<string, string>();
  const entries = headerValue.split(';');

  for (const entry of entries) {
    const [key, ...rest] = entry.trim().split('=');
    if (!key || rest.length === 0) continue;
    map.set(key, decodeURIComponent(rest.join('=')));
  }

  return map;
}

export function createSessionToken(payload: { id: string; email: string }) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: jwtMaxAgeSeconds,
  });
}

export function verifySessionToken(token: string) {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded !== 'object' || !decoded || !('id' in decoded) || !('email' in decoded)) {
    throw new Error('Payload JWT inválido.');
  }

  return decoded as { id: string; email: string; iat: number; exp: number };
}

export function buildSessionCookie(token: string) {
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${jwtMaxAgeSeconds}`,
  ];

  if (isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildSessionClearCookie() {
  const parts = [
    `${cookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];

  if (isProduction) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function mapUser(row: { id: string; email: string; authProvider: AuthProvider; googleId: string | null }) {
  return {
    id: row.id,
    email: row.email,
    authProvider: row.authProvider,
    googleId: row.googleId,
  } satisfies AuthUser;
}

export async function findUserByEmail(email: string) {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      passwordHash: usersTable.passwordHash,
      authProvider: usersTable.authProvider,
      googleId: usersTable.googleId,
    })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  return rows[0] ?? null;
}

export async function registerWithEmail(email: string, password: string) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('Já existe uma conta com este email.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const inserted = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      authProvider: 'email',
    })
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      authProvider: usersTable.authProvider,
      googleId: usersTable.googleId,
    });

  return mapUser(inserted[0]);
}

export async function loginWithEmail(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return mapUser(user);
}

export async function verifyGoogleIdToken(idToken: string) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID não está configurado.');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) {
    throw new Error('Token Google inválido.');
  }

  return {
    email: payload.email.toLowerCase(),
    googleId: payload.sub,
  };
}

export async function upsertGoogleUser(input: { email: string; googleId: string }) {
  const existingByEmail = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      authProvider: usersTable.authProvider,
      googleId: usersTable.googleId,
    })
    .from(usersTable)
    .where(eq(usersTable.email, input.email))
    .limit(1);

  if (existingByEmail.length > 0) {
    const user = existingByEmail[0];
    const nextProvider: AuthProvider = user.authProvider === 'email' ? 'both' : user.authProvider;

    const updated = await db
      .update(usersTable)
      .set({
        googleId: user.googleId ?? input.googleId,
        authProvider: nextProvider,
      })
      .where(eq(usersTable.id, user.id))
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        authProvider: usersTable.authProvider,
        googleId: usersTable.googleId,
      });

    return mapUser(updated[0]);
  }

  const existingByGoogleId = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      authProvider: usersTable.authProvider,
      googleId: usersTable.googleId,
    })
    .from(usersTable)
    .where(eq(usersTable.googleId, input.googleId))
    .limit(1);

  if (existingByGoogleId.length > 0) {
    return mapUser(existingByGoogleId[0]);
  }

  const inserted = await db
    .insert(usersTable)
    .values({
      email: input.email,
      authProvider: 'google',
      googleId: input.googleId,
    })
    .returning({
      id: usersTable.id,
      email: usersTable.email,
      authProvider: usersTable.authProvider,
      googleId: usersTable.googleId,
    });

  return mapUser(inserted[0]);
}

export async function findUserById(userId: string) {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      authProvider: usersTable.authProvider,
      googleId: usersTable.googleId,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return mapUser(rows[0]);
}

export async function ensureUserFromSession(id: string, email: string) {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      authProvider: usersTable.authProvider,
      googleId: usersTable.googleId,
    })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.email, email)))
    .limit(1);

  return rows[0] ? mapUser(rows[0]) : null;
}
