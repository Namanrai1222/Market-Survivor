// What the client may see. Explicit allowlist: new hidden fields (seed, pending shocks,
// factor levels, future story data) stay server-side unless deliberately added here.
import { netWorth, realNetWorth } from './career';
import { positionValue } from './desks/common';
import { fdValue } from './desks/fixed';
import { forecastValue, priceYes } from './desks/forecast';
import type { CareerState } from './types';
import { nextPolicyMeeting } from './world/factors';

const RECENT = 50;

export function toPublicView(s: CareerState) {
  const t = s.treasury;
  const open = s.orders.filter((o) => o.status === 'OPEN');
  const closed = s.orders.filter((o) => o.status !== 'OPEN').slice(-RECENT);
  return {
    id: s.id,
    slot: s.slot,
    type: s.type,
    difficulty: s.difficulty,
    startDate: s.startDate,
    baseline: s.baseline,
    date: s.date,
    stateVersion: s.stateVersion,
    chapter: s.chapter,
    label: s.label,
    endDate: s.endDate,
    ended: s.ended,
    maxDrawdown: s.maxDrawdown,
    unlockedDesks: s.unlockedDesks,
    regime: s.world.regime,
    halt: s.world.halt,
    cpiIndex: s.world.cpiIndex,
    // Market prices anyone could see. Factor levels, pending shocks and the exchange's hidden
    // resolution date and recovery stay server-side.
    macro: {
      usdInr: s.world.usdInr,
      policyRate: s.world.policyRate,
      yields: s.world.yields,
      lastPolicy: s.world.lastPolicy,
      nextPolicyMeeting: nextPolicyMeeting(s.date),
      exchange: { status: s.world.exchange.status, since: s.world.exchange.since, recoveryPct: s.world.exchange.status === 'RESOLVED' ? s.world.exchange.recoveryPct : null },
      rugged: s.world.rugged,
    },
    treasury: {
      availablePaise: t.available,
      blockedPaise: t.blocked,
      unsettledPaise: t.unsettled,
      unsettledItems: t.unsettledItems,
    },
    netWorthPaise: netWorth(s),
    netWorthPrevPaise: s.netWorthPrevPaise,
    netWorthPeakPaise: s.netWorthPeakPaise,
    realNetWorthPaise: realNetWorth(s),
    prices: s.prices,
    indices: s.indices,
    positions: Object.entries(s.positions).map(([key, p]) => ({ ...p, key, valuePaise: positionValue(s, p) })),
    ipos: Object.values(s.ipos),
    fundOrders: s.fundOrders,
    sips: s.sips,
    fds: s.fds.map((fd) => ({ ...fd, valuePaise: fd.status === 'ACTIVE' ? fdValue(fd, s.date) : fd.paidPaise })),
    forecasts: s.forecasts.map((f) => ({ ...f, priceYes: priceYes(f), valuePaise: forecastValue(f) })),
    transfers: s.transfers,
    deskFills: s.deskFills.slice(-RECENT),
    orders: [...closed, ...open],
    fills: s.fills.slice(-RECENT),
    ledger: t.ledger.slice(-100),
  };
}

export type CareerView = ReturnType<typeof toPublicView>;

/** Summary for the career slot picker. */
export function toCareerSummary(s: CareerState) {
  return { id: s.id, slot: s.slot, type: s.type, difficulty: s.difficulty, date: s.date, chapter: s.chapter, label: s.label, ended: s.ended, netWorthPaise: netWorth(s) };
}
export type CareerSummary = ReturnType<typeof toCareerSummary>;
