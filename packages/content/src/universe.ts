// Stock universe (prd.md §10) and sector factor loadings (market-engine.md §5.1).
// Public data: safe for the client bundle. Story/branch content must never live in this file.
//
// Every company and index here is FICTIONAL (legal review L-01/L-02, docs/legal): no real
// listed company, logo or exchange index is named. Each fictional company stands in for a
// sector; start prices, index weights and ADV are illustrative for the 2030 game world.
import type { ContentPack, FactorVector, IndexDef, Instrument, Sector } from '@ms/engine';
import { DESK_INSTRUMENTS, DESK_SECTORS, IPO_PIPELINE } from './desks';

// Order: GR DG PR INF OIL FX GPR CRD CRY LIQ
const sector = (id: string, name: string, loadings: FactorVector, alphaPct: number, idioVolPct: number): Sector => ({ id, name, loadings, alphaPct, idioVolPct });

export const SECTORS: Record<string, Sector> = Object.fromEntries(
  [
    sector('BANK_PVT', 'Private banks', [1.1, 0.9, -0.2, -0.2, -0.2, -0.3, -0.3, -1.2, 0, 0.7], 12, 20),
    sector('BANK_PSU', 'State-run bank', [1.2, 1.0, -0.2, -0.2, -0.2, -0.3, -0.3, -1.3, 0, 0.8], 11, 24),
    sector('NBFC', 'NBFC', [1.1, 0.9, -0.9, -0.3, -0.2, -0.2, -0.3, -1.6, 0, 0.9], 13, 26),
    sector('IT', 'IT services', [0.8, 0.2, -0.3, 0, -0.1, 0.6, -0.2, -0.2, 0, 0.4], 11, 20),
    sector('PHARMA', 'Pharma', [0.5, 0.3, -0.1, 0, -0.1, 0.4, -0.1, -0.1, 0, 0.3], 10, 20),
    sector('FMCG', 'FMCG', [0.5, 0.5, -0.2, -0.5, -0.3, -0.1, -0.1, -0.1, 0, 0.3], 10, 16),
    sector('AUTO', 'Auto', [1.0, 1.1, -0.6, -0.4, -0.6, -0.2, -0.3, -0.4, 0, 0.6], 12, 24),
    sector('AVIATION', 'Aviation', [1.3, 1.0, -0.3, -0.3, -1.8, -0.8, -0.9, -0.5, 0, 0.8], 10, 32),
    sector('PAINTS', 'Paints', [0.8, 0.8, -0.3, -0.4, -1.2, -0.4, -0.3, -0.2, 0, 0.5], 10, 20),
    sector('OMC', 'Oil marketing', [0.8, 0.6, -0.2, -0.2, -1.5, -0.5, -0.4, -0.2, 0, 0.5], 8, 26),
    sector('UPSTREAM', 'Upstream oil & gas', [0.7, 0.4, -0.1, 0.1, 1.3, 0.3, 0.3, -0.2, 0, 0.4], 8, 24),
    sector('DEFENCE', 'Defence', [0.6, 0.6, -0.2, 0, 0, 0, 1.4, -0.1, 0, 0.4], 14, 30),
    sector('METALS', 'Metals', [1.3, 0.7, -0.3, 0.3, 0.2, 0.2, -0.2, -0.3, 0, 0.8], 9, 30),
    sector('INFRA', 'Infra / capital goods', [1.0, 1.2, -0.5, -0.2, -0.3, -0.2, -0.3, -0.4, 0, 0.6], 12, 22),
    sector('HOTELS', 'Hotels', [1.2, 1.1, -0.4, -0.2, -0.4, -0.2, -0.6, -0.4, 0, 0.7], 12, 30),
    sector('POWER', 'Power / utilities', [0.5, 0.5, -0.6, -0.2, -0.2, -0.1, -0.1, -0.2, 0, 0.3], 10, 20),
    // Not in market-engine.md §5.1 — added for the conglomerate, telecom and consumer names; review in P2-T04.
    sector('CONGLOMERATE', 'Refining / conglomerate', [0.9, 0.7, -0.3, -0.1, 0.2, -0.1, -0.2, -0.3, 0, 0.6], 11, 20),
    sector('TELECOM', 'Telecom', [0.5, 0.4, -0.3, -0.1, -0.1, -0.1, -0.1, -0.2, 0, 0.3], 11, 20),
    sector('CONSUMER', 'Consumer', [0.9, 0.9, -0.4, -0.3, -0.2, -0.1, -0.2, -0.3, 0, 0.6], 13, 22),
  ].map((s) => [s.id, s]),
);

