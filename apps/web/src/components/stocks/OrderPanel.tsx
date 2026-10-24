'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CareerView, Instrument, OrderType, Side } from '@ms/engine';
import { defaultConfig, equityCharges } from '@ms/engine';
import { formatINR, parseRupees } from '@ms/ui/format';
import { useGame } from '@/store/game';

export function OrderPanel({ career, instrument }: { career: CareerView; instrument: Instrument }) {
  const [side, setSide] = useState<Side>('BUY');
  const [type, setType] = useState<OrderType>('MARKET');
  const [qty, setQty] = useState('1');
  const [limit, setLimit] = useState('');
  const [trigger, setTrigger] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const placeOrder = useGame((s) => s.placeOrder);
  const busy = useGame((s) => s.busy);
  const price = career.prices[instrument.id]?.c ?? instrument.startPricePaise;
  const quantity = Number(qty);
  const value = Number.isInteger(quantity) && quantity > 0 ? price * quantity : 0;
  const charges = useMemo(() => equityCharges(side, value, defaultConfig.charges), [side, value]);
  const total = side === 'BUY' ? value + charges.total : value - charges.total;
  const position = career.positions.find((p) => p.instrumentId === instrument.id);
  const qtyInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const halted = career.halt !== null;

  function startTicket(next: Side) {
    setSide(next);
    panel.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    qtyInput.current?.focus({ preventScroll: true });
    qtyInput.current?.select();
  }

  // Keyboard play (design.md §12): B = buy, S = sell, both jump to the quantity field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      const k = event.key.toLowerCase();
      if (k !== 'b' && k !== 's') return;
      event.preventDefault();
      setSide(k === 'b' ? 'BUY' : 'SELL');
      qtyInput.current?.focus();
      qtyInput.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSuccess(null);
    const limitPaise = limit ? parseRupees(limit) : null;
    const triggerPaise = trigger ? parseRupees(trigger) : null;
    try {
      await placeOrder({
        desk: 'STOCKS', instrumentId: instrument.id, side, type, qty: quantity,
        limitPaise: type === 'LIMIT' || type === 'SL' ? limitPaise : null,
        triggerPaise: type === 'SL' || type === 'SL-M' ? triggerPaise : null,
      });
      setSuccess(`${side === 'BUY' ? 'Buy' : 'Sell'} order placed. It can fill on the next trading day.`);
    } catch {
      // The shared error banner explains the server validation failure.
    }
  }

  return (
    <aside className="order-panel panel" ref={panel} data-tour="order-ticket">
      <div className="panel-title-row"><div><p className="eyebrow">Order ticket</p><h2>{instrument.symbol}</h2></div><strong>{formatINR(price)}</strong></div>
      <div className="side-toggle" role="group" aria-label="Order side">
        <button className={side === 'BUY' ? 'buy active' : ''} onClick={() => setSide('BUY')} type="button">Buy</button>
        <button className={side === 'SELL' ? 'sell active' : ''} onClick={() => setSide('SELL')} type="button">Sell</button>
      </div>
      <form onSubmit={submit}>
        <label>Order type
          <select value={type} onChange={(e) => setType(e.target.value as OrderType)}>
            <option value="MARKET">Market</option><option value="LIMIT">Limit</option><option value="SL">Stop-limit</option><option value="SL-M">Stop-market</option>
          </select>
        </label>
        <label>Quantity
          <input ref={qtyInput} value={qty} inputMode="numeric" onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} aria-describedby="holding-hint" />
          <small id="holding-hint">Held: {position?.qty ?? 0} shares · press B or S to jump here</small>
        </label>
        {(type === 'LIMIT' || type === 'SL') && <label>Limit price (₹)<input value={limit} inputMode="decimal" onChange={(e) => setLimit(e.target.value)} placeholder={(price / 100).toFixed(2)} /></label>}
        {(type === 'SL' || type === 'SL-M') && <label>Trigger price (₹)<input value={trigger} inputMode="decimal" onChange={(e) => setTrigger(e.target.value)} placeholder={(price / 100).toFixed(2)} /></label>}
        <div className="estimate-box">
          <span>Estimated value <b>{formatINR(value)}</b></span>
          <span>Charges <b>{formatINR(charges.total)}</b></span>
          <span className="estimate-total">{side === 'BUY' ? 'Estimated debit' : 'Estimated proceeds'} <b>{formatINR(total)}</b></span>
          <span className="from-available">From available <b>{formatINR(career.treasury.availablePaise)}</b></span>
          <small>{side === 'BUY' ? 'Cash is blocked now and the order fills on the next trading day.' : 'Proceeds arrive in Available one trading day after the sale (T+1).'} Final price and charges are set when it fills.</small>
        </div>
        <button className={`place-button ${side.toLowerCase()}`} disabled={busy || !value || halted} type="submit">{busy ? 'Working…' : `Place ${side.toLowerCase()}`}</button>
        {halted && <p className="halt-note" role="note">Trading is paused by the circuit breaker. Continue to the next trading day to place orders.</p>}
        {success && <p className="success-message" role="status">✓ {success}</p>}
      </form>
      {/* Mobile: sticky Buy / Sell that jump to the ticket (design.md §4.5). */}
      <div className="mobile-trade-bar">
        <button className="place-button buy" type="button" disabled={halted} onClick={() => startTicket('BUY')}>Buy {instrument.symbol}</button>
        <button className="place-button sell" type="button" disabled={halted} onClick={() => startTicket('SELL')}>Sell</button>
      </div>
    </aside>
  );
}
