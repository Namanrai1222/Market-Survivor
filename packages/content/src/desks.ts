// Instruments for every desk beyond India stocks (prd.md §6.2, market-engine.md §5.1–5.2).
// Public data: safe for the client bundle. Everything here is FICTIONAL (legal review L-01/L-02):
// the funds, ETFs, bonds, US companies, coins and IPO companies are invented for the game.
import type { FactorVector, Instrument, IpoDef, Sector } from '@ms/engine';

// Order: GR DG PR INF OIL FX GPR CRD CRY LIQ
const sector = (id: string, name: string, loadings: FactorVector, alphaPct: number, idioVolPct: number): Sector => ({ id, name, loadings, alphaPct, idioVolPct });
const scale = (v: FactorVector, k: number): FactorVector => v.map((x) => Math.round(x * k * 100) / 100);
const BROAD: FactorVector = [1.0, 0.8, -0.4, -0.3, -0.3, -0.3, -0.4, -0.4, 0, 0.6];

/** Loadings for non-stock instruments. USD-quoted ones carry no FX loading: conversion adds it. */
export const DESK_SECTORS: Record<string, Sector> = Object.fromEntries(
  [
    sector('FUND_LARGE', 'Large-cap equity', BROAD, 12, 3),
    sector('FUND_MID', 'Mid-cap equity', scale(BROAD, 1.25), 14, 6),
    sector('FUND_SMALL', 'Small-cap equity', scale(BROAD, 1.5), 15, 9),
    sector('GOLD', 'Gold', [-0.3, -0.1, -0.6, 0.5, 0.2, 1.0, 0.9, 0.6, 0, -0.2], 8, 12),
    sector('SILVER', 'Silver', [0.2, 0.2, -0.5, 0.5, 0.2, 1.0, 0.6, 0.3, 0, 0.2], 7, 22),
    sector('CRUDE', 'Crude oil', [0.4, 0.2, -0.1, 0.3, 1.0, 1.0, 0.5, -0.1, 0, 0.3], 3, 28),
    sector('BOND', 'Government bonds', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0, 0),
    sector('US_BROAD', 'US large caps', [1.1, 0, -0.2, 0, -0.2, 0, -0.3, -0.3, 0, 0.7], 10, 4),
    sector('US_TECH', 'US technology', [1.3, 0, -0.4, 0, -0.1, 0, -0.3, -0.3, 0.1, 0.9], 14, 26),
    sector('US_CHIPS', 'US semiconductors', [1.5, 0, -0.4, 0, -0.1, 0, -0.5, -0.3, 0.1, 1.0], 16, 40),
    sector('US_CONSUMER', 'US online retail', [1.1, 0, -0.3, -0.2, -0.3, 0, -0.2, -0.3, 0, 0.7], 12, 26),
    sector('US_EV', 'US electric vehicles', [1.6, 0, -0.5, 0, -0.3, 0, -0.3, -0.4, 0.2, 1.1], 12, 50),
    sector('CRYPTO_MAJOR', 'Large coin', [1.4, 0, -0.8, 0, 0, 0, -0.2, -0.3, 1.2, 1.3], 10, 45),
    sector('CRYPTO_ALT', 'Smart-contract coin', [1.8, 0, -1.0, 0, 0, 0, -0.3, -0.3, 1.6, 1.6], 8, 65),
    sector('CRYPTO_MEME', 'Meme coin', [2.0, 0, -1.0, 0, 0, 0, -0.3, -0.3, 2.2, 1.8], 0, 110),
    sector('STABLE', 'Stablecoin', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0, 0),
  ].map((s) => [s.id, s]),
);

type Extra = Partial<Instrument>;
const inst = (desk: Instrument['desk'], market: Instrument['market'], id: string, name: string, sectorId: string, start: number, extra: Extra = {}): Instrument => ({
  id,
  symbol: id,
  name,
  desk,
  market,
  sector: sectorId,
  startPricePaise: Math.round(start * 100),
  indexWeight: 0,
  advPaise: 5e10,
  real: false,
  ...extra,
});

export const FUNDS: Instrument[] = [
  inst('FUNDS', 'IN', 'SURV50IDX', 'Survivor 50 Index Fund', 'FUND_LARGE', 100, { unitScale: 1000, pricing: { kind: 'INDEX', indexId: 'MS50' }, expensePct: 0.2, exitLoadPct: 0, exitLoadDays: 0, blurb: 'Owns the whole Survivor 50 index. Lowest cost; matches the market, never beats it.' }),
  inst('FUNDS', 'IN', 'LIGHTHOUSE', 'Lighthouse Large Cap Fund', 'FUND_LARGE', 250, { unitScale: 1000, expensePct: 1.0, exitLoadPct: 1, exitLoadDays: 365, blurb: 'A manager picks about 50 big companies. Higher fees than the index fund.' }),
  inst('FUNDS', 'IN', 'MONSOON', 'Monsoon Mid Cap Fund', 'FUND_MID', 80, { unitScale: 1000, expensePct: 1.2, exitLoadPct: 1, exitLoadDays: 365, blurb: 'Medium-sized companies: more growth, bigger swings.' }),
  inst('FUNDS', 'IN', 'SPARROW', 'Sparrow Small Cap Fund', 'FUND_SMALL', 45, { unitScale: 1000, expensePct: 1.5, exitLoadPct: 1, exitLoadDays: 365, blurb: 'Small companies. The best long-run returns and the worst crashes.' }),
  inst('FUNDS', 'IN', 'ANCHOR', 'Anchor Short Duration Debt Fund', 'BOND', 30, { unitScale: 1000, pricing: { kind: 'DURATION', duration: 2, curve: 'y3' }, expensePct: 0.4, exitLoadPct: 0.25, exitLoadDays: 30, blurb: 'Lends to the government and safe companies. Steady, small, rate-sensitive returns.' }),
  inst('FUNDS', 'IN', 'INGOTFUND', 'Ingot Gold Fund', 'GOLD', 20, { unitScale: 1000, expensePct: 0.5, exitLoadPct: 1, exitLoadDays: 365, blurb: 'Tracks gold in rupees. Tends to rise when the world gets scary.' }),
];

