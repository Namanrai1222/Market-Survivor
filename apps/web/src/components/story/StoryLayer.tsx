'use client';

import { useEffect, useRef, useState } from 'react';
import { BREAKER_INDEX } from '@ms/content/universe';
import { formatDate, formatPct, tone } from '@ms/ui/format';
import type { StoryView } from '@/lib/api';

/** A native modal that opens on mount and cannot be dismissed with Escape unless `dismissable`. */
function Modal({ className, label, children, dismissable = false, onClose }: { className: string; label: string; children: React.ReactNode; dismissable?: boolean; onClose?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal(); // no close() on cleanup: Strict Mode would fire onClose
  }, []);
  return (
    <dialog ref={ref} className={`story-modal ${className}`} aria-labelledby={label} onCancel={(e) => (dismissable ? onClose?.() : e.preventDefault())}>
      {children}
    </dialog>
  );
}

/**
 * Victor's lines type themselves out (~65 chars/s, design-library-pro "typewriter + block cursor"); a click finishes
 * the line. The full text is laid out invisibly underneath so the dialog never jumps, and screen readers get it whole.
 */
function Typed({ text, as: Tag, id, className }: { text: string; as: 'p' | 'h2'; id?: string; className: string }) {
  const [n, setN] = useState(() => (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? text.length : 0));
  useEffect(() => {
    if (n >= text.length) return;
    const t = window.setTimeout(() => setN((v) => Math.min(text.length, v + 2)), 30);
    return () => window.clearTimeout(t);
  }, [n, text.length]);
  const done = n >= text.length;
  return (
    <Tag id={id} className={`${className} typed`} onClick={() => setN(text.length)}>
      <span className="sr-only">{text}</span>
      <span className="typed-ghost" aria-hidden="true">{text}</span>
      <span className="typed-shown" aria-hidden="true">{text.slice(0, n)}{!done && <i className="type-caret" />}</span>
    </Tag>
  );
}

const briefKey = (careerId: string, chapter: number) => `ms-brief-${careerId}-${chapter}`;
function wasBriefed(careerId: string, chapter: number): boolean {
  try {
    return localStorage.getItem(briefKey(careerId, chapter)) === '1';
  } catch {
    return false;
  }
}

