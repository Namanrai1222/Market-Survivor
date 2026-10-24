'use client';

// Fixed income desk: central-bank rates, fixed deposits and government bonds (market-engine.md §5.2).
import { useState } from 'react';
import type { CareerView } from '@ms/engine';
import { defaultConfig as cfg, fdGrowth } from '@ms/engine';
import { BONDS } from '@ms/content/desks';
import { formatDate, formatINR, formatPct, formatSignedINR, parseRupees, tone } from '@ms/ui/format';
import { useGame } from '@/store/game';
import { PriceChart } from '../stocks/PriceChart';
import { DeskHero, Fact } from './DeskHero';
import { DeskFills, Empty, HoldingRow, InstantTicket, changeOf } from './shared';

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function FixedIncomeDesk({ career }: { career: CareerView }) {
  const [bondId, setBondId] = useState(BONDS[0]!.id);
  const bond = BONDS.find((b) => b.id === bondId)!;
  const m = career.macro;
  const held = career.positions.find((p) => p.instrumentId === bond.id)?.qty ?? 0;
  const bondHoldings = career.positions.filter((p) => BONDS.some((b) => b.id === p.instrumentId));
  const inFds = career.fds.filter((f) => f.status === 'ACTIVE').reduce((a, f) => a + (f.valuePaise ?? 0), 0);
  return (
    <>
      <DeskHero desk="FIXED_INCOME" eyebrow="Rates and safety" title="Fixed income" lead="Lend your money for a fixed return. Deposits never fall in value; bonds rise when rates fall and drop when they rise.">
        <Fact label="Policy rate" value={`${m.policyRate.toFixed(2)}%`} />
        <Fact label="10-year yield" value={`${m.yields.y10.toFixed(2)}%`} />
        <Fact label="In deposits" value={formatINR(inFds, 0)} />
      </DeskHero>
      <section className="rates-strip panel" aria-label="Interest rates">
        <div><small>Policy rate</small><strong>{m.policyRate.toFixed(2)}%</strong><span className="muted">{m.lastPolicy ? `${m.lastPolicy.change > 0 ? 'Raised' : m.lastPolicy.change < 0 ? 'Cut' : 'Held'} on ${formatDate(m.lastPolicy.date)}` : 'No change yet'}</span></div>
        <div><small>Next policy meeting</small><strong>{formatDate(m.nextPolicyMeeting)}</strong><span className="muted">Inflation up → hikes; crashes → cuts</span></div>
        <div><small>3-year bond yield</small><strong>{m.yields.y3.toFixed(2)}%</strong></div>
        <div><small>10-year bond yield</small><strong>{m.yields.y10.toFixed(2)}%</strong></div>
        <div><small>Inflation index</small><strong>{((career.cpiIndex - 1) * 100).toFixed(1)}%</strong><span className="muted">since you started</span></div>
      </section>

      <div className="desk-two-col">
        <FdPanel career={career} />
        <section className="panel desk-list">
          <div className="panel-title-row"><div><p className="eyebrow">Your deposits</p><h2>Fixed deposits</h2></div></div>
          <FdList career={career} />
        </section>
      </div>

      <div className="terminal-grid bonds-grid">
        <aside className="watchlist panel">
          <div className="watchlist-heading"><div><p className="eyebrow">Government bonds</p><h2>Bonds</h2></div><span>{BONDS.length}</span></div>
          <p className="desk-lead">When rates rise, existing bonds fall in price. The longer the bond, the bigger the move (that’s “duration”).</p>
          <div className="stock-list">
            {BONDS.map((b) => {
              const d = changeOf(career, b.id);
              const dur = b.pricing?.kind === 'DURATION' ? b.pricing.duration : 0;
              return (
                <button key={b.id} className={bondId === b.id ? 'selected' : ''} onClick={() => setBondId(b.id)}>
                  <span><strong>{b.name}</strong><small>Duration {dur} · yield {(b.pricing?.kind === 'DURATION' ? m.yields[b.pricing.curve] : 0).toFixed(2)}%</small></span>
                  <span><b>{formatINR(career.prices[b.id]!.c)}</b><small className={tone(d)}>{formatPct(d)}</small></span>
                </button>
              );
            })}
          </div>
        </aside>
        <main className="stock-detail">
          <section className="quote-panel panel">
            <div className="quote-heading"><div><p className="eyebrow">Government of the game world</p><h1>{bond.name}</h1><span>{bond.blurb}</span></div><div className="hero-price"><strong>{formatINR(career.prices[bond.id]!.c)}</strong><span className="muted">per ₹100 bond</span></div></div>
            <PriceChart careerId={career.id} instrumentId={bond.id} symbol={bond.symbol} stateVersion={career.stateVersion} />
          </section>
          <section className="panel desk-list">
            <div className="panel-title-row"><div><p className="eyebrow">Bond holdings</p><h2>Your bonds</h2></div></div>
            {bondHoldings.length ? <div className="data-table">{bondHoldings.map((p) => <HoldingRow key={p.key} career={career} p={p} onSelect={() => setBondId(p.instrumentId)} />)}</div> : <Empty>No bonds yet.</Empty>}
            <DeskFills career={career} desk="FIXED_INCOME" />
          </section>
        </main>
        <InstantTicket key={bond.id} career={career} inst={bond} held={held} />
      </div>
    </>
  );
}

