import type { NextFunction, Request, Response } from 'express';
import {
  getSessionCookieName,
  parseCookies,
  verifySessionToken,
  ensureUserFromSession,
} from '../auth';

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const cookieName = getSessionCookieName();
  const cookieMap = parseCookies(request.headers.cookie);
  const token = cookieMap.get(cookieName);

  if (!token) {
    response.status(401).json({ message: 'Sessão inválida.' });
    return;
  }

  try {
    const payload = verifySessionToken(token);
    const user = await ensureUserFromSession(payload.id, payload.email);

    if (!user) {
      response.status(401).json({ message: 'Sessão inválida.' });
      return;
    }

    request.user = { id: user.id, email: user.email };
    next();
  } catch {
    response.status(401).json({ message: 'Sessão expirada ou inválida.' });
  }
}
