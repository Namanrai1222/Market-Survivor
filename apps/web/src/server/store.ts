// Dev persistence: one JSON document per career + an append-only days log.
// ponytail: JSON files + in-process lock = single server process only. Replace with Postgres
// (SELECT … FOR UPDATE, one transaction per mutation) when the database is added.
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CareerState, DayRecord } from '@ms/engine';
import { migrateCareer, migrateDay } from './migrate';
import { seal, unseal } from './seal';

export interface CareerDoc {
  career: CareerState;
  /** Server-only facts about side runs (which day's challenge, which scenario). */
  meta?: { dailyDate?: string; scenarioId?: string };
  /** Idempotency-Key → stored result of the first request with that key. */
  idem: Record<string, { at: number; result: unknown }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (s: string): boolean => UUID.test(s);

// Default: apps/web/.data, whether the server was started from apps/web or from the repo root.
function defaultRoot(): string {
  const nested = path.join(process.cwd(), 'apps', 'web');
  return existsSync(path.join(nested, 'next.config.ts')) ? path.join(nested, '.data') : path.join(process.cwd(), '.data');
}
const root = (): string => process.env.MS_DATA_DIR ?? defaultRoot();

// Ids are validated before touching the filesystem (no path traversal).
function playerDir(playerId: string): string {
  if (!isUuid(playerId)) throw new Error('invalid player id');
  return path.join(root(), 'players', playerId);
}
function careerFile(playerId: string, careerId: string, ext: 'json' | 'days.jsonl'): string {
  if (!isUuid(careerId)) throw new Error('invalid career id');
  return path.join(playerDir(playerId), `${careerId}.${ext}`);
}

const isMissing = (e: unknown): boolean => (e as NodeJS.ErrnoException).code === 'ENOENT';

/** Reads a career, opening its sealed seed and upgrading old saves. */
export async function readDoc(playerId: string, careerId: string): Promise<CareerDoc | null> {
  try {
    const doc = JSON.parse(await readFile(careerFile(playerId, careerId, 'json'), 'utf8')) as CareerDoc;
    const career = migrateCareer(doc.career as Parameters<typeof migrateCareer>[0]);
    return { ...doc, career: { ...career, seed: unseal(career.seed) } };
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

/** Atomic write: temp file + rename (retried briefly; Windows can hold the target open). The seed is sealed at rest. */
export async function writeDoc(playerId: string, doc: CareerDoc): Promise<void> {
  await writeJsonAtomic(careerFile(playerId, doc.career.id, 'json'), { ...doc, career: { ...doc.career, seed: seal(doc.career.seed) } });
}

async function writeJsonAtomic(f: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(value));
  for (let i = 0; ; i++) {
    try {
      await rename(tmp, f);
      return;
    } catch (e) {
      if (i >= 4 || (e as NodeJS.ErrnoException).code !== 'EPERM') throw e;
      await new Promise((r) => setTimeout(r, 20 * (i + 1)));
    }
  }
}

export async function listDocs(playerId: string): Promise<CareerDoc[]> {
  let names: string[];
  try {
    names = await readdir(playerDir(playerId));
  } catch (e) {
    if (isMissing(e)) return [];
    throw e;
  }
  const ids = names.filter((n) => /^[0-9a-f-]{36}\.json$/.test(n)).map((n) => n.slice(0, 36));
  const docs = await Promise.all(ids.map((id) => readDoc(playerId, id)));
  return docs.filter((d): d is CareerDoc => d !== null);
}

export async function deleteDoc(playerId: string, careerId: string): Promise<void> {
  await rm(careerFile(playerId, careerId, 'json'), { force: true });
  await rm(careerFile(playerId, careerId, 'days.jsonl'), { force: true });
}

/** Append-only history (world_days / prices_daily / net_worth_snapshots). Readers dedupe by date, last wins. */
export async function appendDays(playerId: string, careerId: string, records: DayRecord[]): Promise<void> {
  if (!records.length) return;
  await appendFile(careerFile(playerId, careerId, 'days.jsonl'), records.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

/** Every recorded day, oldest first, deduped by date (last write wins). Empty if none yet. */
export async function readDays(playerId: string, careerId: string): Promise<DayRecord[]> {
  let text: string;
  try {
    text = await readFile(careerFile(playerId, careerId, 'days.jsonl'), 'utf8');
  } catch (e) {
    if (isMissing(e)) return [];
    throw e;
  }
  const byDate = new Map<string, DayRecord>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const r = migrateDay(JSON.parse(line) as DayRecord);
    byDate.set(r.date, r);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---------- Player-level records (consent, progress) and account deletion ----------

export type PlayerFile = 'consent' | 'progress';

export async function readPlayerFile<T>(playerId: string, name: PlayerFile): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(playerDir(playerId), `${name}.json`), 'utf8')) as T;
  } catch (e) {
    if (isMissing(e)) return null;
    throw e;
  }
}

export const writePlayerFile = (playerId: string, name: PlayerFile, value: unknown): Promise<void> =>
  writeJsonAtomic(path.join(playerDir(playerId), `${name}.json`), value);

/** "Delete my data": every career, day log, consent and progress record for this player. */
export async function deletePlayer(playerId: string): Promise<void> {
  await rm(playerDir(playerId), { recursive: true, force: true });
}

// ---------- Grievances (Online Gaming Rules 2026 / DPDP grievance redressal) ----------

export interface GrievanceRecord {
  ref: string;
  at: string;
  playerId: string | null;
  category: string;
  message: string;
  email: string | null;
}

const grievanceFile = (): string => path.join(root(), 'grievances.jsonl');

export async function appendGrievance(g: GrievanceRecord): Promise<void> {
  await mkdir(root(), { recursive: true });
  await appendFile(grievanceFile(), JSON.stringify(g) + '\n');
}

export async function grievancesSince(playerId: string, sinceIso: string): Promise<number> {
  let text: string;
  try {
    text = await readFile(grievanceFile(), 'utf8');
  } catch (e) {
    if (isMissing(e)) return 0;
    throw e;
  }
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as GrievanceRecord).filter((g) => g.playerId === playerId && g.at >= sinceIso).length;
}

// Per-key promise chain. Kept on globalThis so dev hot-reloads share one lock table.
const g = globalThis as typeof globalThis & { __msLocks?: Map<string, Promise<void>> };
const locks = (g.__msLocks ??= new Map());

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (locks.get(key) ?? Promise.resolve()).then(fn);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}
