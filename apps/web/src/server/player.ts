// Player-level services: consent (DPDP / age gate), progress (academy, best runs), grievances, deletion.
import { randomBytes } from 'node:crypto';
import { lessonById, XP_PER_CORRECT } from '../content/academy';
import { TERMS_VERSION } from '../lib/modes';
import type { AcademyBody, ConsentBody, GrievanceBody } from '../lib/schemas';
import { HttpError } from './http';
import { appendGrievance, deletePlayer, grievancesSince, readPlayerFile, withLock, writePlayerFile } from './store';

export interface ConsentRecord {
  termsVersion: string;
  ageConfirmed: true;
  at: string;
}

export interface Progress {
  academy: Record<string, { correct: number; total: number; at: string }>;
  /** Best result per side mode: daily by date, time machine by scenario id. */
  dailyBest: Record<string, number>;
  timeMachineBest: Record<string, number>;
}

const emptyProgress = (): Progress => ({ academy: {}, dailyBest: {}, timeMachineBest: {} });

export async function getConsent(playerId: string): Promise<ConsentRecord | null> {
  const c = await readPlayerFile<ConsentRecord>(playerId, 'consent');
  return c && c.termsVersion === TERMS_VERSION ? c : null;
}

/** Every game action that processes a player's data needs current consent (legal review L-04/L-05). */
export async function requireConsent(playerId: string): Promise<void> {
  if (!(await getConsent(playerId)))
    throw new HttpError(403, 'CONSENT_REQUIRED', 'Please confirm you are 18 or older and accept the Terms and Privacy Notice to play.');
}

export function recordConsent(playerId: string, body: ConsentBody) {
  return withLock(`player:${playerId}`, async () => {
    if (body.termsVersion !== TERMS_VERSION) throw new HttpError(409, 'TERMS_CHANGED', 'The Terms have changed. Reload the page to read the current version.');
    const rec: ConsentRecord = { termsVersion: TERMS_VERSION, ageConfirmed: true, at: new Date().toISOString() };
    await writePlayerFile(playerId, 'consent', rec);
    return rec;
  });
}

export async function getProgress(playerId: string): Promise<Progress> {
  return { ...emptyProgress(), ...(await readPlayerFile<Progress>(playerId, 'progress')) };
}

export function updateProgress(playerId: string, fn: (p: Progress) => Progress) {
  return withLock(`player:${playerId}:progress`, async () => {
    const next = fn(await getProgress(playerId));
    await writePlayerFile(playerId, 'progress', next);
    return next;
  });
}

export async function me(playerId: string) {
  const progress = await getProgress(playerId);
  const xp = Object.values(progress.academy).reduce((a, l) => a + l.correct * XP_PER_CORRECT, 0);
  return { consent: await getConsent(playerId), termsVersion: TERMS_VERSION, progress, xp };
}

export function deleteMyData(playerId: string) {
  return withLock(`player:${playerId}`, async () => {
    await deletePlayer(playerId);
    return { deleted: true };
  });
}

const GRIEVANCES_PER_DAY = 5;

export async function fileGrievance(playerId: string, body: GrievanceBody) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  if ((await grievancesSince(playerId, since)) >= GRIEVANCES_PER_DAY)
    throw new HttpError(429, 'RATE_LIMITED', 'You have sent several messages today. We will reply to those first.');
  const ref = `MS-${randomBytes(4).toString('hex').toUpperCase()}`;
  await appendGrievance({ ref, at: new Date().toISOString(), playerId, category: body.category, message: body.message, email: body.email ?? null });
  return { ref };
}

export async function submitLesson(playerId: string, body: AcademyBody) {
  await requireConsent(playerId);
  const lesson = lessonById(body.lessonId);
  if (!lesson) throw new HttpError(404, 'NOT_FOUND', 'Unknown lesson.');
  if (body.answers.length !== lesson.quiz.length) throw new HttpError(400, 'BAD_REQUEST', 'Answer every question.');
  const correct = lesson.quiz.reduce((n, q, i) => n + (body.answers[i] === q.answer ? 1 : 0), 0);
  const progress = await updateProgress(playerId, (p) => {
    const prev = p.academy[lesson.id];
    // Keep the best attempt.
    if (prev && prev.correct >= correct) return p;
    return { ...p, academy: { ...p.academy, [lesson.id]: { correct, total: lesson.quiz.length, at: new Date().toISOString() } } };
  });
  return { correct, total: lesson.quiz.length, results: lesson.quiz.map((q, i) => ({ correct: body.answers[i] === q.answer, answer: q.answer, why: q.why })), progress };
}
