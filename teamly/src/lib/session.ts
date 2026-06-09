import { cookies } from 'next/headers';
import { verifySession, signSession, SESSION_COOKIE, SessionPayload } from './auth';

function secret(): string {
  return process.env.AUTH_SECRET || 'dev-secret-change-me-please-32chars-min';
}

export function getSession(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token, secret());
}

export function createSession(userId: string, orgId: string): void {
  const token = signSession({ userId, orgId }, secret());
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function destroySession(): void {
  cookies().delete(SESSION_COOKIE);
}
