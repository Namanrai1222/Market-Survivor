'use client';

// Funds & SIP desk: fictional mutual funds, next-day NAV orders, exit loads, SIPs with step-up, XIRR.
import { useMemo, useState } from 'react';
import type { CareerView } from '@ms/engine';
import { defaultConfig as cfg } from '@ms/engine';
import { FUNDS } from '@ms/content/desks';
import { formatDate, formatINR, formatPct, formatUnits, parseRupees, tone } from '@ms/ui/format';
import { useGame } from '@/store/game';
import { xirr } from '@/lib/xirr';
import { PriceChart } from '../stocks/PriceChart';
import { DeskHero, Fact } from './DeskHero';
import { Empty, HoldingRow, changeOf } from './shared';

const CATEGORY: Record<string, string> = { SURV50IDX: 'Index', LIGHTHOUSE: 'Large cap', MONSOON: 'Mid cap', SPARROW: 'Small cap', ANCHOR: 'Debt', INGOTFUND: 'Gold' };
const RISK: Record<string, string> = { SURV50IDX: 'High', LIGHTHOUSE: 'High', MONSOON: 'Very high', SPARROW: 'Very high', ANCHOR: 'Low to moderate', INGOTFUND: 'High' };

export function FundsDesk({ career }: { career: CareerView }) {
  const [fundId, setFundId] = useState(FUNDS[0]!.id);
  const fund = FUNDS.find((f) => f.id === fundId)!;
  const nav = career.prices[fund.id]!.c;
  const holding = career.positions.find((p) => p.instrumentId === fund.id);
  const holdings = career.positions.filter((p) => FUNDS.some((f) => f.id === p.instrumentId));

  const invested = holdings.reduce((a, p) => a + p.valuePaise, 0);
  const sips = career.sips.filter((s) => s.active);
  return (
    <>
      <DeskHero desk="FUNDS" eyebrow="Mutual funds" title="Funds & SIP" lead="Let a fund own dozens of companies for you. Invest a lump sum, or a little every month with a SIP, and let time do the work.">
        <Fact label="In funds" value={formatINR(invested, 0)} />
        <Fact label="SIPs running" value={sips.length ? `${sips.length} · ${formatINR(sips.reduce((a, s) => a + s.amountPaise, 0), 0)}/mo` : 'None'} />
        <Fact label="Index fund today" value={formatPct(changeOf(career, 'SURV50IDX'))} tone={tone(changeOf(career, 'SURV50IDX'))} />
      </DeskHero>
      <section className="fund-grid">
        {FUNDS.map((f) => {
          const d = changeOf(career, f.id);
          const mine = career.positions.find((p) => p.instrumentId === f.id);
          return (
            <button key={f.id} type="button" className={`fund-card panel ${fundId === f.id ? 'selected' : ''}`} onClick={() => setFundId(f.id)}>
              <span className="fund-cat">{CATEGORY[f.id]}</span>
              <strong>{f.name}</strong>
              <span className="fund-nav">NAV {formatINR(career.prices[f.id]!.c)} <b className={tone(d)}>{formatPct(d)}</b></span>
              <small>{f.expensePct}% a year · {f.exitLoadPct ? `${f.exitLoadPct}% exit load within ${f.exitLoadDays} days` : 'no exit load'}</small>
              {mine && <em className="tag">You hold {formatINR(mine.valuePaise, 0)}</em>}
            </button>
          );
        })}
      </section>

      <div className="desk-two-col">
        <section className="quote-panel panel">
          <div className="quote-heading">
            <div><p className="eyebrow">{CATEGORY[fund.id]} fund · risk {RISK[fund.id]}</p><h1>{fund.name}</h1><span>{fund.blurb}</span></div>
            <div className="hero-price"><strong>{formatINR(nav)}</strong><span className="muted">NAV per unit</span></div>
          </div>
          <PriceChart careerId={career.id} instrumentId={fund.id} symbol={fund.symbol} stateVersion={career.stateVersion} />
          <p className="muted small">Fund orders never use today’s NAV: they fill at the next trading day’s closing NAV, so nobody can trade on news that already happened. Redemptions arrive in Available {cfg.funds.redemptionDays} trading days later.</p>
        </section>
        <aside className="fund-actions">
          <FundTicket career={career} fundId={fund.id} heldUnits={holding?.qty ?? 0} />
          <SipForm career={career} fundId={fund.id} />
        </aside>
      </div>

      <div className="desk-two-col">
        <section className="panel desk-list">
          <div className="panel-title-row"><div><p className="eyebrow">Your funds</p><h2>Holdings</h2></div></div>
          {holdings.length ? <div className="data-table">{holdings.map((p) => <HoldingRow key={p.key} career={career} p={p} onSelect={() => setFundId(p.instrumentId)} extra={<FundXirr career={career} fundId={p.instrumentId} value={p.valuePaise} />} />)}</div> : <Empty>No funds yet. Invest a lump sum or start a SIP.</Empty>}
        </section>
        <section className="panel desk-list">
          <div className="panel-title-row"><div><p className="eyebrow">Monthly investing</p><h2>SIPs and orders</h2></div></div>
          <SipList career={career} />
          <FundOrders career={career} />
        </section>
      </div>
    </>
  );
}

