// Delivery equity charges (contract note). Each component rounded half-up to the paisa;
// GST applies to brokerage + exchange + regulator fee. Safe to import on the client for previews.
import type { MarketConfig } from '../../config';
import { applyRate, pctToE7 } from '../../money';
import type { ChargeBreakdown, Side } from '../../types';

export function equityCharges(side: Side, turnoverPaise: number, c: MarketConfig['charges']): ChargeBreakdown {
  const brokerage = c.brokeragePaise;
  const stt = applyRate(turnoverPaise, pctToE7(c.sttPct));
  const exchange = applyRate(turnoverPaise, pctToE7(c.exchangePct));
  const regulator = applyRate(turnoverPaise, pctToE7(c.regulatorPct));
  const stamp = side === 'BUY' ? applyRate(turnoverPaise, pctToE7(c.stampBuyPct)) : 0;
  const gst = applyRate(brokerage + exchange + regulator, pctToE7(c.gstPct));
  return { brokerage, stt, exchange, regulator, stamp, gst, total: brokerage + stt + exchange + regulator + stamp + gst };
}