export const COMMODITIES: Instrument[] = [
  inst('COMMODITIES', 'IN', 'INGOT', 'Ingot Gold ETF', 'GOLD', 75, { expensePct: 0.5, blurb: 'Gold priced in rupees. Driven by fear, real interest rates and a weak rupee.' }),
  inst('COMMODITIES', 'IN', 'ARGENT', 'Argent Silver ETF', 'SILVER', 95, { expensePct: 0.5, blurb: 'Half precious metal, half industrial metal: swings more than gold.' }),
  inst('COMMODITIES', 'IN', 'BARREL', 'Barrel Crude Oil Fund', 'CRUDE', 40, { expensePct: 0.8, blurb: 'Follows crude oil in rupees. Jumps on wars and supply cuts, falls in recessions.' }),
];

export const BONDS: Instrument[] = [
  inst('FIXED_INCOME', 'IN', 'GB2033', 'Government Bond 2033', 'BOND', 100, { pricing: { kind: 'DURATION', duration: 2.8, curve: 'y3' }, blurb: '3-year government bond. Small price moves when rates change.' }),
  inst('FIXED_INCOME', 'IN', 'GB2040', 'Government Bond 2040', 'BOND', 100, { pricing: { kind: 'DURATION', duration: 7.6, curve: 'y10' }, blurb: '10-year government bond. Rises a lot when rates fall, drops when they rise.' }),
];

export const GLOBAL: Instrument[] = [
  inst('GLOBAL', 'US', 'FRONT500', 'Frontier 500 Index ETF', 'US_BROAD', 550, { quote: 'USD', expensePct: 0.05, blurb: 'The 500 biggest US companies in one fund.' }),
  inst('GLOBAL', 'US', 'ORCHARD', 'Orchard Devices', 'US_TECH', 210, { quote: 'USD', blurb: 'Phones, laptops and an app store with a billion users.' }),
  inst('GLOBAL', 'US', 'SKYVAULT', 'Skyvault Software', 'US_TECH', 430, { quote: 'USD', blurb: 'Office software and cloud servers rented to half the world.' }),
  inst('GLOBAL', 'US', 'VOLTCORE', 'Voltcore Semiconductors', 'US_CHIPS', 140, { quote: 'USD', blurb: 'Designs the chips that train AI models. Loved in booms.' }),
  inst('GLOBAL', 'US', 'PARCEL', 'Parcel Planet', 'US_CONSUMER', 190, { quote: 'USD', blurb: 'Online shop and delivery network.' }),
  inst('GLOBAL', 'US', 'LUMINA', 'Lumina Search', 'US_TECH', 175, { quote: 'USD', blurb: 'Search engine and video site, paid for by ads.' }),
  inst('GLOBAL', 'US', 'DYNAMO', 'Dynamo Motors', 'US_EV', 250, { quote: 'USD', blurb: 'Electric cars and batteries. Famous for wild swings.' }),
];

const coin = (id: string, name: string, sectorId: string, usd: number, extra: Extra) =>
  inst('CRYPTO', 'CRYPTO', id, name, sectorId, usd, { quote: 'USD', unitScale: 1_000_000, ...extra });
export const CRYPTO: Instrument[] = [
  coin('CSTN', 'Coinstone', 'CRYPTO_MAJOR', 80_000, { blurb: 'The first and biggest coin. Fixed supply, no company behind it.' }),
  coin('ETRN', 'Etherion', 'CRYPTO_ALT', 3_600, { blurb: 'Runs apps and tokens on its network. Swings harder than Coinstone.' }),
  coin('SWFT', 'Swiftchain', 'CRYPTO_ALT', 160, { blurb: 'A fast, cheap network. Popular in booms, punished in busts.' }),
  coin('SUSD', 'Steady Dollar', 'STABLE', 1, { pricing: { kind: 'PEGGED' }, blurb: 'Meant to stay at $1. In rupees it moves with the dollar.' }),
  coin('PUP', 'Moonpup', 'CRYPTO_MEME', 0.18, { blurb: 'A joke coin with a dog mascot. No product, pure mood.' }),
  coin('RKTY', 'Rocketyield', 'CRYPTO_MEME', 2.4, { rugPullRisk: 0.0015, blurb: 'Promises 40% a year "staking yield". Anonymous team. Read the warning signs.' }),
];