/** Objectives pill under the desk tabs; opens a panel with live progress. */
export function StoryBar({ story, onBriefing }: { story: StoryView; onBriefing: () => void }) {
  const [open, setOpen] = useState(false);
  const done = story.objectives.filter((o) => o.met).length;
  return (
    <div className="mode-bar story-bar" data-tour="mode-bar">
      <button type="button" className="mode-pill" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <b>Chapter {story.chapter} · {story.title}</b>
        <span>{done} of {story.objectives.length} objectives</span>
      </button>
      <span className="mode-dates">{story.months}</span>
      <span className="rival-line" title="Jake Rivers, the hype trader, since the story began">
        You <b className={tone(story.rival.youPct)}>{formatPct(story.rival.youPct, 1)}</b> · Jake <b className={tone(story.rival.returnPct)}>{formatPct(story.rival.returnPct, 1)}</b>
      </span>
      <button type="button" className="text-button" onClick={onBriefing}>Briefing</button>
      {open && (
        <ul className="objective-panel">
          {story.objectives.map((o) => (
            <li key={o.id} className={o.met ? 'met' : ''}>
              <span className="tick" aria-hidden="true">{o.met ? '✓' : '○'}</span>
              <span>
                {o.label} {o.primary && <em className="primary-tag">Main goal</em>}
                <small>{o.progress}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface DialogProps {
  story: StoryView;
  careerId: string;
  date: string;
  busy: boolean;
  reply: string | null;
  briefingOpen: boolean;
  onBriefingClose: () => void;
  onAnswer: (checkpointId: string, choiceId: string) => void;
  onReplyDone: () => void;
  onExit: () => void;
  onNextChapter: () => void;
}

/** Briefing (start of chapter), checkpoint questions, Victor's replies and the debrief (story.md §2). */
export function StoryDialogs({ story, careerId, date, busy, reply, briefingOpen, onBriefingClose, onAnswer, onReplyDone, onExit, onNextChapter }: DialogProps) {
  const [autoBrief, setAutoBrief] = useState(() => date === story.start && !wasBriefed(careerId, story.chapter));
  const [debriefClosed, setDebriefClosed] = useState(false);

  const closeBriefing = () => {
    try {
      localStorage.setItem(briefKey(careerId, story.chapter), '1');
    } catch {
      /* storage blocked: the briefing just shows again next time */
    }
    setAutoBrief(false);
    onBriefingClose();
  };

  if (reply)
    return (
      <Modal className="reply-modal" label="reply-title">
        <div className="speaker"><span className="avatar" aria-hidden="true">V</span><div><b id="reply-title">Victor Hale</b><small>Retired fund manager, your neighbour</small></div></div>
        <Typed key={reply} as="p" className="dialogue" text={reply} />
        <button className="primary-button" type="button" onClick={onReplyDone}>Continue →</button>
      </Modal>
    );

  if (story.checkpoint)
    return (
      <Modal className="checkpoint-modal" label="cp-title">
        <p className="eyebrow">Checkpoint · the clock is paused</p>
        <div className="speaker"><span className="avatar" aria-hidden="true">V</span><div><b>Victor Hale</b><small>Has seen every kind of crash</small></div></div>
        <Typed key={story.checkpoint.prompt} as="h2" id="cp-title" className="dialogue" text={story.checkpoint.prompt} />
        <div className="choices">
          {story.checkpoint.choices.map((c) => (
            <button key={c.id} type="button" className="choice" disabled={busy} onClick={() => onAnswer(story.checkpoint!.id, c.id)}>
              {c.label}
            </button>
          ))}
        </div>
      </Modal>
    );

  if (story.debrief && !debriefClosed) {
    const d = story.debrief;
    return (
      <Modal className="debrief-modal" label="debrief-title" dismissable onClose={() => setDebriefClosed(true)}>
        <p className="eyebrow">Chapter {story.chapter} debrief · {story.title}</p>
        <div className="debrief-head">
          <span className={`grade grade-${d.grade}`} aria-label={`Grade ${d.grade}`}>{d.grade}</span>
          <h2 id="debrief-title">{d.headline}</h2>
        </div>
        <div className="debrief-stats">
          <span><small>Your return</small><b className={tone(d.youReturn)}>{formatPct(d.youReturn, 1)}</b></span>
          <span><small>{BREAKER_INDEX.name} index</small><b className={tone(d.indexReturn)}>{formatPct(d.indexReturn, 1)}</b></span>
          <span><small>Deepest fall</small><b>{formatPct(-d.maxDrawdown, 1)}</b></span>
        </div>
        <div className="debrief-lists">
          <div><h3>What went well</h3>{d.wentWell.length ? <ul>{d.wentWell.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">Nothing yet. That is what the next chapter is for.</p>}</div>
          <div><h3>To work on</h3>{d.toLearn.length ? <ul>{d.toLearn.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="muted">You hit every objective.</p>}</div>
        </div>
        <p className="cliffhanger">{d.cliffhanger}</p>
        {d.ending && (
          <section className="ending" aria-labelledby="ending-title">
            <p className="eyebrow">The end · after {d.ending.chapters} chapters</p>
            <h3 id="ending-title">{d.ending.title}</h3>
            {d.ending.epilogue.map((line) => <p key={line}>{line}</p>)}
          </section>
        )}
        <ol className="chapter-map" aria-label="Story chapters">
          {story.chapters.map((c, i) => (
            <li key={c.n} className={`ch-${c.status}`} style={{ ['--n' as string]: i }}>
              <span>{c.grade ?? c.n}</span>
              <small>{c.status === 'soon' ? 'Coming soon' : c.title}</small>
            </li>
          ))}
        </ol>
        {!d.nextAvailable && <p className="muted">Chapter {story.chapter + 1} is being written. Your career is saved and will continue when it opens.</p>}
        <div className="debrief-actions">
          <button className="secondary-button" type="button" onClick={() => setDebriefClosed(true)}>Look around</button>
          {d.nextAvailable ? (
            <button className="primary-button" type="button" disabled={busy} onClick={onNextChapter}>Start Chapter {story.chapter + 1} →</button>
          ) : (
            <button className="primary-button" type="button" onClick={onExit}>Back to menu</button>
          )}
        </div>
      </Modal>
    );
  }

  if (briefingOpen || autoBrief)
    return (
      <Modal className="briefing-modal" label="brief-title" dismissable onClose={closeBriefing}>
        <p className="eyebrow">Chapter {story.chapter} · {story.months}</p>
        <h2 id="brief-title">{story.title}</h2>
        {story.setup.map((p) => <p key={p} className="briefing-line">{p}</p>)}
        <h3>Objectives</h3>
        <ul className="objective-list">
          {story.objectives.map((o) => (
            <li key={o.id}>{o.label} {o.primary && <em className="primary-tag">Main goal</em>}</li>
          ))}
        </ul>
        <p className="muted">The chapter ends on {formatDate(story.end)}. Victor will stop the clock {story.checkpointCount === 2 ? 'twice' : `${story.checkpointCount} times`} to ask you something.</p>
        <button className="primary-button" type="button" onClick={closeBriefing}>{autoBrief ? 'Begin chapter →' : 'Back to the game'}</button>
      </Modal>
    );

  return null;
}