const stock = (id: string, symbol: string, name: string, sectorId: string, startRupees: number, indexWeight: number): Instrument => ({
  id,
  symbol,
  name,
  desk: 'STOCKS',
  market: 'IN',
  sector: sectorId,
  startPricePaise: startRupees * 100,
  indexWeight,
  advPaise: Math.round(indexWeight * 2e11),
  real: false,
});

export const STOCKS: Instrument[] = [
  stock('MERIDIAN', 'MERIDIAN', 'Meridian Bank', 'BANK_PVT', 2100, 12),
  stock('IHORIZON', 'IHORIZON', 'Indus Horizon Industries', 'CONGLOMERATE', 3200, 9),
  stock('CORALBK', 'CORALBK', 'Coral Bank', 'BANK_PVT', 1500, 8),
  stock('PIXELWAVE', 'PIXELWAVE', 'Pixelwave Systems', 'IT', 1900, 5.5),
  stock('SKYLINK', 'SKYLINK', 'Skylink Telecom', 'TELECOM', 2200, 4.5),
  stock('QUBITCS', 'QUBITCS', 'Qubit Consultancy', 'IT', 4000, 4),
  stock('GRANITEW', 'GRANITEW', 'Granite Works', 'INFRA', 4200, 4),
  stock('SAFFRON', 'SAFFRON', 'Saffron Consumer', 'FMCG', 520, 3.5),
  stock('NCBANK', 'NCBANK', 'National Commonwealth Bank', 'BANK_PSU', 950, 3),
  stock('KESTREL', 'KESTREL', 'Kestrel Bank', 'BANK_PVT', 1350, 3),
  stock('BANYANBK', 'BANYANBK', 'Banyan Bank', 'BANK_PVT', 2300, 3),
  stock('TORQUE', 'TORQUE', 'Torque Motors', 'AUTO', 3600, 2.5),
  stock('EVERYDAY', 'EVERYDAY', 'Everyday Brands', 'FMCG', 2700, 2),
  stock('EASYLOAN', 'EASYLOAN', 'Easyloan Finance', 'NBFC', 950, 2),
  stock('HELIX', 'HELIX', 'Helix Pharma', 'PHARMA', 1900, 1.7),
  stock('NIMBUS', 'NIMBUS', 'Nimbus Tech', 'IT', 1800, 1.7),
  stock('PEBBLE', 'PEBBLE', 'Pebble Cars', 'AUTO', 14000, 1.6),
  stock('KILOWATT', 'KILOWATT', 'Kilowatt Power', 'POWER', 400, 1.5),
  stock('AURUM', 'AURUM', 'Aurum Lifestyle', 'CONSUMER', 3900, 1.3),
  stock('IRONCLAD', 'IRONCLAD', 'Ironclad Steel', 'METALS', 180, 1.2),
  stock('GRIDLINE', 'GRIDLINE', 'Gridline Transmission', 'POWER', 330, 1.2),
  stock('SHIELD', 'SHIELD', 'Shield Electronics', 'DEFENCE', 450, 1.1),
  stock('COASTPAINT', 'COASTPAINT', 'Coastline Paints', 'PAINTS', 2800, 1),
  stock('DEEPWELL', 'DEEPWELL', 'Deepwell Energy', 'UPSTREAM', 280, 0.9),
  stock('SILVLINE', 'SILVLINE', 'Silverline Metals', 'METALS', 750, 0.9),
  stock('FORGE', 'FORGE', 'Forge Steel', 'METALS', 1100, 0.8),
  stock('CODELOOM', 'CODELOOM', 'Codeloom', 'IT', 1700, 0.8),
  stock('RIDGEWAY', 'RIDGEWAY', 'Ridgeway Two-Wheelers', 'AUTO', 9500, 0.8),
  stock('SKYHOP', 'SKYHOP', 'Skyhop Airlines', 'AVIATION', 6000, 0.8),
  stock('FALCONAERO', 'FALCONAERO', 'Falcon Aerospace', 'DEFENCE', 5000, 0.8),
  stock('MORNDEW', 'MORNDEW', 'Morning Dew Foods', 'FMCG', 1300, 0.7),
  stock('BYTECRAFT', 'BYTECRAFT', 'Bytecraft', 'IT', 300, 0.7),
  stock('MEDORA', 'MEDORA', 'Medora Labs', 'PHARMA', 1600, 0.7),
  stock('CUREWELL', 'CUREWELL', 'Curewell Laboratories', 'PHARMA', 1350, 0.6),
  stock('FUELWAY', 'FUELWAY', 'Fuelway Petroleum', 'OMC', 360, 0.4),
  stock('PIPELINE', 'PIPELINE', 'Pipeline Oil Corp', 'OMC', 160, 0.4),
  stock('PALMSTAY', 'PALMSTAY', 'Palmstay Hotels', 'HOTELS', 850, 0.4),
  stock('ROADSTAR', 'ROADSTAR', 'Roadstar Fuels', 'OMC', 450, 0.3),
  stock('BASINOIL', 'BASINOIL', 'Basin Oil', 'UPSTREAM', 500, 0.2),
  // Added 2026-10: more names per sector. The 50 heaviest form the Survivor 50; the rest trade as midcaps outside it.
  stock('TRUSTLINE', 'TRUSTLINE', 'Trustline Bank', 'BANK_PVT', 640, 0.9),
  stock('CROWNBK', 'CROWNBK', 'Crown Public Bank', 'BANK_PSU', 120, 0.6),
  stock('MANGROVE', 'MANGROVE', 'Mangrove Finance', 'NBFC', 1450, 0.7),
  stock('HEARTHFIN', 'HEARTHFIN', 'Hearthstone Housing Finance', 'NBFC', 520, 0.5),
  stock('SILICORE', 'SILICORE', 'Silicore Technologies', 'IT', 2600, 0.6),
  stock('DATAVALE', 'DATAVALE', 'Datavale Analytics', 'IT', 980, 0.4),
  stock('CASCADE', 'CASCADE', 'Cascade Cement', 'INFRA', 7800, 0.7),
  stock('SEALANE', 'SEALANE', 'Sealane Ports', 'INFRA', 1150, 0.6),
  stock('NORTHWIND', 'NORTHWIND', 'Northwind Power', 'POWER', 260, 0.6),
  stock('ORBITTEL', 'ORBITTEL', 'Orbit Telenet', 'TELECOM', 180, 0.6),
  stock('PRISMHEALTH', 'PRISMHEALTH', 'Prism Health Hospitals', 'PHARMA', 5400, 0.5),
  stock('REDSTONE', 'REDSTONE', 'Redstone Mining', 'METALS', 310, 0.5),
  stock('AXLEWORKS', 'AXLEWORKS', 'Axleworks Auto Parts', 'AUTO', 3100, 0.4),
  stock('GOLDLEAF', 'GOLDLEAF', 'Goldleaf Jewellers', 'CONSUMER', 760, 0.4),
  stock('VERDANT', 'VERDANT', 'Verdant Agrochem', 'FMCG', 680, 0.4),
  stock('BAYSIDE', 'BAYSIDE', 'Bayside Shipbuilders', 'DEFENCE', 1900, 0.4),
  stock('BRIGHTBOX', 'BRIGHTBOX', 'Brightbox Appliances', 'CONSUMER', 1250, 0.3),
  stock('CEDARHOUSE', 'CEDARHOUSE', 'Cedar House Hotels', 'HOTELS', 420, 0.3),
  stock('PALETTE', 'PALETTE', 'Palette Paints', 'PAINTS', 1650, 0.3),
  stock('BLUEFLAME', 'BLUEFLAME', 'Blueflame Gas', 'OMC', 590, 0.3),
  stock('LOOMCRAFT', 'LOOMCRAFT', 'Loomcraft Textiles', 'CONSUMER', 140, 0.3),
  stock('AIRBRIDGE', 'AIRBRIDGE', 'Airbridge Airlines', 'AVIATION', 95, 0.2),
  // Small fictional names that Story Mode chapters 7 and 9 put through a bank run and an accounting scandal.
  stock('NORTHGATE', 'NORTHGATE', 'Northgate Bank', 'BANK_PVT', 880, 0.35),
  stock('CRESCENTFIN', 'CRESCENTFIN', 'Crescent Finance', 'NBFC', 410, 0.25),
  { ...stock('BRIGHTLINE', 'BRIGHTLINE', 'Brightline Infra', 'INFRA', 120, 0.15), bandPct: 5 },
  { ...stock('APEXAGRO', 'APEXAGRO', 'Apex Agro', 'FMCG', 95, 0.1), bandPct: 5 },
  { ...stock('SOLARIS', 'SOLARIS', 'Solaris Green', 'POWER', 45, 0.08), bandPct: 5 },
];