function FundXirr({ career, fundId, value }: { career: CareerView; fundId: string; value: number }) {
  const r = useMemo(() => {
    const flows = career.fundOrders
      .filter((o) => o.fundId === fundId && o.status === 'DONE' && o.doneDate)
      .map((o) => ({ date: o.doneDate!, amount: o.side === 'BUY' ? -Math.round((o.units / 1000) * o.navPaise!) : Math.round((o.units / 1000) * o.navPaise!) - o.exitLoadPaise }));
    return xirr([...flows, { date: career.date, amount: value }]);
  }, [career.fundOrders, career.date, fundId, value]);
  return r === null ? null : <> · XIRR <b className={tone(r)}>{formatPct(r, 1)}</b></>;
}

function FundTicket({ career, fundId, heldUnits }: { career: CareerView; fundId: string; heldUnits: number }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('25000');
  const [units, setUnits] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const pending = career.fundOrders.filter((o) => o.status === 'PENDING' && o.side === 'SELL' && o.fundId === fundId).reduce((a, o) => a + o.units, 0);
  const free = heldUnits - pending;
  const paise = parseRupees(amount) ?? 0;
  const u = Math.floor(Number(units) * 1000 + 1e-9);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(null);
    const r = side === 'BUY' ? await act({ kind: 'FUND_BUY', fundId, amountPaise: paise }) : await act({ kind: 'FUND_REDEEM', fundId, units: u });
    if (r) setDone(side === 'BUY' ? `${formatINR(paise)} blocked. Units are bought at the next trading day’s NAV.` : 'Redemption placed. It goes through at the next trading day’s NAV.');
  }

  return (
    <form className="panel order-panel" onSubmit={submit}>
      <div className="panel-title-row"><div><p className="eyebrow">Lump sum</p><h2>{side === 'BUY' ? 'Invest' : 'Redeem'}</h2></div></div>
      <div className="side-toggle" role="group" aria-label="Side">
        <button type="button" className={side === 'BUY' ? 'buy active' : ''} onClick={() => setSide('BUY')}>Invest</button>
        <button type="button" className={side === 'SELL' ? 'sell active' : ''} onClick={() => setSide('SELL')}>Redeem</button>
      </div>
      {side === 'BUY' ? (
        <label>Amount (₹)<input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /><small>Minimum {formatINR(cfg.sip.minPaise, 0)} · available {formatINR(career.treasury.availablePaise, 0)}</small></label>
      ) : (
        <label>Units<input value={units} inputMode="decimal" onChange={(e) => setUnits(e.target.value)} placeholder="0.000" /><small>You can redeem {formatUnits(free, 1000)} units {free > 0 && <button type="button" className="text-button inline" onClick={() => setUnits(String(free / 1000))}>All</button>}</small></label>
      )}
      <button className={`place-button ${side === 'BUY' ? 'buy' : 'sell'}`} type="submit" disabled={busy || (side === 'BUY' ? paise < cfg.sip.minPaise : u < 1)}>{busy ? 'Working…' : side === 'BUY' ? 'Place investment' : 'Place redemption'}</button>
      {done && <p className="success-message" role="status">✓ {done}</p>}
    </form>
  );
}

