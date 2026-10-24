// HTTP plumbing for /api/ms/*: player session, idempotency keys, error → status mapping.
import { randomUUID } from 'node:crypto';
import { GameError, InvariantError } from '@ms/engine';
import { ZodError } from 'zod';
import { isUuid } from './store';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

// Anonymous player id until the main site's auth exists. Random UUID = unguessable bearer id.
const COOKIE = 'ms_pid';

export function readPlayerId(req: Request): string | null {
  const m = /(?:^|;\s*)ms_pid=([^;]+)/.exec(req.headers.get('cookie') ?? '');
  return m?.[1] && isUuid(m[1]) ? m[1] : null;
}

export function requirePlayer(req: Request): string {
  const id = readPlayerId(req);
  if (!id) throw new HttpError(401, 'UNAUTHENTICATED', 'No player session. Open the game from the start page.');
  return id;
}

export function sessionCookie(id: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

/** Expires the session cookie (after "Delete my data"). */
export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** The caller's player id, minting an anonymous one on first contact. */
export function playerSession(req: Request): { playerId: string; setCookie?: string } {
  const existing = readPlayerId(req);
  if (existing) return { playerId: existing };
  const playerId = randomUUID();
  return { playerId, setCookie: sessionCookie(playerId) };
}

const IDEM = /^[A-Za-z0-9_-]{8,100}$/;
export function idempotencyKey(req: Request): string {
  const k = req.headers.get('idempotency-key');
  if (!k || !IDEM.test(k)) throw new HttpError(400, 'IDEMPOTENCY_KEY', 'Missing or invalid Idempotency-Key header.');
  return k;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'BAD_JSON', 'Request body must be JSON.');
  }
}

export function json(body: unknown, init: { status?: number; setCookie?: string } = {}): Response {
  const headers = new Headers({ 'cache-control': 'no-store' });
  if (init.setCookie) headers.set('set-cookie', init.setCookie);
  return Response.json(body, { status: init.status ?? 200, headers });
}

const GAME_STATUS: Record<string, number> = { NOT_FOUND: 404, DESK_LOCKED: 403, MARKET_HALTED: 409, ENDED: 409, CHECKPOINT: 409 };

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json({ error: { code: e.code, message: e.message }, ...e.extra }, { status: e.status });
    if (e instanceof GameError) return json({ error: { code: e.code, message: e.message } }, { status: GAME_STATUS[e.code] ?? 422 });
    if (e instanceof ZodError)
      return json({ error: { code: 'BAD_REQUEST', message: 'Invalid request.', issues: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } }, { status: 400 });
    console.error(e instanceof InvariantError ? '[ms] INVARIANT VIOLATION — mutation aborted' : '[ms] unexpected error', e);
    return json({ error: { code: 'INTERNAL', message: 'Something went wrong. Your career was not changed.' } }, { status: 500 });
  }
}