const bankIds = STOCKS.filter((s) => s.sector === 'BANK_PVT' || s.sector === 'BANK_PSU').map((s) => s.id);

/** Fictional benchmark indices. The breaker index drives market-wide circuit breakers. */
export const INDICES: IndexDef[] = [
  { id: 'MS50', name: 'Survivor 50', startLevel: 30000, members: [...STOCKS].sort((a, b) => b.indexWeight - a.indexWeight).slice(0, 50).map((s) => s.id) },
  { id: 'MSBANK', name: 'Survivor Bank', startLevel: 60000, members: bankIds },
];
export const BREAKER_INDEX = INDICES[0]!;

/** Pre-2026-10 saves used real company / index ids. Old id → fictional id (see server migration). */
export const LEGACY_IDS: Record<string, string> = {
  HDFCBANK: 'MERIDIAN', RELIANCE: 'IHORIZON', ICICIBANK: 'CORALBK', INFY: 'PIXELWAVE', BHARTIARTL: 'SKYLINK',
  TCS: 'QUBITCS', LT: 'GRANITEW', ITC: 'SAFFRON', SBIN: 'NCBANK', AXISBANK: 'KESTREL', KOTAKBANK: 'BANYANBK',
  MM: 'TORQUE', HINDUNILVR: 'EVERYDAY', BAJFINANCE: 'EASYLOAN', SUNPHARMA: 'HELIX', HCLTECH: 'NIMBUS',
  MARUTI: 'PEBBLE', NTPC: 'KILOWATT', TITAN: 'AURUM', TATASTEEL: 'IRONCLAD', POWERGRID: 'GRIDLINE', BEL: 'SHIELD',
  ASIANPAINT: 'COASTPAINT', ONGC: 'DEEPWELL', HINDALCO: 'SILVLINE', JSWSTEEL: 'FORGE', TECHM: 'CODELOOM',
  BAJAJAUTO: 'RIDGEWAY', INDIGO: 'SKYHOP', HAL: 'FALCONAERO', NESTLEIND: 'MORNDEW', WIPRO: 'BYTECRAFT',
  CIPLA: 'MEDORA', DRREDDY: 'CUREWELL', BPCL: 'FUELWAY', IOC: 'PIPELINE', INDHOTEL: 'PALMSTAY', HINDPETRO: 'ROADSTAR',
  OIL: 'BASINOIL', NIFTY50: 'MS50', BANKNIFTY: 'MSBANK',
};
/** Old display symbols that differ from their ids (for rewriting ledger memos). */
export const LEGACY_SYMBOLS: Record<string, string> = { 'M&M': 'MM', 'BAJAJ-AUTO': 'BAJAJAUTO' };

export const universe: ContentPack = {
  sectors: { ...SECTORS, ...DESK_SECTORS },
  instruments: [...STOCKS, ...DESK_INSTRUMENTS],
  indices: INDICES,
  breakerIndexId: 'MS50',
  ipos: IPO_PIPELINE,
};