function SipForm({ career, fundId }: { career: CareerView; fundId: string }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const [amount, setAmount] = useState('10000');
  const [day, setDay] = useState('5');
  const [step, setStep] = useState('10');
  const [done, setDone] = useState<string | null>(null);
  const paise = parseRupees(amount) ?? 0;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(null);
    const r = await act({ kind: 'SIP_START', fundId, amountPaise: paise, dayOfMonth: Number(day), stepUpPct: Number(step) });
    if (r) setDone(`SIP started: ${formatINR(paise, 0)} on day ${day} of every month.`);
  }
  return (
    <form className="panel order-panel" onSubmit={submit}>
      <div className="panel-title-row"><div><p className="eyebrow">Systematic investment plan</p><h2>Start a SIP</h2></div></div>
      <label>Every month (₹)<input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} /></label>
      <div className="form-row">
        <label>On day<select value={day} onChange={(e) => setDay(e.target.value)}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
        <label>Raise yearly by<select value={step} onChange={(e) => setStep(e.target.value)}>{[0, 5, 10, 15, 20].map((v) => <option key={v} value={v}>{v}%</option>)}</select></label>
      </div>
      <small className="muted">If cash is short on the day, that month is skipped (you get a warning). Buying every month means you buy more units when prices are low.</small>
      <button className="place-button buy" type="submit" disabled={busy || paise < cfg.sip.minPaise || career.ended}>Start SIP</button>
      {done && <p className="success-message" role="status">✓ {done}</p>}
    </form>
  );
}

function SipList({ career }: { career: CareerView }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const sips = career.sips.filter((s) => s.active);
  if (!sips.length) return <Empty>No SIPs running.</Empty>;
  return (
    <div className="data-table">
      {sips.map((s) => (
        <div key={s.id} className="holding-row">
          <span><b>{formatINR(s.amountPaise, 0)} a month → {FUNDS.find((f) => f.id === s.fundId)?.name}</b><small>Next on {formatDate(s.nextDate)} · {s.installments} paid{s.skipped ? ` · ${s.skipped} skipped` : ''}{s.stepUpPct ? ` · +${s.stepUpPct}% each year` : ''}</small></span>
          <span><button className="text-button" type="button" disabled={busy} onClick={() => void act({ kind: 'SIP_STOP', sipId: s.id })}>Stop</button></span>
        </div>
      ))}
    </div>
  );
}

function FundOrders({ career }: { career: CareerView }) {
  const act = useGame((s) => s.act);
  const busy = useGame((s) => s.busy);
  const orders = [...career.fundOrders].reverse().slice(0, 12);
  if (!orders.length) return null;
  return (
    <div className="data-table">
      {orders.map((o) => {
        const f = FUNDS.find((x) => x.id === o.fundId);
        return (
          <div key={o.id} className="holding-row">
            <span>
              <b>{o.side === 'BUY' ? `${o.sipId ? 'SIP' : 'Invest'} ${formatINR(o.amountPaise, 0)}` : `Redeem ${formatUnits(o.units, 1000)} units`} · {f?.symbol}</b>
              <small>{o.status === 'PENDING' ? `Placed ${formatDate(o.placedDate)} · fills at the next NAV` : o.status === 'DONE' ? `${formatUnits(o.units, 1000)} units at ${formatINR(o.navPaise!)} on ${formatDate(o.doneDate!)}${o.exitLoadPaise ? ` · exit load ${formatINR(o.exitLoadPaise)}` : ''}` : 'Cancelled'}</small>
            </span>
            <span>{o.status === 'PENDING' ? <button className="text-button" type="button" disabled={busy} onClick={() => void act({ kind: 'FUND_CANCEL', orderId: o.id })}>Cancel</button> : <em className={`status status-${o.status === 'DONE' ? 'filled' : 'cancelled'}`}>{o.status === 'DONE' ? 'Done' : 'Cancelled'}</em>}</span>
          </div>
        );
      })}
    </div>
  );
}
