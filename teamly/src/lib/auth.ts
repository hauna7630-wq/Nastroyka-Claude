// Auth primitives: password hashing (bcrypt) + HMAC-signed stateless session
// tokens. The crypto here is pure (Node) and unit-tested.

import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export interface SessionPayload {
  userId: string;
  orgId: string;
  exp: number; // unix seconds
}

const DEFAULT_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

export function signSession(
  payload: Omit<SessionPayload, 'exp'>,
  secret: string,
  ttlSec: number = DEFAULT_TTL_SEC,
): string {
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const body = b64url(Buffer.from(JSON.stringify(full)));
  const sig = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  const dot = token.indexOf('.');
  if (dot === -1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(createHmac('sha256', secret).update(body).digest());

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.userId || !payload.orgId || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newSecret(): string {
  return randomBytes(32).toString('hex');
}

export const SESSION_COOKIE = 'teamly_session';
