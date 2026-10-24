'use client';

import { useCallback, useEffect, useState } from 'react';
import { LESSONS, XP_PER_CORRECT, type Lesson } from '@/content/academy';
import { api, type MeInfo } from '@/lib/api';
import { ConsentGate } from '../home/ConsentGate';

type Result = Awaited<ReturnType<typeof api.submitLesson>>;

/** Lesson list → read → quiz → server-scored result. Best attempt kept per lesson. */
export function AcademyApp() {
  const [me, setMe] = useState<MeInfo | null>(null);
  const [open, setOpen] = useState<Lesson | null>(null);
  const refresh = useCallback(() => api.me().then(setMe, () => setMe(null)), []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (open) return <LessonView lesson={open} onDone={() => { setOpen(null); void refresh(); }} />;

  const done = (id: string) => me?.progress.academy[id];
  return (
    <>
      <p className="lead">Short lessons on how markets and this game work, each with a three-question quiz. You earn {XP_PER_CORRECT} XP per correct answer; XP is just for you, not a prize.</p>
      <p className="academy-xp"><b>{me?.xp ?? 0} XP</b> · {Object.keys(me?.progress.academy ?? {}).length} of {LESSONS.length} lessons done</p>
      <ol className="lesson-list">
        {LESSONS.map((l, i) => {
          const d = done(l.id);
          return (
            <li key={l.id}>
              <button type="button" onClick={() => setOpen(l)}>
                <span className="lesson-n">{i + 1}</span>
                <span className="lesson-text"><strong>{l.title}</strong><small>{l.minutes} min read · 3 questions</small></span>
                <em className={d ? (d.correct === d.total ? 'up' : '') : 'muted'}>{d ? `${d.correct}/${d.total}` : 'Start'}</em>
              </button>
            </li>
          );
        })}
      </ol>
      {me && !me.consent && <ConsentGate onAccepted={() => void refresh()} />}
    </>
  );
}

function LessonView({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(lesson.quiz.map(() => null));
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.submitLesson({ lessonId: lesson.id, answers: answers as number[] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check your answers.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="lesson" aria-labelledby="lesson-title">
      <button className="text-button" type="button" onClick={onDone}>← All lessons</button>
      <h2 id="lesson-title">{lesson.title}</h2>
      {lesson.body.map((p) => <p key={p}>{p}</p>)}
      <h3>Quiz</h3>
      <ol className="quiz">
        {lesson.quiz.map((q, qi) => (
          <li key={q.q}>
            <fieldset disabled={Boolean(result)}>
              <legend>{q.q}</legend>
              {q.choices.map((c, ci) => {
                const r = result?.results[qi];
                const cls = r ? (ci === r.answer ? 'right' : answers[qi] === ci ? 'wrong' : '') : '';
                return (
                  <label key={c} className={`quiz-choice ${cls}`}>
                    <input type="radio" name={`q${qi}`} checked={answers[qi] === ci} onChange={() => setAnswers((a) => a.map((v, k) => (k === qi ? ci : v)))} />
                    <span>{c}</span>
                  </label>
                );
              })}
              {result && <p className="why">{result.results[qi]!.correct ? '✓ ' : '✗ '}{result.results[qi]!.why}</p>}
            </fieldset>
          </li>
        ))}
      </ol>
      {error && <p className="error-banner" role="alert">{error}</p>}
      {result ? (
        <div className="quiz-result" role="status">
          <b>{result.correct} of {result.total} correct · +{result.correct * XP_PER_CORRECT} XP</b>
          <button className="primary-button" type="button" onClick={onDone}>Back to lessons</button>
        </div>
      ) : (
        <button className="primary-button" type="button" disabled={busy || answers.some((a) => a === null)} onClick={() => void submit()}>
          {busy ? 'Checking…' : 'Check answers'}
        </button>
      )}
    </section>
  );
}