const ipoInst = (id: string, name: string, sectorId: string, bandHi: number, blurb: string): Instrument =>
  inst('IPO', 'IN', id, name, sectorId, bandHi, { indexWeight: 0, advPaise: 1.5e10, blurb });
export const IPO_COMPANIES: Instrument[] = [
  ipoInst('BASKETLY', 'Basketly Commerce', 'CONSUMER', 100, '10-minute grocery delivery in 40 cities. Growing fast, not yet profitable.'),
  ipoInst('WINDMERE', 'Windmere Renewables', 'POWER', 285, 'Wind and solar farms with 20-year power contracts.'),
  ipoInst('HAVENASSUR', 'Haven Assurance', 'NBFC', 570, 'Health and life insurer. Profitable, steady, unglamorous.'),
  ipoInst('WANDERLANE', 'Wanderlane Travel', 'HOTELS', 190, 'Online travel bookings. Lives and dies by the holiday season.'),
  ipoInst('CHIPNEST', 'Chipnest Electronics', 'IT', 440, 'Assembles chips and circuit boards in India. A hot theme.'),
  ipoInst('HARVESTMOON', 'Harvestmoon Agro Foods', 'FMCG', 65, 'Packaged rice, flour and snacks. Thin margins, loyal buyers.'),
  ipoInst('CITYGRID', 'Citygrid Infra', 'INFRA', 116, 'Builds metro lines and flyovers. Lots of debt, lots of orders.'),
  ipoInst('CLOUDKITE', 'Cloudkite Software', 'IT', 760, 'Accounting software for small businesses, sold by subscription.'),
  ipoInst('SUNSPARK', 'Sunspark Solar', 'POWER', 315, 'Makes solar panels. Depends on government incentives.'),
  ipoInst('RUPEELEND', 'Rupeelend Finance', 'NBFC', 158, 'Small loans through an app. High interest, high defaults.'),
  ipoInst('WELLSPRING', 'Wellspring Hospitals', 'PHARMA', 505, 'A chain of 18 hospitals in tier-2 cities.'),
  ipoInst('JETSTREAM', 'Jetstream Cargo', 'AVIATION', 216, 'Air freight for e-commerce. Fuel is its biggest cost.'),
  // Appended (never reorder: saves index the pipeline by position).
  ipoInst('NOVAPAY', 'NovaPay', 'NBFC', 410, 'Payments app with 60 million users and its first profitable quarter. The hottest name of the year.'),
  ipoInst('ZIPCART', 'ZipCart', 'CONSUMER', 88, 'Quick-commerce delivery that loses money on every order but grows fast.'),
  ipoInst('HARBORLOG', 'Harbor Logistics', 'INFRA', 232, 'Warehouses and trucking. Profitable, boring, nobody is talking about it.'),
  ipoInst('SKYREALTY', 'Skyline Realty', 'INFRA', 345, 'Apartment developer with a lot of debt and a lot of unsold flats.'),
  ipoInst('QCHIPS', 'Quantum Chips India', 'IT', 520, 'Chip design start-up valued on its promise. Grey-market chatter is extreme.'),
  ipoInst('MEDIQUICK', 'Mediquick Diagnostics', 'PHARMA', 290, 'Path labs in 300 towns. Steady growth, fair price.'),
  ipoInst('RAILWHEEL', 'Railwheel Engineering', 'INFRA', 165, 'Makes wheels and axles for trains. Order book for five years.'),
  ipoInst('GLOWSKIN', 'Glowskin Beauty', 'FMCG', 375, 'Online-first skincare brand built on influencer marketing.'),
];

const HYPE: Record<string, number> = { NOVAPAY: 2.2, ZIPCART: 2.0, HARBORLOG: 0.6, SKYREALTY: 0.6, QCHIPS: 2.5, MEDIQUICK: 0.9, RAILWHEEL: 1.1, GLOWSKIN: 1.3, BASKETLY: 1.4, WINDMERE: 1.5, HAVENASSUR: 0.8, WANDERLANE: 1.1, CHIPNEST: 1.8, HARVESTMOON: 0.7, CITYGRID: 1.0, CLOUDKITE: 1.5, SUNSPARK: 1.3, RUPEELEND: 0.9, WELLSPRING: 1.0, JETSTREAM: 0.8 };
/** Lots are sized so one lot costs about ₹15,000, like a real retail minimum. */
export const IPO_PIPELINE: IpoDef[] = IPO_COMPANIES.map((i) => ({
  instrumentId: i.id,
  bandHiPaise: i.startPricePaise,
  lotSize: Math.max(1, Math.round(1_500_000 / i.startPricePaise)),
  hype: HYPE[i.id] ?? 1,
}));

export const EXCHANGE_NAME = 'Vaultex';

export const DESK_INSTRUMENTS: Instrument[] = [...FUNDS, ...COMMODITIES, ...BONDS, ...GLOBAL, ...CRYPTO, ...IPO_COMPANIES];