function FdPanel({ career }: { career: CareerView }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const [tenorId, setTenorId] = useState('1Y');
  const [amount, setAmount] = useState('100000');
  const [done, setDone] = useState<string | null>(null);
  const tenor = cfg.fixedIncome.fdTenors.find((t) => t.id === tenorId)!;
  const rate = Math.max(1, Math.round((career.macro.policyRate + tenor.spreadPct) * 100) / 100);
  const paise = parseRupees(amount) ?? 0;
  const atMaturity = paise ? fdGrowth(paise, rate, tenor.days) : 0;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(null);
    const r = await act({ kind: 'FD_BOOK', tenorId, amountPaise: paise });
    if (r) setDone(`Deposit booked at ${rate.toFixed(2)}% for ${tenor.label}.`);
  }
  return (
    <form className="panel order-panel" onSubmit={submit}>
      <div className="panel-title-row"><div><p className="eyebrow">Safe and boring</p><h2>Book a fixed deposit</h2></div></div>
      <div className="tenor-grid" role="radiogroup" aria-label="Deposit term">
        {cfg.fixedIncome.fdTenors.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={tenorId === t.id} className={tenorId === t.id ? 'active' : ''} onClick={() => setTenorId(t.id)}>
            <b>{t.label}</b><small>{Math.max(1, career.macro.policyRate + t.spreadPct).toFixed(2)}%</small>
          </button>
        ))}
      </div>
      <label>Amount (₹)<input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /><small>Minimum {formatINR(cfg.fixedIncome.fdMinPaise, 0)} · available {formatINR(career.treasury.availablePaise, 0)}</small></label>
      <div className="estimate-box">
        <span>Rate (locked for the whole term) <b>{rate.toFixed(2)}%</b></span>
        <span className="estimate-total">At maturity <b>{formatINR(atMaturity, 0)}</b></span>
        <small>Interest compounds every quarter and is paid at the end. Breaking early pays {cfg.fees.fdEarlyBreakPenaltyPct}% less interest. A deposit can’t fall in value, but inflation can still eat it.</small>
      </div>
      <button className="place-button buy" type="submit" disabled={busy || paise < cfg.fixedIncome.fdMinPaise}>Book deposit</button>
      {done && <p className="success-message" role="status">✓ {done}</p>}
    </form>
  );
}

function FdList({ career }: { career: CareerView }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  if (!career.fds.length) return <Empty>No deposits yet.</Empty>;
  return (
    <div className="data-table">
      {[...career.fds].sort((a, b) => (a.status === 'ACTIVE' ? -1 : 1) - (b.status === 'ACTIVE' ? -1 : 1)).map((fd) => {
        const interest = (fd.valuePaise ?? 0) - fd.principalPaise;
        const total = daysBetween(fd.startDate, fd.maturityDate);
        const elapsed = Math.min(total, daysBetween(fd.startDate, career.date));
        return (
          <div key={fd.id} className="holding-row">
            <span>
              <b>{formatINR(fd.principalPaise, 0)} at {fd.ratePct.toFixed(2)}%</b>
              <small>{fd.status === 'ACTIVE' ? `Matures ${formatDate(fd.maturityDate)} · ${Math.round((elapsed / total) * 100)}% of the term done` : fd.status === 'MATURED' ? `Matured ${formatDate(fd.closedDate!)}` : `Broken early on ${formatDate(fd.closedDate!)}`}</small>
              {fd.status === 'ACTIVE' && <i className="term-bar"><i style={{ width: `${(elapsed / total) * 100}%` }} /></i>}
            </span>
            <span>
              {formatINR(fd.valuePaise ?? 0)}
              <small className={fd.status === 'ACTIVE' ? 'up' : 'flat'}>{fd.status === 'ACTIVE' ? `${formatSignedINR(interest)} interest so far` : `paid ${formatINR(fd.paidPaise ?? 0)}`}</small>
              {fd.status === 'ACTIVE' && <button className="text-button" type="button" disabled={busy} onClick={() => { if (window.confirm(`Break this deposit early? You get ${cfg.fees.fdEarlyBreakPenaltyPct}% less interest.`)) void act({ kind: 'FD_BREAK', fdId: fd.id }); }}>Break early</button>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
